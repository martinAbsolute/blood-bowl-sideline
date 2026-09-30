"use client";
import { useDeferredValue, useState, useSyncExternalStore } from "react";
import { useTranslations } from "gt-next";
import { useConvexAuth, useMutation, usePaginatedQuery } from "convex/react";
import Link from "next/link";
import { api } from "../../convex/_generated/api";
import { getRoster, getRuleset, rosters, rulesets } from "@/domain/catalog";
import { summarize, validateTeam } from "@/domain/rules";
import { type Team } from "@/domain/types";
import {
  draftAccount,
  draftSnapshot,
  parseDrafts,
  removeDraft,
  subscribeDrafts,
} from "@/lib/drafts";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Card } from "./ui/card";
import { CreateTeamButton } from "./create-team-button";
import { EditorSelect } from "./editor-select";
import {
  Archive,
  ArrowUpRight,
  Trash2,
  Undo2,
  CloudCheck,
  FileText,
  Search,
  LoaderCircle,
  CloudOff,
} from "lucide-react";
import { LoginButton } from "./site-shell";
import { toast } from "@/components/ui/toast";
import { RosterIcon } from "./player-icon";
import { useDraftSync } from "./draft-sync-provider";
import { libraryMatches } from "@/lib/team-library";

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
  const locals = parseDrafts(raw).filter((team) => {
    const owner = draftAccount(team.uuid);
    return !owner || (isAuthenticated && owner === sync.account);
  });
  const failedCount = locals.filter((team) =>
    sync.failed.has(team.uuid),
  ).length;
  const filter = { search: deferredSearch, rosterId, rulesetId };
  const pending = new Map(locals.map((team) => [team.uuid, team]));
  const cards = archived
    ? results.map(({ team }) => ({ team, local: false }))
    : [
        ...locals
          .filter((team) => libraryMatches(team, filter))
          .map((team) => ({ team, local: true })),
        ...results
          .filter(({ team }) => !pending.has(team.uuid))
          .map(({ team }) => ({ team, local: false })),
      ];
  const filtered = !!(search || rosterId || rulesetId);
  async function toggleArchive(team: Team) {
    setBusy(team.uuid);
    try {
      await archive({ uuid: team.uuid, archived: !archived });
    } catch {
      toast.add({ type: "error", title: t("saveFailed") });
    } finally {
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
      {!isAuthenticated && (
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
        className="min-h-[320px]"
        aria-label={t("myTeams")}
        aria-busy={
          search !== deferredSearch ||
          (isAuthenticated && status === "LoadingFirstPage")
        }
      >
        {cards.length === 0 &&
        (isLoading || (isAuthenticated && status === "LoadingFirstPage")) ? (
          <div
            role="status"
            className="flex min-h-[300px] items-center justify-center rounded-xl border bg-card/50 text-sm text-muted-foreground"
          >
            <LoaderCircle className="mr-2 size-4 animate-spin" />
            {t("loading")}
          </div>
        ) : cards.length === 0 ? (
          <div className="rounded-xl border border-dashed bg-card/50 px-6 py-16 text-center">
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
            {cards.map(({ team, local }) => (
              <TeamCard
                key={team.uuid}
                team={team}
                archived={archived}
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
                    !isAuthenticated && (
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`${t("remove")} ${team.name}`}
                        onClick={() => {
                          try {
                            removeDraft(team.uuid);
                          } catch {
                            toast.add({
                              type: "error",
                              title: t("storageError"),
                            });
                          }
                        }}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    )
                  ) : (
                    <Button
                      variant="ghost"
                      size="icon"
                      disabled={busy === team.uuid}
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

function TeamCard({
  team,
  href,
  action,
  archived,
  saveState,
}: {
  team: Team;
  href?: string;
  action: React.ReactNode;
  archived: boolean;
  saveState: "cloud" | "device" | "pending" | "error";
}) {
  const t = useTranslations(),
    totals = summarize(team),
    legal = validateTeam(team).valid;
  const content = (
    <>
      <div className="relative overflow-hidden bg-primary px-5 pb-5 pt-4 text-primary-foreground">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-6 -top-6 size-40 rounded-full border-[24px] border-white/5"
        />
        <div className="relative mb-4 flex items-center justify-between gap-3">
          <span className="text-xs font-medium text-white/75">
            {getRoster(team.rosterId)?.name}
          </span>
          <span
            className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${legal && !archived ? "bg-lime-200 text-primary" : "bg-white/15 text-white"}`}
          >
            {t(archived ? "archived" : legal ? "ready" : "draft")}
          </span>
        </div>
        <div className="relative flex items-center gap-4">
          <span className="flex size-16 shrink-0 items-center justify-center rounded-2xl bg-white/90 shadow-sm">
            <RosterIcon rosterId={team.rosterId} className="size-12" />
          </span>
          <div className="min-w-0 flex-1">
            <h2
              className="display-font line-clamp-2 min-h-14 break-words text-2xl leading-7"
              title={team.name}
            >
              {team.name || t("untitled")}
            </h2>
            <p className="mt-1 truncate text-xs text-white/70">
              {team.coach || t("coachNotSet")}
            </p>
          </div>
        </div>
      </div>
      <div className="space-y-4 p-5">
        <p className="min-h-8 text-xs font-medium text-muted-foreground">
          {getRuleset(team.rulesetId).name}
        </p>
        <dl className="grid grid-cols-3 divide-x rounded-lg border bg-secondary/25 py-3 text-center">
          <div>
            <dt className="text-[10px] text-muted-foreground">
              {t("players")}
            </dt>
            <dd className="mt-1 font-mono text-base font-semibold">
              {totals.playerCount}
              <span className="text-xs font-normal text-muted-foreground">
                {" "}
                / 16
              </span>
            </dd>
          </div>
          <div>
            <dt className="text-[10px] text-muted-foreground">
              {t("teamValue")}
            </dt>
            <dd className="mt-1 font-mono text-base font-semibold">
              {totals.teamGold / 1000}k
            </dd>
          </div>
          <div>
            <dt className="text-[10px] text-muted-foreground">
              {t("remaining")}
            </dt>
            <dd
              className={`mt-1 font-mono text-base font-semibold ${totals.remaining < 0 ? "text-destructive" : "text-primary"}`}
            >
              {totals.remaining / 1000}k
            </dd>
          </div>
        </dl>
        <div className="flex items-center justify-between text-xs font-semibold text-primary">
          <span>{t(href ? "openTeam" : "archived")}</span>
          {href && (
            <ArrowUpRight className="size-4 transition-transform motion-safe:group-hover:translate-x-0.5" />
          )}
        </div>
      </div>
    </>
  );
  const SaveIcon =
    saveState === "cloud"
      ? CloudCheck
      : saveState === "device"
        ? FileText
        : saveState === "pending"
          ? LoaderCircle
          : CloudOff;
  return (
    <article className="min-w-0">
      <Card className="group min-w-0 gap-0 rounded-2xl py-0 shadow-sm transition-shadow hover:shadow-lg">
        {href ? (
          <Link
            href={href}
            prefetch
            className="block flex-1 outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
          >
            {content}
          </Link>
        ) : (
          <div className="flex-1 opacity-75">{content}</div>
        )}
        <footer className="flex min-h-14 items-center border-t bg-secondary/15 px-5 py-2 [&>div]:w-full [&>div>button]:ml-auto">
          <div className="flex items-center gap-2">
            <span
              role="status"
              className="inline-flex items-center gap-1.5 text-xs text-muted-foreground"
            >
              <SaveIcon
                className={`size-3.5 ${saveState === "pending" ? "animate-spin" : ""}`}
              />
              {t(
                saveState === "cloud"
                  ? "savedCloud"
                  : saveState === "device"
                    ? "savedInDrafts"
                    : saveState === "pending"
                      ? "saving"
                      : "saveStatusError",
              )}
            </span>
            {action}
          </div>
        </footer>
      </Card>
    </article>
  );
}
