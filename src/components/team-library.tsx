"use client";
import { useDeferredValue, useState, useSyncExternalStore } from "react";
import { useTranslations } from "gt-next";
import {
  useConvex,
  useConvexAuth,
  useMutation,
  usePaginatedQuery,
  useQuery,
} from "convex/react";
import { api } from "../../convex/_generated/api";
import { rosters, rulesets } from "@/domain/catalog";
import { teamSchema, type Team } from "@/domain/types";
import {
  draftAccount,
  draftSnapshot,
  parseDrafts,
  removeDraft,
  subscribeDrafts,
} from "@/lib/drafts";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { CreateTeamButton } from "./create-team-button";
import { EditorSelect } from "./editor-select";
import {
  Archive,
  Trash2,
  Undo2,
  CloudCheck,
  FileText,
  Search,
  LoaderCircle,
  ChevronDown,
} from "lucide-react";
import { LoginButton } from "./site-shell";
import { toast } from "@/components/ui/toast";
import { LibraryHeader } from "./library-header";
import { TeamCard } from "./team-card";
import { useDraftSync } from "./draft-sync-provider";
import { libraryMatches } from "@/lib/team-library";
import { finishDraftSignIn } from "@/lib/draft-sign-in";
import { waitForTeamSave } from "@/lib/cloud-save";
import { LibraryCardsLoading } from "./loading-layouts";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "./ui/alert-dialog";

