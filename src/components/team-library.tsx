"use client";
import { useDeferredValue, useState, useSyncExternalStore } from "react";
import { useTranslations } from "gt-next";
import { useConvexAuth, useMutation, usePaginatedQuery } from "convex/react";
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
} from "lucide-react";
import { LoginButton } from "./site-shell";
import { toast } from "@/components/ui/toast";
import { TeamCard } from "./team-card";
import { useDraftSync } from "./draft-sync-provider";
import { libraryMatches } from "@/lib/team-library";
import { finishDraftSignIn } from "@/lib/draft-sign-in";
import { waitForTeamSave } from "@/lib/cloud-save";
import { LibraryCardsLoading } from "./loading-layouts";

const selectClass = "h-10 rounded-lg pl-3";
export function TeamLibrary() {
  const t = useTranslations();
  const { isAuthenticated, isLoading } = useConvexAuth();
  const sync = useDraftSync();
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);
  const [rosterId, setRoster] = useState("");
  const [rulesetId, setRuleset] = useState<Team["rulesetId"] | "">("");
  const [archived, setArchived] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const archive = useMutation(api.teams.setArchived);
  const { results, status, loadMore } = usePaginatedQuery(
    api.teams.listMine,
    isAuthenticated
      ? {
          archived,
          search: deferredSearch,
          rosterId: rosterId || undefined,
          rulesetId: rulesetId || undefined,
        }
      : "skip",
    { initialNumItems: 18 },
  );
  const raw = useSyncExternalStore(subscribeDrafts, draftSnapshot, () => "[]");
  const leagueTeams = new Map(results.map((row) => [row.team.uuid, row]));
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
  const cards = archived
    ? results.map((row) => ({ ...row, local: false }))
    : [
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
        ...results
          .filter(
            ({ team, leagueLocked }) => leagueLocked || !pending.has(team.uuid),
          )
          .map((row) => ({ ...row, local: false })),
      ];
  const filtered = !!(search || rosterId || rulesetId);
  async function toggleArchive(team: Team) {
    setBusy(team.uuid);
    const release = sync.editing(team.uuid);
    try {
      await waitForTeamSave(team.uuid);
      await archive({ uuid: team.uuid, archived: !archived });
      removeDraft(team.uuid);
      finishDraftSignIn(team.uuid);
    } catch {
      toast.add({ type: "error", title: t("saveFailed") });
    } finally {
      release();
      setBusy(null);
    }
  }
  async function discard(team: Team) {
    setBusy(team.uuid);
    const release = sync.editing(team.uuid);
    try {
      await waitForTeamSave(team.uuid);
      removeDraft(team.uuid);
      finishDraftSignIn(team.uuid);
    } catch {
      toast.add({ type: "error", title: t("storageError") });
    } finally {
      release();
      setBusy(null);
    }
  }
  return (
    <div className="page-width py-8 sm:py-10">
      <header className="mb-7 flex flex-wrap items-start justify-between gap-5">
        <div>
          <h1 className="page-heading">{t("myTeams")}</h1>
          <p className="mt-2 max-w-xl text-sm text-muted-foreground">
            {t(isAuthenticated ? "libraryCloudHint" : "libraryGuestHint")}
          </p>
        </div>
        <CreateTeamButton />
      </header>
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
      <div
        className={`mb-7 grid grid-cols-2 gap-3 ${isAuthenticated ? "lg:grid-cols-[minmax(200px,1fr)_180px_210px_150px]" : "lg:grid-cols-[minmax(200px,1fr)_180px_210px]"}`}
      >
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
        {isAuthenticated && (
          <EditorSelect
            aria-label={t("teamLibraryView")}
            wrapperClassName="mt-0 col-span-2 lg:col-span-1"
            className={selectClass}
            value={archived ? "archived" : "active"}
            onChange={(e) => setArchived(e.target.value === "archived")}
          >
            <option value="active">{t("activeTeams")}</option>
            <option value="archived">{t("archivedTeams")}</option>
          </EditorSelect>
        )}
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
          (isAuthenticated && status === "LoadingFirstPage")) ? (
          <LibraryCardsLoading
            label={t("loading")}
            text={(key) => t(key)}
            actionLabel={t(archived ? "archived" : "openTeam")}
          />
        ) : cards.length === 0 ? (
          <div className="flex min-h-[400px] flex-col items-center justify-center rounded-xl border border-dashed bg-card/50 px-6 py-16 text-center">
            <FileText className="mx-auto mb-4 size-7 text-muted-foreground" />
            <h2 className="text-lg font-semibold">
              {t(
                filtered
                  ? "noMatchingTeams"
                  : archived
                    ? "noArchivedTeams"
                    : "noTeams",
              )}
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              {t(
                filtered
                  ? "clearFiltersHint"
                  : archived
                    ? "archiveHint"
                    : "noTeamsHint",
              )}
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
              !archived && <CreateTeamButton className="mt-5" />
            )}
          </div>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {cards.map(({ team, local, leagueLocked, leagueExperienced }) => (
              <TeamCard
                key={team.uuid}
                team={team}
                archived={archived}
                leagueLocked={leagueLocked}
                leagueExperienced={leagueExperienced}
                href={archived ? undefined : `/teams/${team.uuid}`}
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
                      disabled={busy === team.uuid}
                      aria-label={`${t(isAuthenticated ? "discardDraft" : "remove")} ${team.name}`}
                      onClick={() => void discard(team)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  ) : (
                    <Button
                      variant="ghost"
                      size="icon"
                      disabled={
                        (!archived && leagueLocked) || busy === team.uuid
                      }
                      aria-label={`${t(archived ? "restore" : "archive")} ${team.name}`}
                      onClick={() => void toggleArchive(team)}
                    >
                      {busy === team.uuid ? (
                        <LoaderCircle className="size-4 animate-spin" />
                      ) : archived ? (
                        <Undo2 className="size-4" />
                      ) : (
                        <Archive className="size-4" />
                      )}
                    </Button>
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
    </div>
  );
}
