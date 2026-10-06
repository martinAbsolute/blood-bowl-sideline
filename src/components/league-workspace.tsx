"use client";
import { useContentTitle } from "@/lib/use-content-title";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  useConvexAuth,
  useMutation,
  usePaginatedQuery,
  useQuery,
} from "convex/react";
import { useTranslations } from "gt-next";
import {
  ArrowRight,
  CalendarDays,
  Check,
  ClipboardList,
  Flag,
  History,
  LayoutDashboard,
  Settings2,
  ShieldCheck,
  Send,
  Trophy,
  Users,
} from "lucide-react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { ShareButton } from "./share-button";
import { DEFAULT_LEAGUE_TREASURY } from "@/domain/league-rules";
import { getRoster } from "@/domain/catalog";
import { canEnrollTeam } from "@/lib/league-team-eligibility";
import {
  leaguePlayerLabel,
  leaguePlayerNumbers,
} from "@/lib/league-player-label";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { LeagueField, LeagueSelect } from "./league-field";
import { LeagueTeamPicker } from "./league-team-picker";
import { LeagueDeleteDialog } from "./league-delete-dialog";
import { LeagueNavigation } from "./league-navigation";
import { HistoryLoading } from "./list-loading";
import { RosterIcon } from "./player-icon";
import { CommissionerWithdrawal } from "./league-commissioner";
import {
  LeagueBack,
  LeagueError,
  LeagueGate,
  LeagueHistory,
  LeagueSection,
  LeagueStatTable,
  LeagueStatus,
  leagueDate,
  localDateInput,
  useLeagueAction,
} from "./league-ui";

const teamColumns = [
  "pts",
  "mp",
  "w",
  "d",
  "l",
  "td",
  "tdDiff",
  "cas",
  "casDiff",
  "latest",
] as const;
const playerColumns = [
  "sppEarned",
  "available",
  "mp",
  "td",
  "sppCas",
  "com",
  "int",
  "mvp",
  "superbThrows",
  "safeLandings",
  "inj",
  "dth",
] as const;