const selectClass = "h-10 rounded-lg pl-3";
export function TeamLibrary() {
  const t = useTranslations();
  const { isAuthenticated, isLoading } = useConvexAuth();
  const sync = useDraftSync();
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);
  const [rosterId, setRoster] = useState("");
  const [rulesetId, setRuleset] = useState<Team["rulesetId"] | "">("");
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const convex = useConvex();
  const [confirmation, setConfirmation] = useState<{
    team: Team;
    action: "archive" | "delete" | "permanent-delete";
  } | null>(null);
  const [confirmationOpen, setConfirmationOpen] = useState(false);
  function requestConfirmation(next: NonNullable<typeof confirmation>) {
    setConfirmation(next);
    setConfirmationOpen(true);
  }
  const confirmedTeam = useQuery(
    api.teams.getByUuid,
    confirmationOpen &&
      confirmation &&
      confirmation.action !== "permanent-delete" &&
      isAuthenticated
      ? { uuid: confirmation.team.uuid }
      : "skip",
  );
  const confirmationLocked = !!confirmedTeam?.leagueLocked;
  const confirmationLoading =
    confirmationOpen &&
    !!confirmation &&
    confirmation.action !== "permanent-delete" &&
    isAuthenticated &&
    confirmedTeam === undefined;
  const permanentlyDelete = useMutation(api.teams.deleteArchived);
  const archive = useMutation(api.teams.setArchived);
  const { results, status, loadMore } = usePaginatedQuery(
    api.teams.listMine,
    isAuthenticated
      ? {
          archived: false,
          search: deferredSearch,
          rosterId: rosterId || undefined,
          rulesetId: rulesetId || undefined,
        }
      : "skip",
    { initialNumItems: 18 },
  );
  const [settledResults, setSettledResults] = useState<{
    account: string;
    results: typeof results;
  } | null>(null);
  if (
    status !== "LoadingFirstPage" &&
    sync.account &&
    (settledResults?.account !== sync.account ||
      settledResults.results !== results)
  ) {
    setSettledResults({ account: sync.account, results });
  }
  const cachedResults =
    isAuthenticated && settledResults?.account === sync.account
      ? settledResults.results
      : null;
  const visibleResults = isAuthenticated
    ? status === "LoadingFirstPage"
      ? (cachedResults ?? [])
      : results
    : [];
  const raw = useSyncExternalStore(subscribeDrafts, draftSnapshot, () => "[]");
  const leagueTeams = new Map(
    visibleResults.map((row) => [row.team.uuid, row]),
  );
  const locals = parseDrafts(raw).filter((team) => {
    const owner = draftAccount(team.uuid);
    if (owner && (!isAuthenticated || owner !== sync.account)) return false;
    const saved = leagueTeams.get(team.uuid);
    const parsed = teamSchema.safeParse({ ...team, notes: "" });
    // Storage cleanup can fail after a successful cloud save. The cloud card
    // remains authoritative when that leftover snapshot is already saved.
    return (
      !saved ||
      !parsed.success ||
      JSON.stringify(parsed.data) !==
        JSON.stringify(teamSchema.parse(saved.team))
    );
  });
  const failedCount = locals.filter((team) =>
    sync.failed.has(team.uuid),
  ).length;
  const filter = { search: deferredSearch, rosterId, rulesetId };
  const pending = new Map(locals.map((team) => [team.uuid, team]));
  const cards = [
    ...locals
      .filter(
        (team) =>
          !leagueTeams.get(team.uuid)?.leagueLocked &&
          libraryMatches(team, filter),
      )
      .map((team) => ({
        team,
        local: true,
        leagueLocked: false,
        leagueExperienced: leagueTeams.get(team.uuid)?.leagueExperienced,
      })),
    ...visibleResults
      .filter(
        ({ team, leagueLocked }) => leagueLocked || !pending.has(team.uuid),
      )
      .map((row) => ({ ...row, local: false })),
  ];
  const filtered = !!(search || rosterId || rulesetId);
  async function toggleArchive(team: Team, nextArchived: boolean) {
    if (busy || (nextArchived && leagueTeams.get(team.uuid)?.leagueLocked))
      return;
    setBusy(team.uuid);
    const release = sync.editing(team.uuid);
    try {
      await waitForTeamSave(team.uuid);
      await archive({ uuid: team.uuid, archived: nextArchived });
      removeDraft(team.uuid);
      finishDraftSignIn(team.uuid);
      setConfirmationOpen(false);
    } catch {
      toast.add({ type: "error", title: t("saveFailed") });
    } finally {
      release();
      setBusy(null);
    }
  }
  async function discard(team: Team) {
    if (busy || leagueTeams.get(team.uuid)?.leagueLocked) return;
    setBusy(team.uuid);
    const release = sync.editing(team.uuid);
    try {
      await waitForTeamSave(team.uuid);
      if (isAuthenticated) {
        const current = await convex.query(api.teams.getByUuid, {
          uuid: team.uuid,
        });
        if (current?.leagueLocked) {
          toast.add({ type: "error", title: t("teamRemovalLocked") });
          return;
        }
      }
      removeDraft(team.uuid);
      finishDraftSignIn(team.uuid);
      setConfirmationOpen(false);
    } catch {
      toast.add({ type: "error", title: t("storageError") });
    } finally {
      release();
      setBusy(null);
    }
  }
  async function deleteArchived(team: Team) {
    if (busy) return;
    setBusy(team.uuid);
    const release = sync.editing(team.uuid);
    try {
      await waitForTeamSave(team.uuid);
      await permanentlyDelete({ uuid: team.uuid });
      removeDraft(team.uuid);
      finishDraftSignIn(team.uuid);
      setConfirmationOpen(false);
    } catch {
      toast.add({ type: "error", title: t("saveFailed") });
    } finally {
      release();
      setBusy(null);
    }
  }
  return (
    <div className="page-width py-8 sm:py-10">
      <LibraryHeader
        title={t("myTeams")}
        description={t(
          isAuthenticated ? "libraryCloudHint" : "libraryGuestHint",
        )}
        action={<CreateTeamButton size="sm" className="h-11 sm:h-9" />}
      />
      {!isLoading && !isAuthenticated && (
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-xl border bg-secondary/30 px-5 py-4">
          <div className="flex items-center gap-3">
            <CloudCheck className="size-5 shrink-0 text-muted-foreground" />
            <p className="max-w-2xl text-sm">{t("syncAllHint")}</p>
          </div>
          <LoginButton />
        </div>
      )}
      {isAuthenticated && failedCount > 0 && (
        <div
          role="alert"
          className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-orange-500/30 bg-orange-500/5 px-5 py-3 text-sm"
        >
          <span>{t("librarySyncError")}</span>
          <Button variant="ghost" size="sm" onClick={sync.retry}>
            {t("retry")}
          </Button>
        </div>
      )}
      <div className="mb-7 grid grid-cols-2 gap-3 lg:grid-cols-[minmax(200px,1fr)_180px_210px]">
        <div className="relative col-span-2 lg:col-span-1">
          <Search
            aria-hidden="true"
            className="absolute left-3 top-3 size-4 text-muted-foreground"
          />
          <Input
            aria-label={t("searchMyTeams")}
            placeholder={t("searchMyTeams")}
            maxLength={160}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-10 rounded-lg bg-card pl-9"
          />
        </div>
        <EditorSelect
          aria-label={t("roster")}
          wrapperClassName="mt-0"
          className={selectClass}
          value={rosterId}
          onChange={(e) => setRoster(e.target.value)}
        >
          <option value="">{t("allRosters")}</option>
          {rosters.map((roster) => (
            <option key={roster.id} value={roster.id}>
              {roster.name}
            </option>
          ))}
        </EditorSelect>
        <EditorSelect
          aria-label={t("ruleset")}
          wrapperClassName="mt-0"
          className={selectClass}
          value={rulesetId}
          onChange={(e) => setRuleset(e.target.value as Team["rulesetId"] | "")}
        >
          <option value="">{t("allRulesets")}</option>
          {rulesets.map((rules) => (
            <option key={rules.id} value={rules.id}>
              {rules.name}
            </option>
          ))}
        </EditorSelect>
      </div>
      <section
        className="min-h-[400px]"
        aria-label={t("myTeams")}
        aria-busy={
          search !== deferredSearch ||
          (isAuthenticated && status === "LoadingFirstPage")
        }
      >
        {cards.length === 0 &&
        (!sync.ready ||
          isLoading ||
          (isAuthenticated &&
            status === "LoadingFirstPage" &&
            !cachedResults)) ? (
          <LibraryCardsLoading
            label={t("loading")}
            text={(key) => t(key)}
            actionLabel={t("openTeam")}
          />
        ) : cards.length === 0 ? (
          <div className="flex min-h-[400px] flex-col items-center justify-center rounded-xl border border-dashed bg-card/50 px-6 py-16 text-center">
            <FileText className="mx-auto mb-4 size-7 text-muted-foreground" />
            <h2 className="text-lg font-semibold">
              {t(filtered ? "noMatchingTeams" : "noTeams")}
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              {t(filtered ? "clearFiltersHint" : "noTeamsHint")}
            </p>
            {filtered ? (
              <Button
                variant="outline"
                className="mt-5"
                onClick={() => {
                  setSearch("");
                  setRoster("");
                  setRuleset("");
                }}
              >
                {t("clearFilters")}
              </Button>
            ) : (
              <CreateTeamButton className="mt-5" />
            )}
          </div>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {cards.map(({ team, local, leagueLocked, leagueExperienced }) => (
              <TeamCard
                key={team.uuid}
                team={team}
                leagueLocked={leagueLocked}
                leagueExperienced={leagueExperienced}
                href={`/teams/${team.uuid}`}
                saveState={
                  local
                    ? isAuthenticated
                      ? sync.failed.has(team.uuid) || !team.name.trim()
                        ? "error"
                        : "pending"
                      : "device"
                    : "cloud"
                }
                action={
                  local ? (
                    <Button
                      variant="ghost"
                      size="icon"
                      disabled={leagueLocked || busy !== null || isLoading}
                      aria-label={`${t(isAuthenticated ? "discardDraft" : "remove")} ${team.name}`}
                      onClick={() =>
                        requestConfirmation({ team, action: "delete" })
                      }
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  ) : (
                    <Tooltip>
                      <TooltipTrigger
                        render={
                          <Button
                            variant="ghost"
                            size="icon"
                            disabled={leagueLocked || busy !== null}
                            aria-label={`${t("archive")} ${team.name}`}
                            onClick={() =>
                              requestConfirmation({ team, action: "archive" })
                            }
                          />
                        }
                      >
                        {busy === team.uuid ? (
                          <LoaderCircle className="size-4 animate-spin" />
                        ) : (
                          <Archive className="size-4" />
                        )}
                      </TooltipTrigger>
                      <TooltipContent>{t("archiveLabel")}</TooltipContent>
                    </Tooltip>
                  )
                }
              />
            ))}
          </div>
        )}
        {isAuthenticated && status === "CanLoadMore" && (
          <div className="mt-7 text-center">
            <Button variant="outline" onClick={() => loadMore(18)}>
              {t("loadMore")}
            </Button>
          </div>
        )}
        {isAuthenticated && status === "LoadingMore" && (
          <p
            role="status"
            className="mt-7 text-center text-sm text-muted-foreground"
          >
            {t("loading")}
          </p>
        )}
      </section>
      {isAuthenticated && (
        <section className="mt-10 border-t pt-6">
          <button
            type="button"
            aria-expanded={archiveOpen}
            aria-controls="team-archive"
            className="flex w-full items-center gap-3 rounded-lg py-3 text-left font-semibold focus-visible:outline-2 focus-visible:outline-ring"
            onClick={() => setArchiveOpen(!archiveOpen)}
          >
            <Archive className="size-5 text-muted-foreground" />
            {t("archivedTeams")}
            <ChevronDown
              className={`ml-auto size-5 transition-transform ${archiveOpen ? "rotate-180" : ""}`}
            />
          </button>
          {archiveOpen && (
            <div id="team-archive" className="pt-4">
              <ArchivedTeams
                filter={filter}
                busy={busy}
                onRestore={(team) => void toggleArchive(team, false)}
                onDelete={(team) =>
                  requestConfirmation({ team, action: "permanent-delete" })
                }
              />
            </div>
          )}
        </section>
      )}
      <AlertDialog
        open={confirmationOpen}
        onOpenChange={(open) => {
          if (!open && !busy) setConfirmationOpen(false);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t(
                confirmation?.action === "archive"
                  ? "confirmArchiveTeam"
                  : confirmation?.action === "permanent-delete"
                    ? "confirmPermanentDeleteTeam"
                    : "confirmDeleteTeam",
                { name: confirmation?.team.name ?? "" },
              )}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t(
                confirmationLocked
                  ? "teamRemovalLocked"
                  : confirmation?.action === "archive"
                    ? "confirmArchiveTeamHint"
                    : confirmation?.action === "permanent-delete"
                      ? "confirmPermanentDeleteTeamHint"
                      : "confirmDeleteTeamHint",
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy !== null}>
              {t("cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={
                busy !== null || confirmationLocked || confirmationLoading
              }
              onClick={() => {
                if (!confirmation || confirmationLocked || confirmationLoading)
                  return;
                if (confirmation.action === "archive")
                  void toggleArchive(confirmation.team, true);
                else if (confirmation.action === "permanent-delete")
                  void deleteArchived(confirmation.team);
                else void discard(confirmation.team);
              }}
            >
              {busy ? (
                <LoaderCircle className="size-4 animate-spin" />
              ) : (
                t(
                  confirmation?.action === "archive"
                    ? "archive"
                    : confirmation?.action === "permanent-delete"
                      ? "deletePermanently"
                      : "remove",
                )
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function ArchivedTeams({
  filter,
  busy,
  onRestore,
  onDelete,
}: {
  filter: { search: string; rosterId: string; rulesetId: string };
  busy: string | null;
  onRestore: (team: Team) => void;
  onDelete: (team: Team) => void;
}) {
  const t = useTranslations();
  const { results, status, loadMore } = usePaginatedQuery(
    api.teams.listMine,
    {
      archived: true,
      search: filter.search,
      rosterId: filter.rosterId || undefined,
      rulesetId: (filter.rulesetId || undefined) as
        Team["rulesetId"] | undefined,
    },
    { initialNumItems: 18 },
  );
  const [lastResults, setLastResults] = useState<typeof results | null>(null);
  if (status !== "LoadingFirstPage" && lastResults !== results) {
    setLastResults(results);
  }
  const visibleResults =
    status === "LoadingFirstPage" ? (lastResults ?? []) : results;
  return (
    <div aria-busy={status === "LoadingFirstPage"}>
      {status === "LoadingFirstPage" && !lastResults ? (
        <LibraryCardsLoading
          label={t("loading")}
          text={(key) => t(key)}
          actionLabel={t("restore")}
        />
      ) : visibleResults.length === 0 ? (
        <p className="rounded-xl border border-dashed px-6 py-10 text-center text-sm text-muted-foreground">
          {t(
            filter.search || filter.rosterId || filter.rulesetId
              ? "noMatchingTeams"
              : "noArchivedTeams",
          )}
        </p>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {visibleResults.map(({ team }) => (
            <TeamCard
              key={team.uuid}
              team={team}
              archived
              saveState="cloud"
              primaryAction={
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <Button
                        variant="ghost"
                        size="icon"
                        disabled={busy !== null}
                        aria-label={`${t("restore")} ${team.name}`}
                        onClick={() => onRestore(team)}
                      />
                    }
                  >
                    {busy === team.uuid ? (
                      <LoaderCircle className="size-4 animate-spin" />
                    ) : (
                      <Undo2 className="size-4" />
                    )}
                  </TooltipTrigger>
                  <TooltipContent>{t("restoreLabel")}</TooltipContent>
                </Tooltip>
              }
              action={
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <Button
                        variant="ghost"
                        size="icon"
                        disabled={busy !== null}
                        aria-label={`${t("deletePermanently")} ${team.name}`}
                        onClick={() => onDelete(team)}
                      />
                    }
                  >
                    <Trash2 className="size-4" />
                  </TooltipTrigger>
                  <TooltipContent>{t("deleteLabel")}</TooltipContent>
                </Tooltip>
              }
            />
          ))}
        </div>
      )}
      {(status === "CanLoadMore" || status === "LoadingMore") && (
        <div className="mt-7 text-center">
          <Button
            variant="outline"
            disabled={status === "LoadingMore"}
            onClick={() => loadMore(18)}
          >
            {t(status === "LoadingMore" ? "loading" : "loadMore")}
          </Button>
        </div>
      )}
    </div>
  );
}
