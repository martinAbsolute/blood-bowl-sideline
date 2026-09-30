"use client";
import {
  useDeferredValue,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { useTranslations } from "gt-next";
import { useConvexAuth, useMutation, usePaginatedQuery } from "convex/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api } from "../../convex/_generated/api";
import { getRoster, getRuleset, rosters, rulesets } from "@/domain/catalog";
import { summarize, validateTeam } from "@/domain/rules";
import { teamSchema, type Team } from "@/domain/types";
import {
  draftAccount,
  draftSnapshot,
  parseDrafts,
  removeDraft,
  storeDraft,
  subscribeDrafts,
} from "@/lib/drafts";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import {
  Plus,
  Upload,
  Archive,
  ArrowUpRight,
  Trash2,
  Undo2,
  CloudCheck,
  FileText,
  Search,
  Check,
  LoaderCircle,
  CloudOff,
  Users,
} from "lucide-react";
import { LoginButton } from "./site-shell";
import { toast } from "sonner";
import { RosterIcon } from "./player-icon";
import { useDraftSync } from "./draft-sync-provider";
import { libraryMatches } from "@/lib/team-library";

const selectClass =
  "h-10 min-w-0 rounded-lg border border-input bg-card px-3 text-sm outline-none focus:ring-2 focus:ring-ring";
export function TeamLibrary() {
  const t = useTranslations(),
    router = useRouter(),
    input = useRef<HTMLInputElement>(null);
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
  async function importFile(file: File | undefined) {
    if (!file) return;
    try {
      if (file.size > 100000) throw new Error();
      const parsed = teamSchema.parse(JSON.parse(await file.text()));
      if (!getRoster(parsed.rosterId)) throw new Error();
      const team = { ...parsed, uuid: crypto.randomUUID() };
      storeDraft(team, sync.account);
      router.push(`/builder?draft=${team.uuid}`);
    } catch {
      toast.error(t("invalidImport"));
    } finally {
      if (input.current) input.current.value = "";
    }
  }
  async function toggleArchive(team: Team) {
    setBusy(team.uuid);
    try {
      await archive({ uuid: team.uuid, archived: !archived });
    } catch {
      toast.error(t("saveFailed"));
    } finally {
      setBusy(null);
    }
  }
  return (
    <div className="page-width py-8 sm:py-10">
      <header className="mb-7 flex flex-wrap items-start justify-between gap-5">
        <div>
          <h1 className="display-font text-3xl sm:text-4xl">{t("myTeams")}</h1>
          <p className="mt-2 max-w-xl text-sm text-muted-foreground">
            {t(isAuthenticated ? "libraryCloudHint" : "libraryGuestHint")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <input
            className="hidden"
            ref={input}
            type="file"
            accept="application/json,.json"
            onChange={(e) => void importFile(e.target.files?.[0])}
          />
          <Button variant="outline" onClick={() => input.current?.click()}>
            <Upload className="size-4" />
            {t("import")}
          </Button>
          <Button asChild>
            <Link href="/teams">
              <Plus className="size-4" />
              {t("createTeam")}
            </Link>
          </Button>
        </div>
      </header>
      {!isAuthenticated && !isLoading && (
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
        <select
          aria-label={t("roster")}
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
        </select>
        <select
          aria-label={t("ruleset")}
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
        </select>
        {isAuthenticated && (
          <select
            aria-label={t("teamLibraryView")}
            className={`${selectClass} col-span-2 lg:col-span-1`}
            value={archived ? "archived" : "active"}
            onChange={(e) => setArchived(e.target.value === "archived")}
          >
            <option value="active">{t("activeTeams")}</option>
            <option value="archived">{t("archivedTeams")}</option>
          </select>
        )}
      </div>
      <section
        aria-label={t("myTeams")}
        aria-busy={
          search !== deferredSearch ||
          (isAuthenticated && status === "LoadingFirstPage")
        }
      >
        {isLoading || (isAuthenticated && status === "LoadingFirstPage") ? (
          <p className="py-8 text-sm text-muted-foreground">{t("loading")}</p>
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
              !archived && (
                <Button asChild className="mt-5">
                  <Link href="/teams">{t("createTeam")}</Link>
                </Button>
              )
            )}
          </div>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {cards.map(({ team, local }) => (
              <TeamCard
                key={team.uuid}
                team={team}
                archived={archived}
                href={
                  archived
                    ? undefined
                    : local
                      ? `/builder?draft=${team.uuid}`
                      : `/teams/${team.uuid}`
                }
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
                            toast.error(t("storageError"));
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
      <div className="mb-5 flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="flex size-14 items-center justify-center rounded-xl border bg-secondary/50">
            <RosterIcon rosterId={team.rosterId} className="size-11" />
          </span>
          <span className="text-sm text-muted-foreground">
            {getRoster(team.rosterId)?.name}
          </span>
        </div>
        {href && (
          <ArrowUpRight className="mt-1 size-4 text-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
        )}
      </div>
      <h2
        className="display-font line-clamp-2 min-h-[3.25rem] break-words text-xl leading-snug"
        title={team.name}
      >
        {team.name || t("untitled")}
      </h2>
      <p className="mt-2 truncate text-xs text-muted-foreground">
        {getRuleset(team.rulesetId).name}
      </p>
      <div className="mt-6 grid grid-cols-2 gap-4 border-t pt-4">
        <div>
          <p className="mb-1 flex items-center gap-1.5 text-xs text-muted-foreground">
            <Users className="size-3.5" />
            {t("players")}
          </p>
          <p className="font-mono text-lg">
            {totals.playerCount}
            <span className="text-sm text-muted-foreground"> / 16</span>
          </p>
        </div>
        <div>
          <p className="mb-1 text-xs text-muted-foreground">{t("teamValue")}</p>
          <p className="font-mono text-lg">
            {(totals.teamGold / 1000).toLocaleString("en")}k{" "}
            <span className="text-xs text-muted-foreground">GP</span>
          </p>
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
    <article className="group flex min-w-0 flex-col overflow-hidden rounded-2xl border bg-card shadow-sm transition-[box-shadow,border-color] hover:border-primary/35 hover:shadow-md">
      {href ? (
        <Link
          href={href}
          className="block flex-1 p-5 outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
        >
          {content}
        </Link>
      ) : (
        <div className="flex-1 p-5 opacity-75">{content}</div>
      )}
      <footer className="flex flex-wrap items-center justify-between gap-2 border-t bg-secondary/15 px-5 py-2">
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-xs ${archived ? "bg-secondary text-muted-foreground" : legal ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400" : "bg-secondary text-muted-foreground"}`}
        >
          {legal && !archived && <Check className="size-3" />}
          {t(archived ? "archived" : legal ? "ready" : "draft")}
        </span>
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
    </article>
  );
}