export function LeagueWorkspace({ leagueId }: { leagueId: string }) {
  const t = useTranslations();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isAuthenticated, isLoading } = useConvexAuth();
  const id = leagueId as Id<"leagues">;
  const data = useQuery(
    api.leagues.get,
    isAuthenticated ? { leagueId: id } : "skip",
  );
  useContentTitle(data?.league.name);
  const [teamUuid, setTeamUuid] = useState("");
  const [teamPickerOpen, setTeamPickerOpen] = useState(false);
  const requestedTab = searchParams.get("view") ?? "overview";
  const tab =
    [
      "overview",
      "fixtures",
      "standings",
      "participants",
      "players",
      "history",
      "manage",
    ].includes(requestedTab) &&
    (requestedTab !== "manage" || data?.canCommission)
      ? requestedTab
      : "overview";
  const setTab = (view: string) =>
    router.push(`/leagues/manage/${leagueId}?view=${view}`, { scroll: false });
  const [selectedRound, setSelectedRound] = useState("");
  const [detailedStats, setDetailedStats] = useState(false);
  const [copied, setCopied] = useState(false);
  const own = usePaginatedQuery(
    api.teams.listMine,
    isAuthenticated &&
      tab === "overview" &&
      data?.canRegister &&
      !data.entries.some((entry) => entry.coachId === data.viewerId) &&
      (teamPickerOpen || teamUuid)
      ? { archived: false }
      : "skip",
    { initialNumItems: 30 },
  );
  const audit = usePaginatedQuery(
    api.leagues.audit,
    isAuthenticated && tab === "history" ? { leagueId: id } : "skip",
    { initialNumItems: 15 },
  );
  const register = useMutation(api.leagues.register);
  const launch = useMutation(api.leagues.launch);
  const openRound = useMutation(api.leagues.openRound);
  const extendRound = useMutation(api.leagues.extendRound);
  const action = useLeagueAction();
  if (isLoading || !isAuthenticated || data === undefined)
    return (
      <LeagueGate
        authenticated={isAuthenticated}
        loading={isLoading || isAuthenticated}
      />
    );
  if (!data)
    return (
      <div className="page-width py-8">
        <LeagueBack />
        <p>{t("leagueUi.notFound")}</p>
      </div>
    );
  const { league, entries, rounds, matches, standings } = data;
  const base = `/leagues/manage/${leagueId}`;
  const mine = entries.find((entry) => entry.coachId === data.viewerId);
  const selectedTeam = own.results.find(({ team }) => team.uuid === teamUuid);
  const canJoin =
    selectedTeam && canEnrollTeam(selectedTeam, league.startingTreasury);
  const entryById = new Map(entries.map((entry) => [entry._id, entry]));
  const currentRound =
    rounds.find((round) => round.status === "open") ??
    rounds.find((round) => round.status === "pending") ??
    rounds.at(-1);
  const visibleRound =
    rounds.find((round) => round._id === selectedRound) ?? currentRound;
  const roundMatches = matches.filter(
    (match) => match.roundId === visibleRound?._id,
  );
  const finished = matches.filter((match) =>
    ["completed", "bye", "void"].includes(match.status),
  ).length;
  const nextMatch =
    mine &&
    !mine.withdrawn &&
    matches.find(
      (match) =>
        (match.homeEntryId === mine._id || match.awayEntryId === mine._id) &&
        !["completed", "bye", "void"].includes(match.status),
    );
  const activeEntries = entries.filter((entry) => !entry.withdrawn);
  const pendingPostgame = activeEntries.filter(
    (entry) => entry.postGamePending,
  );
  const unresolved = matches.filter(
    (match) =>
      !["completed", "bye", "void"].includes(match.status) &&
      rounds.find((round) => round._id === match.roundId)?.status === "open",
  );
  const waitingReports = unresolved.filter(
    (match) => match.confirmedBy.length > 0,
  );
  const readyRound = rounds.find(
    (round, index) =>
      round.status === "pending" &&
      rounds
        .slice(0, index)
        .every((previous) => previous.status === "completed"),
  );
  const tabs = [
    { value: "overview", label: t("leagueUx.overview"), icon: LayoutDashboard },
    { value: "fixtures", label: t("leagueUi.fixtures"), icon: CalendarDays },
    { value: "standings", label: t("leagueUi.standings"), icon: Trophy },
    { value: "participants", label: t("leagueUx.teams"), icon: Users },
    { value: "players", label: t("leagueUi.playerStats"), icon: ClipboardList },
    { value: "history", label: t("leagueUi.history"), icon: History },
    ...(data.canCommission
      ? [
          {
            value: "manage",
            label: t("leagueUx.manage"),
            icon: Settings2,
            badge: waitingReports.length + pendingPostgame.length,
          },
        ]
      : []),
  ];
  const playerNumbers = leaguePlayerNumbers(
    data.playerStats.map((player) => ({
      id: player.playerId,
      entryId: player.entryId,
    })),
  );
  return (
    <div className="page-width space-y-4 py-5 sm:py-6">
      <LeagueBack />
      <header className="overflow-hidden rounded-xl border bg-card">
        <div className="flex flex-wrap items-start justify-between gap-4 p-5 sm:p-6">
          <div className="min-w-0 flex-1 basis-64">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="page-heading break-words">{league.name}</h1>
              <LeagueStatus status={league.status} />
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
              <span className="font-medium text-foreground">
                {t("leagueUi.commissioner")}:
              </span>
              {data.commissionerUsername ? (
                <a
                  href={`https://t.me/${data.commissionerUsername}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-primary underline-offset-4 hover:underline"
                >
                  {league.commissionerName}
                  <Send className="size-3.5" aria-hidden="true" />
                </a>
              ) : (
                <span>{league.commissionerName}</span>
              )}
              <span aria-hidden="true">·</span>
              <span>
                {t("leagueUx.roundDuration", { days: league.roundDays })}
              </span>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <ShareButton
              variant="outline"
              className="h-10"
              path={base}
              onShared={() => setCopied(true)}
            />
          </div>
        </div>
        <div className="flex flex-wrap gap-x-5 gap-y-3 border-t bg-secondary/25 px-5 py-3 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-2">
            <Users className="size-4" />
            {activeEntries.length} {t("leagueUi.coaches")}
          </span>
          {currentRound && (
            <span className="inline-flex items-center gap-2">
              <Flag className="size-4" />
              {t("leagueUi.round")} {currentRound.number} / {rounds.length}
            </span>
          )}
          <span className="inline-flex items-center gap-2">
            <CalendarDays className="size-4" />
            {leagueDate(league.startAt)}
          </span>
          {data.canCommission && (
            <span className="inline-flex items-center gap-2 text-primary">
              <ShieldCheck className="size-4" />
              {t(mine ? "leagueUx.coachCommissioner" : "leagueUi.commissioner")}
            </span>
          )}
        </div>
      </header>
      <LeagueError message={action.error} />
      <LeagueNavigation
        label={t("leagueUi.leagueViews")}
        value={tab}
        onChange={setTab}
        items={tabs}
      />
      {tab === "overview" && (
        <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
          <div className="min-w-0 space-y-4">
            {mine ? (
              <div className="rounded-xl border border-primary/25 bg-primary/[0.04] p-5 sm:p-6">
                <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {t("leagueUx.yourTeam")}
                </p>
                <div className="flex items-center gap-4">
                  <RosterIcon
                    rosterId={mine.team.rosterId}
                    className="size-10"
                  />
                  <div>
                    <h2 className="text-base font-semibold">
                      {mine.team.name}
                    </h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {getRoster(mine.team.rosterId)?.name}
                    </p>
                  </div>
                </div>
                <p className="mt-4 text-sm text-muted-foreground">
                  {t(
                    mine.withdrawn
                      ? "leagueUi.status.withdrawn"
                      : mine.postGamePending
                        ? "leagueUx.postgameNext"
                        : nextMatch
                          ? "leagueUx.matchNext"
                          : league.status === "registration"
                            ? "leagueUx.registrationNext"
                            : "leagueUx.noUpcoming",
                  )}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Link
                    href={`${base}/teams/${mine._id}`}
                    className={`inline-flex min-h-11 items-center gap-2 rounded-lg px-4 text-sm font-medium ${mine.postGamePending || !nextMatch ? "bg-primary text-primary-foreground hover:bg-primary/90" : "border bg-card hover:bg-secondary"}`}
                  >
                    {t(
                      mine.postGamePending
                        ? "leagueUx.finishPostgame"
                        : "leagueUi.manageCareer",
                    )}
                    <ArrowRight className="size-4" />
                  </Link>
                  {nextMatch && !mine.postGamePending && (
                    <Link
                      href={`${base}/matches/${nextMatch._id}`}
                      className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                    >
                      {t(
                        nextMatch.status === "in-progress"
                          ? "leagueUx.continueReport"
                          : "leagueUx.nextMatch",
                      )}
                      <ArrowRight className="size-4" />
                    </Link>
                  )}
                </div>
              </div>
            ) : null}

            {data.canRegister && !mine && (
              <LeagueSection title={t("leagueUi.registerTeam")}>
                <p className="mb-4 text-sm text-muted-foreground">
                  {t("leagueUx.joinHint")}
                </p>
                <div className="flex flex-wrap items-end gap-3">
                  <LeagueTeamPicker
                    onOpenChange={setTeamPickerOpen}
                    leagueId={leagueId}
                    startingTreasury={league.startingTreasury}
                    teams={own.results}
                    value={teamUuid}
                    onChange={setTeamUuid}
                    status={own.status}
                    loadMore={() => own.loadMore(30)}
                    disabled={action.busy}
                  />
                  <Button
                    className="h-11"
                    disabled={!canJoin || action.busy}
                    onClick={() =>
                      void action.run(() =>
                        register({ leagueId: id, teamUuid }),
                      )
                    }
                  >
                    {t("leagueUi.join")}
                  </Button>
                </div>
              </LeagueSection>
            )}

            <LeagueSection
              title={t(
                league.status === "registration"
                  ? "leagueUi.participants"
                  : "leagueUx.seasonProgress",
              )}
              action={
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() =>
                    setTab(
                      league.status === "registration"
                        ? "participants"
                        : "fixtures",
                    )
                  }
                >
                  {t("leagueUx.viewAll")}
                  <ArrowRight className="size-3.5" />
                </Button>
              }
            >
              {league.status === "registration" ? (
                <div className="grid gap-3 xl:grid-cols-2">
                  {activeEntries.map((entry) => (
                    <Link
                      key={entry._id}
                      href={`${base}/teams/${entry._id}`}
                      className="flex items-center gap-3 py-2.5 hover:text-primary"
                    >
                      <RosterIcon
                        rosterId={entry.team.rosterId}
                        className="size-8"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">
                          {entry.team.name}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {entry.coachName}
                        </span>
                      </span>
                      {mine?._id === entry._id && (
                        <span className="text-xs text-primary">
                          {t("leagueUx.yourTeam")}
                        </span>
                      )}
                      <ArrowRight className="size-3.5" />
                    </Link>
                  ))}
                  {!activeEntries.length && (
                    <p className="py-3 text-sm text-muted-foreground">
                      {t("leagueUx.noParticipants")}
                    </p>
                  )}
                </div>
              ) : (
                <>
                  <div className="flex items-baseline justify-between gap-3">
                    <strong className="font-mono text-xl">
                      {finished}
                      <span className="text-sm font-normal text-muted-foreground">
                        {" "}
                        / {matches.length}
                      </span>
                    </strong>
                    <span className="text-xs text-muted-foreground">
                      {t("leagueUx.fixturesResolved")}
                    </span>
                  </div>
                  <progress
                    className="my-3 h-1.5 w-full accent-primary"
                    aria-label={t("leagueUx.seasonProgress")}
                    value={finished}
                    max={Math.max(matches.length, 1)}
                  />
                  {currentRound && (
                    <p className="text-xs text-muted-foreground">
                      {t("leagueUi.round")} {currentRound.number} ·{" "}
                      {t("leagueUi.deadline")}:{" "}
                      {leagueDate(currentRound.deadlineAt)}
                    </p>
                  )}
                  {unresolved.map((match) => (
                    <Link
                      key={match._id}
                      href={`${base}/matches/${match._id}`}
                      className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t pt-3 text-sm"
                    >
                      <span className="font-medium">
                        {entryById.get(match.homeEntryId)?.team.name}{" "}
                        <span className="font-normal text-muted-foreground">
                          {t("leagueUx.versus")}
                        </span>{" "}
                        {match.awayEntryId
                          ? entryById.get(match.awayEntryId)?.team.name
                          : t("leagueUi.bye")}
                      </span>
                      <LeagueStatus status={match.status} />
                    </Link>
                  ))}
                  {!unresolved.length && (
                    <p className="mt-3 text-sm text-muted-foreground">
                      {t("leagueUx.allCaughtUp")}
                    </p>
                  )}
                </>
              )}
            </LeagueSection>
          </div>
          <aside className="space-y-4">
            {data.canCommission && (
              <LeagueSection
                title={
                  <span className="flex items-center gap-2">
                    <ShieldCheck className="size-4" />
                    {t("leagueUx.commissionerDesk")}
                  </span>
                }
              >
                <p className="text-sm">
                  {t(
                    league.status === "registration"
                      ? activeEntries.length < 2
                        ? "leagueUx.inviteMinimum"
                        : "leagueUx.readyToLaunch"
                      : readyRound
                        ? "leagueUx.readyForRound"
                        : waitingReports.length
                          ? "leagueUx.reportsWaiting"
                          : pendingPostgame.length
                            ? "leagueUx.postgamesWaiting"
                            : "leagueUx.noCommissionerTasks",
                  )}
                </p>
                <Button
                  className="mt-3 w-full"
                  variant={mine ? "outline" : "default"}
                  onClick={() => setTab("manage")}
                >
                  {t("leagueUx.manage")}
                  <ArrowRight className="size-4" />
                </Button>
              </LeagueSection>
            )}
            <LeagueSection title={t("leagueUx.leagueDetails")}>
              <p className="mb-4 text-sm">
                <span className="text-muted-foreground">
                  {t("leagueUx.startingTreasury")}
                </span>
                <br />
                <strong>
                  {(
                    league.startingTreasury ?? DEFAULT_LEAGUE_TREASURY
                  ).toLocaleString("uk-UA")}{" "}
                  {t("leagueUx.goldUnit")}
                </strong>
              </p>
              <dl className="space-y-3 text-xs">
                <div className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">
                    {t("leagueUx.format")}
                  </dt>
                  <dd>{t("leagueUi.roundRobin")}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">
                    {t("leagueUx.scoring")}
                  </dt>
                  <dd>{t("leagueUi.points")}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">
                    {t("leagueRoundDays")}
                  </dt>
                  <dd>{league.roundDays}</dd>
                </div>
              </dl>
              <details className="mt-3 border-t pt-3 text-xs">
                <summary className="cursor-pointer text-muted-foreground">
                  {t("leagueUx.tiebreaks")}
                </summary>
                <p className="mt-2">{t("leagueUi.tiebreakOrder")}</p>
              </details>
            </LeagueSection>
          </aside>
        </div>
      )}
      {tab === "manage" &&
        data.canCommission &&
        league.status === "registration" && (
          <LeagueSection
            title={t("leagueUx.setupChecklist")}
            action={
              <Button
                disabled={
                  entries.filter((entry) => !entry.withdrawn).length < 2 ||
                  action.busy
                }
                onClick={() => void action.run(() => launch({ leagueId: id }))}
              >
                <Flag className="size-4" />
                {t("leagueUi.launch")}
              </Button>
            }
          >
            <ol className="grid gap-3 md:grid-cols-3">
              {[
                {
                  label: t("leagueUx.setupInvite"),
                  done: copied || activeEntries.length >= 2,
                  detail: t("leagueUx.inviteCoaches"),
                },
                {
                  label: t("leagueUx.setupTeams"),
                  done: activeEntries.length >= 2,
                  detail: `${activeEntries.length} / 2 ${t("leagueUi.coaches")}`,
                },
                {
                  label: t("leagueUx.setupLaunch"),
                  done: false,
                  detail: t("leagueUi.launchHint"),
                },
              ].map((item, index) => (
                <li
                  key={item.label}
                  className="rounded-lg border bg-secondary/20 p-4"
                >
                  <span
                    className={`mb-3 flex size-8 items-center justify-center rounded-full text-sm ${item.done ? "bg-primary text-primary-foreground" : "border bg-card text-muted-foreground"}`}
                  >
                    {item.done ? <Check className="size-4" /> : index + 1}
                  </span>
                  <p className="text-sm font-semibold">{item.label}</p>
                  <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                    {item.detail}
                  </p>
                </li>
              ))}
            </ol>
          </LeagueSection>
        )}
      {tab === "fixtures" && (
        <div className="space-y-5">
          {visibleRound ? (
            <>
              <div className="flex flex-wrap items-center justify-between gap-4">
                <label className="flex items-center gap-3 text-sm font-medium">
                  {t("leagueUi.round")}
                  <LeagueSelect
                    className="min-w-40"
                    value={visibleRound._id}
                    onChange={(event) => setSelectedRound(event.target.value)}
                  >
                    {rounds.map((round) => (
                      <option key={round._id} value={round._id}>
                        {t("leagueUi.round")} {round.number} ·{" "}
                        {t(`leagueUi.status.${round.status}`)}
                      </option>
                    ))}
                  </LeagueSelect>
                </label>
                <span className="text-sm text-muted-foreground">
                  {t("leagueUi.deadline")}:{" "}
                  {leagueDate(visibleRound.deadlineAt)}
                </span>
              </div>
              <LeagueSection
                title={`${t("leagueUi.round")} ${visibleRound.number}`}
                action={<LeagueStatus status={visibleRound.status} />}
              >
                <div className="divide-y overflow-hidden rounded-lg border">
                  {roundMatches.map((match) => {
                    const home = entryById.get(match.homeEntryId);
                    const away = match.awayEntryId
                      ? entryById.get(match.awayEntryId)
                      : null;
                    const isMine =
                      !!mine &&
                      (home?._id === mine._id || away?._id === mine._id);
                    return (
                      <article
                        key={match._id}
                        className={`px-3 py-2.5 ${isMine ? "bg-primary/[0.03]" : "bg-card"}`}
                      >
                        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                          <LeagueStatus status={match.status} />
                          {isMine && (
                            <span className="text-xs font-semibold text-primary">
                              {t("leagueUx.yourFixture")}
                            </span>
                          )}
                        </div>
                        <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3 sm:gap-6">
                          <div className="flex min-w-0 items-center gap-3">
                            {home && (
                              <RosterIcon
                                rosterId={home.team.rosterId}
                                className="hidden size-8 sm:inline-flex"
                              />
                            )}
                            <div className="min-w-0">
                              <p className="break-words text-sm font-semibold sm:text-base">
                                {home?.team.name}
                              </p>
                              <p className="mt-1 break-words text-xs text-muted-foreground">
                                {home?.coachName}
                              </p>
                            </div>
                          </div>
                          <span className="rounded-md bg-secondary/60 px-3 py-1 text-center font-mono text-base font-semibold tabular-nums sm:min-w-20">
                            {match.administrativeResult
                              ? "—"
                              : match.status === "bye"
                                ? "—"
                                : match.status === "scheduled"
                                  ? t("leagueUx.versus")
                                  : `${match.scoreHome} : ${match.scoreAway}`}
                          </span>
                          <div className="flex min-w-0 items-center justify-end gap-3 text-right">
                            <div className="min-w-0">
                              <p className="break-words text-sm font-semibold sm:text-base">
                                {away?.team.name ?? t("leagueUi.bye")}
                              </p>
                              <p className="mt-1 break-words text-xs text-muted-foreground">
                                {away?.coachName}
                              </p>
                            </div>
                            {away && (
                              <RosterIcon
                                rosterId={away.team.rosterId}
                                className="hidden size-8 sm:inline-flex"
                              />
                            )}
                          </div>
                        </div>
                        <div className="mt-1 flex flex-wrap items-center justify-end gap-3">
                          {match.administrativeResult && (
                            <span className="text-xs text-muted-foreground">
                              {t("leagueUi." + match.administrativeResult)}
                            </span>
                          )}
                          {away && (
                            <Link
                              href={`${base}/matches/${match._id}`}
                              className="inline-flex min-h-10 items-center gap-2 text-sm font-medium text-primary hover:underline"
                            >
                              {t("leagueUi.openReport")}
                              <ArrowRight className="size-4" />
                            </Link>
                          )}
                        </div>
                      </article>
                    );
                  })}
                </div>
              </LeagueSection>
            </>
          ) : (
            <div className="rounded-2xl border border-dashed bg-card px-6 py-12 text-center">
              <CalendarDays className="mx-auto mb-4 size-8 text-muted-foreground" />
              <p className="font-medium">{t("leagueUi.noFixtures")}</p>
              {data.canCommission && (
                <Button
                  variant="outline"
                  className="mt-5 h-11"
                  onClick={() => setTab("manage")}
                >
                  {t("leagueUx.commissionerDesk")}
                </Button>
              )}
            </div>
          )}
        </div>
      )}
      {tab === "manage" && data.canCommission && (
        <div className="space-y-6">
          <div>
            <h2 className="text-xl font-semibold">
              {t("leagueUx.commissionerDesk")}
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              {t("leagueUx.manageHint")}
            </p>
          </div>
          {league.status !== "registration" && (
            <LeagueSection title={t("leagueUx.needsAttention")}>
              <div className="divide-y">
                {unresolved.map((match) => (
                  <Link
                    key={match._id}
                    href={`${base}/matches/${match._id}`}
                    className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm"
                  >
                    <span>
                      {entryById.get(match.homeEntryId)?.team.name} ·{" "}
                      {match.awayEntryId
                        ? entryById.get(match.awayEntryId)?.team.name
                        : t("leagueUi.bye")}
                    </span>
                    <span className="flex items-center gap-2">
                      <LeagueStatus status={match.status} />
                      <ArrowRight className="size-4" />
                    </span>
                  </Link>
                ))}
                {pendingPostgame.map((entry) => (
                  <Link
                    key={entry._id}
                    href={`${base}/teams/${entry._id}`}
                    className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm"
                  >
                    <span>{entry.team.name}</span>
                    <span className="flex items-center gap-2 text-xs text-muted-foreground">
                      {t("leagueUx.finishPostgame")}
                      <ArrowRight className="size-4" />
                    </span>
                  </Link>
                ))}
                {!unresolved.length && !pendingPostgame.length && (
                  <p className="py-2 text-sm text-muted-foreground">
                    {t(
                      readyRound
                        ? "leagueUx.readyForRound"
                        : "leagueUx.noCommissionerTasks",
                    )}
                  </p>
                )}
              </div>
            </LeagueSection>
          )}
          {rounds.length > 0 && (
            <LeagueSection title={t("leagueUx.roundManagement")}>
              <LeagueField className="mb-5 max-w-sm">
                {t("leagueUi.round")}
                <LeagueSelect
                  value={visibleRound?._id ?? ""}
                  onChange={(event) => setSelectedRound(event.target.value)}
                >
                  {rounds.map((round) => (
                    <option key={round._id} value={round._id}>
                      {t("leagueUi.round")} {round.number} ·{" "}
                      {t(`leagueUi.status.${round.status}`)}
                    </option>
                  ))}
                </LeagueSelect>
              </LeagueField>
              {visibleRound && (
                <RoundControls
                  key={visibleRound._id}
                  round={visibleRound}
                  busy={action.busy}
                  onOpen={() =>
                    action.run(() => openRound({ roundId: visibleRound._id }))
                  }
                  onDeadline={(deadlineAt) =>
                    action.run(() =>
                      extendRound({ roundId: visibleRound._id, deadlineAt }),
                    )
                  }
                />
              )}
            </LeagueSection>
          )}
          <details className="rounded-lg border bg-card p-4">
            <summary className="cursor-pointer text-sm font-semibold text-destructive">
              {t("leagueUi.withdrawEntry")}
            </summary>
            <div className="mt-5">
              <CommissionerWithdrawal entries={entries} />
            </div>
          </details>
          <LeagueSection title={t("leagueUx.deleteLeague")}>
            <p className="text-sm text-muted-foreground">
              {t("leagueUx.deleteLeagueHint")}
            </p>
            <LeagueDeleteDialog leagueId={id} name={league.name} />
          </LeagueSection>
        </div>
      )}
      {tab === "standings" && (
        <LeagueSection
          title={t("leagueUi.standings")}
          action={
            <Button
              variant="outline"
              className="h-10"
              aria-pressed={detailedStats}
              onClick={() => setDetailedStats(!detailedStats)}
            >
              {t(detailedStats ? "leagueUx.keyStats" : "leagueUx.allStats")}
            </Button>
          }
        >
          <LeagueStatTable
            firstLabel={t("team")}
            showRank
            columns={
              detailedStats
                ? teamColumns
                : ["pts", "mp", "w", "d", "l", "td", "cas", "latest"]
            }
            rows={standings.map((row, index) => ({
              id: row.entryId,
              name: row.teamName,
              detail: row.coachName,
              href: `${base}/teams/${row.entryId}`,
              values: {
                ...row,
                rank: index + 1,
                latest: row.latest.join(" · "),
                td: `${row.tdFor}:${row.tdAgainst}`,
                cas: `${row.casFor}:${row.casAgainst}`,
              },
            }))}
          />
        </LeagueSection>
      )}
      {tab === "players" && (
        <LeagueSection
          title={t("leagueUi.playerStats")}
          action={
            <Button
              variant="outline"
              className="h-10"
              aria-pressed={detailedStats}
              onClick={() => setDetailedStats(!detailedStats)}
            >
              {t(detailedStats ? "leagueUx.keyStats" : "leagueUx.allStats")}
            </Button>
          }
        >
          <LeagueStatTable
            firstLabel={t("players")}
            columns={
              detailedStats
                ? playerColumns
                : ["sppEarned", "available", "mp", "td", "cas", "mvp"]
            }
            rows={data.playerStats.map((player) => ({
              id: player.playerId,
              name: leaguePlayerLabel(
                player.name,
                getRoster(
                  entryById.get(player.entryId)!.team.rosterId,
                )?.players.find((position) => position.id === player.positionId)
                  ?.position ?? player.positionId,
                playerNumbers.get(player.playerId)!,
              ),
              detail: `${player.teamName} · ${player.coachName}`,
              href: `${base}/teams/${player.entryId}`,
              values: {
                ...player.stats,
                sppEarned: player.sppEarned,
                sppSpent: player.sppSpent,
                available: player.sppEarned - player.sppSpent,
              },
            }))}
          />
        </LeagueSection>
      )}
      {tab === "participants" && (
        <LeagueSection title={t("leagueUi.participants")}>
          {!entries.length && (
            <p className="py-4 text-sm text-muted-foreground">
              {t("leagueUx.noParticipants")}
            </p>
          )}
          <div className="divide-y">
            {entries.map((entry) => (
              <Link
                key={entry._id}
                href={`${base}/teams/${entry._id}`}
                className="flex items-center gap-3 px-2 py-3 hover:bg-secondary/30"
              >
                <RosterIcon
                  rosterId={entry.team.rosterId}
                  className="size-9 shrink-0"
                />
                <div className="min-w-0">
                  <p className="break-words font-semibold">{entry.team.name}</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {entry.coachName}
                    {entry.withdrawn
                      ? " · " + t("leagueUi.status.withdrawn")
                      : ""}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {getRoster(entry.team.rosterId)?.name}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </LeagueSection>
      )}
      {tab === "history" && (
        <LeagueSection title={t("leagueUi.history")}>
          <LeagueHistory records={audit.results} />
          {audit.status === "LoadingFirstPage" ? (
            <HistoryLoading label={t("loading")} />
          ) : !audit.results.length ? (
            <p className="text-sm text-muted-foreground">
              {t("leagueUi.noHistory")}
            </p>
          ) : null}
          {(audit.status === "CanLoadMore" ||
            audit.status === "LoadingMore") && (
            <Button
              variant="outline"
              className="mt-4"
              disabled={audit.status === "LoadingMore"}
              onClick={() => audit.loadMore(15)}
            >
              {t(
                audit.status === "LoadingMore"
                  ? "loading"
                  : "leagueUi.loadMore",
              )}
            </Button>
          )}
        </LeagueSection>
      )}
    </div>
  );
}

function RoundControls({
  round,
  busy,
  onOpen,
  onDeadline,
}: {
  round: { status: string; deadlineAt: number };
  busy: boolean;
  onOpen: () => Promise<boolean>;
  onDeadline: (value: number) => Promise<boolean>;
}) {
  const t = useTranslations();
  const [deadline, setDeadline] = useState("");
  return (
    <div className="mb-4 flex flex-wrap items-end gap-3 rounded-lg border bg-secondary/20 p-3">
      {round.status === "pending" && (
        <Button className="h-10" disabled={busy} onClick={() => void onOpen()}>
          {t("leagueUi.openRound")}
        </Button>
      )}
      <LeagueField className="min-w-48 flex-1">
        {t("leagueUi.deadline")}
        <Input
          className="mt-1 h-10"
          type="datetime-local"
          value={deadline || localDateInput(round.deadlineAt)}
          onChange={(event) => setDeadline(event.target.value)}
        />
      </LeagueField>
      <Button
        className="h-10"
        variant="outline"
        disabled={
          busy || !deadline || !Number.isFinite(new Date(deadline).getTime())
        }
        onClick={() => void onDeadline(new Date(deadline).getTime())}
      >
        {t("leagueUi.changeDeadline")}
      </Button>
    </div>
  );
}
