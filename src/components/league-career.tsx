"use client";
import { useContentTitle } from "@/lib/use-content-title";

import { Fragment, useState } from "react";
import Link from "next/link";
import {
  useConvexAuth,
  useMutation,
  usePaginatedQuery,
  useQuery,
} from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { useTranslations } from "gt-next";
import {
  Check,
  ChevronDown,
  ChevronRight,
  Coins,
  ShieldCheck,
  TrendingUp,
  Users,
  Settings2,
  History,
  ChartNoAxesColumn,
  Search,
} from "lucide-react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { getRoster, skillName } from "@/domain/catalog";
import { expensiveMistake } from "@/domain/league-rules";
import { canEnrollTeam } from "@/lib/league-team-eligibility";
import {
  leaguePlayerLabel,
  leaguePlayerNumbers,
} from "@/lib/league-player-label";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { LeagueField, LeagueSelect } from "./league-field";
import { LeagueTeamPicker } from "./league-team-picker";
import { LeagueNavigation } from "./league-navigation";
import { LeagueEmptyState, LeaguePageHeader } from "./league-layout";
import { PlayerIcon, RosterIcon } from "./player-icon";
import { SkillList, TableSkills } from "./skill-box";
import { LeagueHelp } from "./league-help";
import { LeagueRecruitment } from "./league-recruitment";
import { LeagueFormSection } from "./league-dialog";
import { LeaguePlayerDialog } from "./league-player-dialog";
import { positionLabel } from "./position-name";
import {
  CommissionerAdvancementUndo,
  CommissionerTreasury,
} from "./league-commissioner";
import {
  DiceInput,
  LeagueBack,
  LeagueError,
  LeagueGate,
  LeagueHistory,
  LeagueSection,
  LeagueStatTable,
  LeagueStatus,
  useLeagueAction,
} from "./league-ui";

type CareerData = NonNullable<FunctionReturnType<typeof api.leagues.getCareer>>;
type CareerPlayer = CareerData["players"][number];

function CareerReplacement({
  entry,
  startingTreasury,
}: {
  entry: CareerData["entry"];
  startingTreasury?: number;
}) {
  const t = useTranslations();
  const viewer = useQuery(api.users.viewer, {});
  const [pickerOpen, setPickerOpen] = useState(false);
  const [uuid, setUuid] = useState("");
  const teams = usePaginatedQuery(
    api.teams.listMine,
    viewer?.id === entry.coachId && (pickerOpen || uuid)
      ? { archived: false }
      : "skip",
    { initialNumItems: 30 },
  );
  const replace = useMutation(api.leagues.replaceEntryTeam);
  const action = useLeagueAction();
  if (viewer?.id !== entry.coachId) return null;
  return (
    <LeagueSection title={t("leagueUi.replaceTeam")}>
      <p className="mb-4 text-sm text-muted-foreground">
        {t("leagueUi.replacementHint")}
      </p>
      <LeagueError message={action.error} />
      <div className="flex flex-wrap gap-3">
        <LeagueTeamPicker
          onOpenChange={setPickerOpen}
          startingTreasury={startingTreasury}
          teams={teams.results}
          value={uuid}
          onChange={setUuid}
          status={teams.status}
          loadMore={() => teams.loadMore(30)}
          excludeUuid={entry.team.uuid}
          disabled={action.busy}
        />
        <Button
          className="h-11"
          disabled={
            action.busy ||
            !teams.results.some(
              (row) =>
                row.team.uuid === uuid &&
                row.team.uuid !== entry.team.uuid &&
                canEnrollTeam(row, startingTreasury),
            )
          }
          onClick={() =>
            void action.run(async () => {
              await replace({
                entryId: entry._id,
                teamUuid: uuid,
                expectedRevision: entry.revision,
              });
              setUuid("");
            })
          }
        >
          {t("leagueUi.replaceTeam")}
        </Button>
      </div>
    </LeagueSection>
  );
}

function PostGamePanel({
  treasury,
  revision,
  busy,
  onComplete,
}: {
  treasury: number;
  revision: number;
  busy: boolean;
  onComplete: (dice: {
    mistakeRoll?: number;
    minorRoll?: number;
    stashRolls?: number[];
  }) => Promise<boolean>;
}) {
  const t = useTranslations();
  const [draft, setDraft] = useState<{
    revision: number;
    mistake: number | null;
    minor: number | null;
    stash: [number | null, number | null];
  } | null>(null);
  const current =
    draft?.revision === revision
      ? draft
      : {
          revision,
          mistake: null,
          minor: null,
          stash: [null, null] as [number | null, number | null],
        };
  const { mistake, minor, stash } = current;
  let kind: string | null = null;
  let remaining: number | null = null;
  try {
    kind = expensiveMistake(treasury, mistake ?? undefined, 1, [1, 1]).kind;
  } catch {
    /* Dice still need to be recorded. */
  }
  try {
    remaining = expensiveMistake(
      treasury,
      mistake ?? undefined,
      minor ?? undefined,
      stash[0] !== null && stash[1] !== null ? [stash[0], stash[1]] : undefined,
    ).treasury;
  } catch {
    /* Display the required dice before enabling completion. */
  }
  return (
    <LeagueSection title={t("leagueUi.completePostgame")}>
      <p className="mb-4 text-sm text-muted-foreground">
        {t("leagueUi.postgameHint")}
      </p>
      <div className="grid gap-3 sm:grid-cols-3">
        {treasury >= 100000 && (
          <DiceInput
            label={t("leagueUi.mistakeRoll")}
            sides={6}
            value={mistake}
            onChange={(mistake) => setDraft({ ...current, mistake })}
          />
        )}
        {kind === "minor-incident" && (
          <DiceInput
            label={t("leagueUi.minorRoll")}
            sides={3}
            value={minor}
            onChange={(minor) => setDraft({ ...current, minor })}
          />
        )}
        {kind === "catastrophe" && (
          <>
            {[0, 1].map((index) => (
              <DiceInput
                key={index}
                label={t("leagueUi.stashRoll") + " " + (index + 1)}
                sides={6}
                value={stash[index]}
                onChange={(value) =>
                  setDraft({
                    ...current,
                    stash: index === 0 ? [value, stash[1]] : [stash[0], value],
                  })
                }
              />
            ))}
          </>
        )}
      </div>
      {remaining !== null && (
        <p className="mt-4 text-sm">
          {t("leagueUi.treasuryAfter")}:{" "}
          <span className="font-mono font-semibold">
            {remaining / 1000}k GP
          </span>
        </p>
      )}
      <Button
        className="mt-4 h-11"
        disabled={busy || remaining === null}
        onClick={() =>
          void onComplete({
            mistakeRoll: mistake ?? undefined,
            minorRoll: minor ?? undefined,
            stashRolls:
              stash[0] !== null && stash[1] !== null
                ? [stash[0], stash[1]]
                : undefined,
          })
        }
      >
        {t("leagueUi.completePostgame")}
      </Button>
    </LeagueSection>
  );
}

const careerColumns = [
  "sppEarned",
  "sppSpent",
  "available",
  "mp",
  "td",
  "cas",
  "sppCas",
  "com",
  "int",
  "mvp",
  "superbThrows",
  "safeLandings",
  "fou",
  "sof",
  "inj",
  "dth",
] as const;

export function LeagueCareer({
  leagueId,
  entryId,
}: {
  leagueId: string;
  entryId: string;
}) {
  const t = useTranslations();
  const auth = useConvexAuth();
  const id = entryId as Id<"leagueTeams">;
  const data = useQuery(
    api.leagues.getCareer,
    auth.isAuthenticated ? { entryId: id } : "skip",
  );
  useContentTitle(
    data && String(data.league._id) === leagueId
      ? `${data.entry.team.name} · ${data.league.name}`
      : undefined,
  );
  const advance = useMutation(api.leagues.advancePlayer);
  const hire = useMutation(api.leagues.hirePlayer);
  const retire = useMutation(api.leagues.retirePlayer);
  const rename = useMutation(api.leagues.renamePlayer);
  const renameTeam = useMutation(api.leagues.renameTeam);
  const complete = useMutation(api.leagues.completePostGame);
  const staff = useMutation(api.leagues.manageStaff);
  const hireJourneyman = useMutation(api.leagues.hireJourneyman);
  const setCaptain = useMutation(api.leagues.setCaptain);
  const action = useLeagueAction();
  const [teamName, setTeamName] = useState<string | null>(null);
  const [captainId, setCaptainId] = useState("");
  const [tab, setTab] = useState<
    "roster" | "management" | "commissioner" | "stats" | "history"
  >("roster");
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const [showFormer, setShowFormer] = useState(false);
  const [playerSearch, setPlayerSearch] = useState("");
  const [rosterFilter, setRosterFilter] = useState("all");
  if (auth.isLoading || !auth.isAuthenticated || data === undefined)
    return (
      <LeagueGate
        variant="league-career"
        authenticated={auth.isAuthenticated}
        loading={auth.isLoading || auth.isAuthenticated}
      />
    );
  if (!data || String(data.league._id) !== leagueId)
    return (
      <div className="page-width py-8">
        <LeagueBack />
        <LeagueEmptyState
          icon={<Users className="size-6" />}
          title={t("leagueUi.notFound")}
          description={t("leagueUx.notFoundHint")}
        />
      </div>
    );
  const { entry, league, players } = data;
  const roster = getRoster(entry.team.rosterId);
  const positions = roster?.players ?? [];
  const playerNumbers = leaguePlayerNumbers(
    players.map((player) => ({ id: player._id, entryId: entry._id })),
  );
  const playerLabel = (player: CareerPlayer) =>
    leaguePlayerLabel(
      player.name,
      positionLabel(
        positions.find((position) => position.id === player.positionId)
          ?.position ?? player.positionId,
      ),
      playerNumbers.get(player._id)!,
    );
  const active = players.filter(
    (player) =>
      !player.temporary &&
      player.status !== "dead" &&
      player.status !== "retired",
  );
  const readyPlayers = players.filter((player) =>
    player.availableAdvancements.some(
      (option) => option.cost <= player.sppEarned - player.sppSpent,
    ),
  );
  const visiblePlayers = players.filter(
    (player) =>
      (showFormer ||
        (player.status !== "dead" && player.status !== "retired")) &&
      (rosterFilter === "all" ||
        (rosterFilter === "ready"
          ? readyPlayers.some((ready) => ready._id === player._id)
          : player.status === "missing-next-game" ||
            player.status === "dead" ||
            player.status === "retired")) &&
      `${playerLabel(player)} ${positions.find((position) => position.id === player.positionId)?.position ?? ""}`
        .toLocaleLowerCase()
        .includes(playerSearch.trim().toLocaleLowerCase()),
  );
  return (
    <div className="page-width space-y-5 py-6 sm:py-8">
      <LeagueBack href={`/leagues/manage/${leagueId}`}>
        {league.name}
      </LeagueBack>
      <LeaguePageHeader
        title={entry.team.name}
        eyebrow={t("leagueUx.officialCareer")}
        status={
          entry.withdrawn ? <LeagueStatus status="withdrawn" /> : undefined
        }
        icon={<RosterIcon rosterId={entry.team.rosterId} className="size-9" />}
        description={
          <p>
            {entry.coachName} · {roster?.name}
          </p>
        }
      >
        <span className="inline-flex items-center gap-2">
          <Coins className="size-4" />
          {t("leagueUi.treasury")}: {(entry.treasury / 1000).toLocaleString()}k
          GP
        </span>
        <span>
          {active.length} / 16 {t("players")}
        </span>
        {data.canCommission && (
          <span className="inline-flex items-center gap-2 text-primary">
            <ShieldCheck className="size-4" />
            {t("leagueUi.commissioner")}
          </span>
        )}
        {!data.canManage && !data.canCommission && (
          <span>{t("leagueUx.readOnlyCareer")}</span>
        )}
      </LeaguePageHeader>
      <LeagueError message={action.error} />
      {data.canManage && entry.postGamePending && (
        <section
          className="rounded-lg border border-primary/20 bg-secondary/40 p-4"
          aria-label={t("leagueUx.careerPostgameTitle")}
        >
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="font-semibold">
                {t("leagueUx.careerPostgameTitle")}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {t("leagueUx.careerPostgameHint")}
              </p>
            </div>
            <Button className="min-h-11" onClick={() => setTab("management")}>
              {t("leagueUx.careerManageTeam")}
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </section>
      )}
      <LeagueNavigation<typeof tab>
        label={t("leagueUx.careerNavigation")}
        value={tab}
        onChange={setTab}
        items={[
          {
            value: "roster",
            label: t("leagueUx.careerTab.roster"),
            icon: Users,
            badge: active.length,
          },
          ...(data.canManage
            ? [
                {
                  value: "management" as const,
                  label: t("leagueUx.careerTab.management"),
                  icon: Settings2,
                  badge: entry.postGamePending ? 1 : 0,
                },
              ]
            : []),
          {
            value: "stats",
            label: t("leagueUx.careerTab.stats"),
            icon: ChartNoAxesColumn,
          },
          {
            value: "history",
            label: t("leagueUx.careerTab.history"),
            icon: History,
          },
          ...(data.canCommission
            ? [
                {
                  value: "commissioner" as const,
                  label: t("leagueUx.careerTab.commissioner"),
                  icon: ShieldCheck,
                },
              ]
            : []),
        ]}
      />
      <div hidden={tab !== "roster"}>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[
            [t("leagueUi.teamValue"), data.teamValue],
            [t("leagueUi.currentTeamValue"), data.currentTeamValue],
            [t("leagueUi.dedicatedFans"), entry.team.staff.dedicatedFans],
            [t("leagueDesk.readyToAdvance"), readyPlayers.length],
          ].map(([label, value]) => (
            <div
              key={String(label)}
              className="min-w-0 rounded-lg border bg-card p-4"
            >
              <p className="text-[11px] leading-4 text-muted-foreground sm:text-xs">
                {label}
              </p>
              <p className="mt-1 font-mono text-base font-semibold">
                {label === t("leagueUi.dedicatedFans") ||
                label === t("leagueDesk.readyToAdvance")
                  ? value
                  : Number(value) / 1000 + "k GP"}
              </p>
            </div>
          ))}
        </div>
      </div>
      <div hidden={tab !== "management"} className="space-y-5">
        {data.canManage && entry.postGamePending && (
          <div className="grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => {
                setRosterFilter("all");
                setTab("roster");
              }}
              className="flex items-center justify-between gap-3 rounded-lg border bg-card p-4 text-left hover:bg-secondary/30"
            >
              <div>
                <p className="text-xs text-muted-foreground">
                  {t("leagueDesk.availablePlayers")}
                </p>
                <p className="mt-1 font-mono text-xl font-semibold">
                  {
                    players.filter((player) => player.status === "active")
                      .length
                  }
                </p>
              </div>
              <Users className="size-5 text-primary" />
            </button>
            <button
              type="button"
              onClick={() => {
                setRosterFilter("ready");
                setTab("roster");
              }}
              className="flex items-center justify-between gap-3 rounded-lg border bg-card p-4 text-left hover:bg-secondary/30"
            >
              <div>
                <p className="text-xs text-muted-foreground">
                  {t("leagueDesk.readyToAdvance")}
                </p>
                <p className="mt-1 font-mono text-xl font-semibold">
                  {readyPlayers.length}
                </p>
              </div>
              <TrendingUp className="size-5 text-primary" />
            </button>
          </div>
        )}
        {data.canManage && !entry.postGamePending && (
          <div className="flex items-start gap-3 rounded-xl border bg-card p-5">
            <Check className="mt-0.5 size-5 shrink-0 text-primary" />
            <div>
              <h2 className="font-semibold">
                {t("leagueUx.careerBetweenGames")}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {t("leagueUx.careerBetweenGamesHint")}
              </p>
            </div>
          </div>
        )}
        {data.canManage &&
          roster?.specialRules.includes("Team Captain") &&
          !entry.team.captainId && (
            <LeagueSection title={t("leagueUi.assignCaptain")}>
              <div className="flex flex-wrap items-end gap-3">
                <LeagueField className="min-w-48 flex-1">
                  {t("leagueUi.chooseCaptain")}
                  <LeagueSelect
                    className="h-11"
                    value={captainId}
                    onChange={(event) => setCaptainId(event.target.value)}
                  >
                    <option value="">{t("leagueUi.choosePlayer")}</option>
                    {active
                      .filter(
                        (player) =>
                          player.status === "active" &&
                          !player.skills.includes("pro") &&
                          !positions
                            .find(
                              (position) => position.id === player.positionId,
                            )
                            ?.position.includes("Big Guy"),
                      )
                      .map((player) => (
                        <option key={player._id} value={player._id}>
                          {playerLabel(player)}
                        </option>
                      ))}
                  </LeagueSelect>
                </LeagueField>
                <Button
                  className="h-11"
                  disabled={action.busy || !captainId}
                  onClick={() =>
                    void action.run(() =>
                      setCaptain({
                        entryId: id,
                        playerId: captainId as Id<"leaguePlayers">,
                        expectedRevision: entry.revision,
                      }),
                    )
                  }
                >
                  {t("leagueUi.assignCaptain")}
                </Button>
              </div>
            </LeagueSection>
          )}
      </div>
      {entry.activeMatchId && (
        <Link
          href={`/leagues/manage/${leagueId}/matches/${entry.activeMatchId}`}
          className="flex items-center justify-between gap-3 rounded-lg border bg-secondary/30 px-4 py-3 text-sm"
        >
          {t("leagueUx.rosterLocked")}
          <span className="flex shrink-0 items-center gap-2 font-medium text-primary">
            {t("leagueUi.matchReport")}
            <ChevronRight className="size-4" />
          </span>
        </Link>
      )}
      <div hidden={tab !== "management"} className="space-y-5">
        {data.canManage && entry.postGamePending && entry.hiringClosed && (
          <p className="rounded-xl border bg-secondary/20 p-4 text-sm text-muted-foreground">
            {t("leagueUi.hiringClosedHint")}
          </p>
        )}
        {data.canManage && entry.postGamePending && (
          <LeagueSection title={t("leagueUi.staff")}>
            <p className="mb-4 text-sm text-muted-foreground">
              {t("leagueUx.careerStaffHint")}
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              {(
                [
                  "rerolls",
                  "apothecary",
                  "assistantCoaches",
                  "cheerleaders",
                ] as const
              ).map((key) => {
                const cost =
                  key === "rerolls"
                    ? (roster?.rerolls.cost ?? 0) * 2
                    : key === "apothecary"
                      ? 50000
                      : 10000;
                const max =
                  key === "rerolls"
                    ? (roster?.rerolls.max ?? 8)
                    : key === "apothecary"
                      ? roster?.apothecary
                        ? 1
                        : 0
                      : 6;
                return (
                  <div
                    key={key}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-card p-4"
                  >
                    <div>
                      <p className="text-sm font-semibold">{t(key)}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {t("leagueDesk.staffOwned")}: {entry.team.staff[key]} /{" "}
                        {max}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        className="h-10"
                        variant="outline"
                        disabled={
                          action.busy ||
                          entry.team.staff[key] >= max ||
                          cost > entry.treasury
                        }
                        onClick={() =>
                          void action.run(() =>
                            staff({
                              entryId: id,
                              staff: key,
                              change: 1,
                              expectedRevision: entry.revision,
                            }),
                          )
                        }
                      >
                        {t("leagueUi.buy")} · {cost / 1000}k GP
                      </Button>
                      <Button
                        className="h-10"
                        variant="ghost"
                        disabled={
                          action.busy ||
                          entry.team.staff[key] === 0 ||
                          key === "rerolls"
                        }
                        onClick={() =>
                          void action.run(() =>
                            staff({
                              entryId: id,
                              staff: key,
                              change: -1,
                              expectedRevision: entry.revision,
                            }),
                          )
                        }
                      >
                        {t("leagueUi.dismiss")}
                      </Button>
                    </div>
                    {(entry.team.staff[key] >= max ||
                      cost > entry.treasury) && (
                      <p className="w-full text-xs text-muted-foreground">
                        {t(
                          entry.team.staff[key] >= max
                            ? "leagueDesk.stockLimit"
                            : "leagueDesk.notEnoughGold",
                        )}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </LeagueSection>
        )}
      </div>
      <div hidden={tab !== "roster"}>
        <LeagueSection
          title={t("leagueUx.careerRoster")}
          action={
            <span className="text-xs text-muted-foreground">
              {visiblePlayers.length} {t("players")}
            </span>
          }
        >
          <div className="mb-4 flex flex-wrap gap-2">
            <label className="relative min-w-40 flex-1">
              <Search
                className="pointer-events-none absolute left-3 top-3 size-4 text-muted-foreground"
                aria-hidden="true"
              />
              <Input
                aria-label={t("leagueUx.rosterSearch")}
                placeholder={t("leagueUx.rosterSearch")}
                value={playerSearch}
                onChange={(event) => setPlayerSearch(event.target.value)}
                className="h-10 bg-card pl-9"
              />
            </label>
            <LeagueSelect
              aria-label={t("leagueDesk.rosterFilter")}
              value={rosterFilter}
              onChange={(event) => setRosterFilter(event.target.value)}
              wrapperClassName="w-full sm:w-52"
              className="h-10"
            >
              <option value="all">{t("leagueDesk.allPlayers")}</option>
              <option value="ready">{t("leagueDesk.readyToAdvance")}</option>
              <option value="unavailable">{t("leagueDesk.unavailable")}</option>
            </LeagueSelect>
          </div>
          {players.some(
            (player) => player.status === "dead" || player.status === "retired",
          ) && (
            <Button
              variant="outline"
              className="mb-4 min-h-11"
              aria-pressed={showFormer}
              onClick={() => setShowFormer(!showFormer)}
            >
              {t(
                showFormer
                  ? "leagueUx.careerHideFormer"
                  : "leagueUx.careerShowFormer",
              )}
            </Button>
          )}
          <div className="divide-y overflow-hidden rounded-lg border md:hidden">
            {visiblePlayers.map((player) => {
              const position = positions.find(
                (item) => item.id === player.positionId,
              );
              const available = player.sppEarned - player.sppSpent;
              return (
                <button
                  key={player._id}
                  type="button"
                  onClick={() => setSelectedPlayerId(player._id)}
                  className="flex w-full min-w-0 items-center gap-3 bg-card px-3 py-3 text-left hover:bg-secondary/30 focus-visible:outline-2 focus-visible:outline-ring"
                >
                  <PlayerIcon
                    positionId={player.positionId}
                    className="size-10 shrink-0"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block break-words text-sm font-semibold">
                      {playerLabel(player)}
                    </span>
                    <span className="mt-1 block text-xs text-muted-foreground">
                      {positionLabel(position?.position ?? player.positionId)} ·{" "}
                      {((position?.cost ?? 0) + player.valueIncrease) / 1000}k
                      GP
                    </span>
                    {player.status !== "active" && (
                      <span className="mt-1 block">
                        <LeagueStatus status={player.status} />
                      </span>
                    )}
                  </span>
                  <span className="shrink-0 text-center">
                    <span className="block font-mono text-sm font-semibold text-primary">
                      {available}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      SPP
                    </span>
                  </span>
                  <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                </button>
              );
            })}
          </div>
          <div className="hidden overflow-x-auto rounded-lg border md:block">
            <table className="w-full min-w-[760px] border-collapse text-xs">
              <caption className="sr-only">
                {t("leagueUx.careerRoster")}
              </caption>
              <thead className="border-b bg-secondary/30 text-muted-foreground">
                <tr>
                  <th scope="col" className="w-9 px-2 py-1.5 font-normal">
                    #
                  </th>
                  <th
                    scope="col"
                    className="w-44 px-2 py-1.5 text-left font-medium"
                  >
                    {t("player")}
                  </th>
                  {(["ma", "st", "ag", "pa", "av"] as const).map((stat) => (
                    <th scope="col" key={stat} className="w-9 text-center">
                      <LeagueHelp stat={stat} profile />
                    </th>
                  ))}
                  <th scope="col" className="px-2 text-left font-medium">
                    {t("skills")}
                  </th>
                  <th scope="col" className="w-16 text-center">
                    <LeagueHelp stat="available" label="SPP" />
                  </th>
                  <th scope="col" className="w-16 px-2 text-right font-medium">
                    {t("leagueUi.playerValue")}
                  </th>
                  <th scope="col" className="w-8">
                    <span className="sr-only">{t("managePlayer")}</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {visiblePlayers.map((player) => {
                  const position = positions.find(
                    (position) => position.id === player.positionId,
                  );
                  const available = player.sppEarned - player.sppSpent;
                  const ready = player.availableAdvancements.some(
                    (option) => option.cost <= available,
                  );
                  const selected = selectedPlayerId === player._id;
                  const toggle = () =>
                    setSelectedPlayerId(selected ? null : player._id);
                  return (
                    <Fragment key={player._id}>
                      <tr
                        className={`group cursor-pointer border-b last:border-b-0 hover:bg-secondary/30 focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-[-2px] ${selected ? "bg-secondary/30" : ""}`}
                        tabIndex={0}
                        aria-label={`${t("managePlayer")} · ${playerLabel(player)}`}
                        aria-expanded={selected}
                        aria-controls={`career-player-${player._id}`}
                        onClick={(event) => {
                          if (
                            !(event.target as HTMLElement).closest("button, a")
                          )
                            toggle();
                        }}
                        onKeyDown={(event) => {
                          if (
                            event.target === event.currentTarget &&
                            ["Enter", " "].includes(event.key)
                          ) {
                            event.preventDefault();
                            toggle();
                          }
                        }}
                      >
                        <td className="px-2 py-2 text-center font-mono text-muted-foreground">
                          {String(playerNumbers.get(player._id)).padStart(
                            2,
                            "0",
                          )}
                        </td>
                        <th
                          scope="row"
                          className="px-2 py-2 text-left font-normal"
                        >
                          <div className="flex items-center gap-2">
                            <PlayerIcon
                              positionId={player.positionId}
                              className="size-8 shrink-0"
                            />
                            <div className="min-w-0">
                              <button
                                type="button"
                                onClick={toggle}
                                aria-expanded={selected}
                                aria-controls={`career-player-${player._id}`}
                                className="text-left text-sm font-semibold text-primary hover:underline"
                              >
                                {player.name ||
                                  positionLabel(
                                    position?.position ?? player.positionId,
                                  )}
                              </button>
                              {player.name && (
                                <p className="mt-0.5 text-xs text-muted-foreground">
                                  {positionLabel(
                                    position?.position ?? player.positionId,
                                  )}
                                </p>
                              )}
                              <div className="flex flex-wrap gap-1">
                                {player.status !== "active" && (
                                  <LeagueStatus status={player.status} />
                                )}
                                {player.temporary && (
                                  <span className="text-[10px] text-muted-foreground">
                                    {t("leagueUx.careerJourneyman")}
                                  </span>
                                )}
                                {ready && entry.postGamePending && (
                                  <span className="flex items-center gap-1 text-[10px] text-primary">
                                    <TrendingUp className="size-3" />
                                    {t("leagueUx.careerReadyToAdvance")}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </th>
                        {(["ma", "st", "ag", "pa", "av"] as const).map(
                          (stat) => (
                            <td
                              key={stat}
                              className="px-1 py-2 text-center font-mono"
                            >
                              {player.effectiveStats[stat]}
                            </td>
                          ),
                        )}
                        <td className="px-2 py-1">
                          <TableSkills
                            ids={position?.skills ?? []}
                            additionalIds={player.skills.filter(
                              (id) => !position?.skills.includes(id),
                            )}
                            captain={
                              entry.team.captainId === player.sourcePlayerId
                            }
                            label={t("skills")}
                          />
                        </td>
                        <td
                          className={`px-2 py-2 text-center font-mono ${ready ? "font-semibold text-primary" : ""}`}
                        >
                          {available}
                        </td>
                        <td className="px-2 py-2 text-right font-mono">
                          {((position?.cost ?? 0) + player.valueIncrease) /
                            1000}
                          k
                        </td>
                        <td className="px-2">
                          <ChevronDown
                            className={`size-3.5 text-muted-foreground ${selected ? "rotate-180" : ""}`}
                          />
                        </td>
                      </tr>
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
            {players.length === 0 && (
              <p className="p-6 text-sm text-muted-foreground">
                {t("leagueUx.careerEmptyRoster")}
              </p>
            )}
          </div>
          {!visiblePlayers.length && (
            <div className="py-6 text-center">
              <p className="text-sm text-muted-foreground">
                {t(
                  playerSearch || rosterFilter !== "all"
                    ? "leagueUx.noSearchResults"
                    : "leagueUx.careerEmptyRoster",
                )}
              </p>
              {(playerSearch || rosterFilter !== "all") && (
                <Button
                  variant="outline"
                  className="mt-3"
                  onClick={() => {
                    setPlayerSearch("");
                    setRosterFilter("all");
                  }}
                >
                  {t("leagueUx.clearFilters")}
                </Button>
              )}
            </div>
          )}
          {players.map((player) => (
            <LeaguePlayerDialog
              key={player._id}
              open={selectedPlayerId === player._id}
              onClose={() => setSelectedPlayerId(null)}
              title={playerLabel(player)}
            >
              <CareerPlayerCard
                key={player._id}
                player={player}
                displayName={playerLabel(player)}
                error={action.error}
                position={positions.find(
                  (position) => position.id === player.positionId,
                )}
                canManage={data.canManage}
                canCommission={data.canCommission}
                postGamePending={entry.postGamePending}
                captain={entry.team.captainId === player.sourcePlayerId}
                onHireJourneyman={() =>
                  action.run(() =>
                    hireJourneyman({
                      playerId: player._id,
                      expectedRevision: entry.revision,
                    }),
                  )
                }
                busy={action.busy}
                revision={entry.revision}
                onAdvance={(skillId) =>
                  action.run(() =>
                    advance({
                      playerId: player._id,
                      skillId,
                      expectedRevision: entry.revision,
                    }),
                  )
                }
                onRename={(value) =>
                  action.run(() =>
                    rename({
                      playerId: player._id,
                      name: value,
                      expectedRevision: entry.revision,
                    }),
                  )
                }
                onRetire={() =>
                  action.run(() =>
                    retire({
                      playerId: player._id,
                      expectedRevision: entry.revision,
                    }),
                  )
                }
              />
            </LeaguePlayerDialog>
          ))}
        </LeagueSection>
      </div>
      <div hidden={tab !== "management"} className="space-y-5">
        {data.canManage && entry.postGamePending && !entry.hiringClosed && (
          <LeagueRecruitment
            positions={positions}
            players={active}
            treasury={entry.treasury}
            blockedPositionIds={entry.blockedPositionIds}
            busy={action.busy}
            error={action.error}
            onHire={(positionId, name) =>
              action.run(() =>
                hire({
                  entryId: id,
                  positionId,
                  name: name || undefined,
                  expectedRevision: entry.revision,
                }),
              )
            }
          />
        )}
        {data.canManage && entry.postGamePending && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card p-5">
            <div>
              <h2 className="font-semibold">{t("leagueUi.spendSpp")}</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {t("leagueUx.careerAdvanceHint")}
              </p>
            </div>
            <Button
              variant="outline"
              className="min-h-11"
              onClick={() => setTab("roster")}
            >
              <TrendingUp className="size-4" />
              {t("leagueUx.careerReviewPlayers")}
            </Button>
          </div>
        )}
        {data.canManage && entry.postGamePending && (
          <PostGamePanel
            key={`postgame-completion:${entry._id}`}
            treasury={entry.treasury}
            revision={entry.revision}
            busy={action.busy}
            onComplete={(dice) =>
              action.run(() =>
                complete({
                  entryId: id,
                  expectedRevision: entry.revision,
                  ...dice,
                }),
              )
            }
          />
        )}
      </div>
      <div hidden={tab !== "management"}>
        <details className="rounded-xl border bg-card">
          <summary className="cursor-pointer px-5 py-4 text-sm font-semibold">
            {t("leagueUx.careerTeamSettings")}
          </summary>
          <div className="space-y-4 border-t p-4 sm:p-5">
            {data.canManage && (
              <LeagueSection title={t("leagueUi.teamIdentity")}>
                <form
                  className="flex flex-wrap gap-3"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void action
                      .run(() =>
                        renameTeam({
                          entryId: id,
                          name: (teamName ?? entry.team.name).trim(),
                          expectedRevision: entry.revision,
                        }),
                      )
                      .then((saved) => {
                        if (saved) setTeamName(null);
                      });
                  }}
                >
                  <Input
                    aria-label={t("teamName")}
                    className="h-11 min-w-48 flex-1"
                    maxLength={80}
                    value={teamName ?? entry.team.name}
                    onChange={(event) => setTeamName(event.target.value)}
                    required
                  />
                  <Button
                    type="submit"
                    className="h-11"
                    disabled={
                      action.busy || teamName === null || !teamName.trim()
                    }
                  >
                    {t("leagueUi.rename")}
                  </Button>
                </form>
              </LeagueSection>
            )}

            {data.canManage && !entry.firstPlayedAt && !entry.activeMatchId && (
              <CareerReplacement
                entry={entry}
                startingTreasury={league.startingTreasury}
              />
            )}
          </div>
        </details>
      </div>
      {data.canCommission && (
        <div hidden={tab !== "commissioner"} className="space-y-3">
          <p className="flex items-center gap-2 text-xs text-muted-foreground">
            <ShieldCheck className="size-4" />
            {t("leagueUx.commissionerTools")}
          </p>
          {data.canCommission && !entry.activeMatchId && (
            <CommissionerTreasury
              key={`commissioner-treasury:${entry._id}`}
              entryId={entry._id}
              treasury={entry.treasury}
              revision={entry.revision}
            />
          )}

          {entry.activeMatchId && (
            <Link
              href={`/leagues/manage/${leagueId}/matches/${entry.activeMatchId}`}
              className="inline-flex items-center gap-2 text-sm font-medium text-primary"
            >
              {t("leagueUi.errors.MATCH_IN_PROGRESS")}
              <ChevronRight className="size-4" />
            </Link>
          )}
        </div>
      )}
      <div hidden={tab !== "stats"}>
        <LeagueSection title={t("leagueUi.playerStats")}>
          <LeagueStatTable
            firstLabel={t("players")}
            columns={careerColumns}
            rows={players.map((player) => ({
              id: player._id,
              name: playerLabel(player),
              detail: t(`leagueUi.status.${player.status}`),
              values: {
                ...player.stats,
                sppEarned: player.sppEarned,
                sppSpent: player.sppSpent,
                available: player.sppEarned - player.sppSpent,
              },
            }))}
          />
        </LeagueSection>
      </div>
      <div hidden={tab !== "history"}>
        <LeagueSection title={t("leagueUi.rosterHistory")}>
          <LeagueHistory records={data.history} />
          {!data.history.length && (
            <p className="text-sm text-muted-foreground">
              {t("leagueUi.noHistory")}
            </p>
          )}
          <Link
            href={`/leagues/manage/${leagueId}?view=history`}
            className="mt-4 inline-flex min-h-10 items-center text-sm text-primary hover:underline"
          >
            {t("leagueUi.fullHistory")} →
          </Link>
        </LeagueSection>
      </div>
    </div>
  );
}

function CareerPlayerCard({
  error,
  player,
  displayName,
  position,
  canManage,
  canCommission,
  postGamePending,
  captain,
  onHireJourneyman,
  busy,
  revision,
  onAdvance,
  onRename,
  onRetire,
}: {
  error: string;
  player: CareerPlayer;
  displayName: string;
  position?: {
    position: string;
    skills: string[];
    ma: number;
    st: number;
    ag: string;
    pa: string;
    av: string;
    cost: number;
  };
  canManage: boolean;
  canCommission: boolean;
  postGamePending: boolean;
  captain: boolean;
  onHireJourneyman: () => Promise<boolean>;
  busy: boolean;
  revision: number;
  onAdvance: (skillId: string) => Promise<boolean>;
  onRename: (name: string) => Promise<boolean>;
  onRetire: () => Promise<boolean>;
}) {
  const t = useTranslations();
  const [skillId, setSkillId] = useState("");
  const [newName, setNewName] = useState<string | null>(null);
  const [retiring, setRetiring] = useState(false);
  const [editRevision, setEditRevision] = useState<number | null>(null);
  const available = player.sppEarned - player.sppSpent;
  const choice = player.availableAdvancements.find(
    (option) => option.skillId === skillId,
  );
  const alive = player.status !== "dead" && player.status !== "retired";
  const stale = editRevision !== null && editRevision !== revision;
  return (
    <article className="min-w-0 space-y-5 p-5">
      <div className="-mx-5 -mt-5 flex flex-wrap items-start justify-between gap-3 border-b bg-secondary/40 p-5 pr-12">
        <div className="flex min-w-0 items-center gap-3">
          <PlayerIcon
            positionId={player.positionId}
            className="size-10 shrink-0"
          />
          <div className="min-w-0">
            <h3 className="display-font break-words text-xl">{displayName}</h3>
            {player.name && (
              <p className="text-xs text-muted-foreground">
                {positionLabel(position?.position ?? player.positionId)}
              </p>
            )}
          </div>
        </div>
        <LeagueStatus status={player.status} />
      </div>
      <LeagueError message={error} />
      {position && (
        <dl className="grid grid-cols-5 divide-x rounded-lg border bg-secondary/25 py-3 text-center text-xs">
          {(
            [
              ["MA", player.effectiveStats.ma],
              ["ST", player.effectiveStats.st],
              ["AG", player.effectiveStats.ag],
              ["PA", player.effectiveStats.pa],
              ["AV", player.effectiveStats.av],
            ] as const
          ).map(([label, value]) => (
            <div key={label}>
              <dt className="text-muted-foreground">
                <LeagueHelp stat={label.toLowerCase()} profile />
              </dt>
              <dd className="mt-1 font-mono font-semibold">{value}</dd>
            </div>
          ))}
        </dl>
      )}
      <SkillList
        ids={position?.skills ?? []}
        additionalIds={player.skills.filter(
          (id) => !position?.skills.includes(id),
        )}
        captain={captain}
      />
      <dl className="grid grid-cols-3 divide-x rounded-lg border bg-secondary/25 py-4 text-center">
        <div>
          <dt className="text-xs text-muted-foreground">
            {t("leagueUi.stats.sppEarned")}
          </dt>
          <dd className="mt-1 font-mono text-lg font-semibold">
            {player.sppEarned}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">
            {t("leagueUi.stats.sppSpent")}
          </dt>
          <dd className="mt-1 font-mono text-lg font-semibold">
            {player.sppSpent}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">
            {t("leagueUi.stats.available")}
          </dt>
          <dd className="mt-1 font-mono text-lg font-semibold text-primary">
            {available}
          </dd>
        </div>
      </dl>
      <p className="mt-3 text-xs text-muted-foreground">
        {t("leagueUi.playerValue")}:{" "}
        {((position?.cost ?? 0) + player.valueIncrease) / 1000}k GP ·{" "}
        {player.advancements.length}/6 {t("leagueUi.advancements")}
      </p>
      <p className="mt-2 text-xs text-muted-foreground">
        {t("leagueUi.nigglingInjuries")}: {player.nigglingInjuries}
        {player.injuryNotes ? " · " + player.injuryNotes : ""}
      </p>
      {canManage && postGamePending && player.canHireJourneyman && (
        <Button
          className="mt-4 h-10 w-full"
          disabled={busy || player.status === "dead"}
          onClick={() => void onHireJourneyman()}
        >
          {t("leagueUi.hireJourneyman")}
        </Button>
      )}
      {canManage &&
        (alive ||
          (player.temporary && player.availableAdvancements.length > 0)) && (
          <>
            <form
              className={
                postGamePending ? "space-y-4 rounded-lg border p-4" : "hidden"
              }
              onSubmit={(event) => {
                event.preventDefault();
                if (
                  busy ||
                  !choice ||
                  choice.cost > available ||
                  !postGamePending
                )
                  return;
                void onAdvance(skillId).then((saved) => {
                  if (saved) setSkillId("");
                });
              }}
            >
              <AdvancementPicker
                options={player.availableAdvancements}
                available={available}
                value={skillId}
                onChange={setSkillId}
                disabled={busy}
              />
              {choice && (
                <div className="rounded-lg border bg-secondary/30 p-3">
                  <SkillList ids={[choice.skillId]} />
                  <p className="mt-2 text-xs text-muted-foreground">
                    {t("leagueDesk.afterAdvancement")}:{" "}
                    <strong>{available - choice.cost} SPP</strong> · +
                    {choice.valueIncrease / 1000}k GP
                  </p>
                </div>
              )}
              <Button
                className="h-10 w-full"
                type="submit"
                disabled={busy || !choice || choice.cost > available}
              >
                <TrendingUp className="size-4" />
                {t("leagueUi.buyAdvancement")}
                {choice ? ` · ${choice.cost} SPP` : ""}
              </Button>
              {!player.availableAdvancements.length && (
                <p className="text-xs text-muted-foreground">
                  {t("leagueUi.noAdvancements")}
                </p>
              )}
            </form>
            {!player.temporary && (
              <div className="flex flex-wrap gap-2 border-t pt-4">
                <Button
                  variant="outline"
                  className="h-10"
                  disabled={busy}
                  onClick={() => {
                    setNewName(player.name);
                    setEditRevision(revision);
                  }}
                >
                  {t("leagueUi.rename")}
                </Button>
                <Button
                  variant="destructive"
                  className="h-10"
                  disabled={busy || !postGamePending}
                  onClick={() => {
                    setRetiring(true);
                    setEditRevision(revision);
                  }}
                >
                  {t("leagueUi.dismiss")}
                </Button>
              </div>
            )}
            {newName !== null && (
              <form
                className="mt-3 flex flex-wrap gap-2"
                onSubmit={(event) => {
                  event.preventDefault();
                  void onRename(newName.trim()).then((saved) => {
                    if (saved) {
                      setNewName(null);
                      setEditRevision(null);
                    }
                  });
                }}
              >
                <Input
                  aria-label={t("leagueUi.playerName")}
                  value={newName}
                  maxLength={80}
                  required
                  className="h-10 min-w-40 flex-1"
                  onChange={(event) => setNewName(event.target.value)}
                />
                <Button
                  type="submit"
                  className="h-10"
                  disabled={busy || !newName.trim() || stale}
                >
                  {t("saveChanges")}
                </Button>
                <Button
                  variant="ghost"
                  className="h-10"
                  onClick={() => {
                    setNewName(null);
                    setEditRevision(null);
                  }}
                >
                  {t("cancel")}
                </Button>
              </form>
            )}
            {retiring && (
              <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-4">
                <p className="text-sm">{t("leagueUi.dismissHint")}</p>
                <div className="mt-3 flex gap-3">
                  <Button
                    variant="destructive"
                    className="h-10"
                    disabled={busy || stale}
                    onClick={() =>
                      void onRetire().then((saved) => {
                        if (saved) {
                          setRetiring(false);
                          setEditRevision(null);
                        }
                      })
                    }
                  >
                    {t("leagueUi.confirmDismiss")}
                  </Button>
                  <Button
                    variant="outline"
                    className="h-10"
                    onClick={() => {
                      setRetiring(false);
                      setEditRevision(null);
                    }}
                  >
                    {t("cancel")}
                  </Button>
                </div>
              </div>
            )}
            {stale && (
              <p role="status" className="mt-3 text-sm text-muted-foreground">
                {t("leagueUi.careerChanged")}
              </p>
            )}
          </>
        )}
      {canCommission && player.canUndoAdvancement && (
        <details className="mt-4 border-t pt-4">
          <summary className="cursor-pointer text-sm text-muted-foreground">
            {t("leagueUx.careerCommissionerCorrection")}
          </summary>
          <CommissionerAdvancementUndo
            playerId={player._id}
            revision={revision}
          />
        </details>
      )}
    </article>
  );
}

function AdvancementPicker({
  options,
  available,
  value,
  onChange,
  disabled,
}: {
  options: CareerPlayer["availableAdvancements"];
  available: number;
  value: string;
  onChange: (value: string) => void;
  disabled: boolean;
}) {
  const t = useTranslations();
  const [search, setSearch] = useState("");
  const visible = options.filter((option) =>
    skillName(option.skillId)
      .toLocaleLowerCase()
      .includes(search.trim().toLocaleLowerCase()),
  );
  return (
    <LeagueFormSection title={t("leagueUi.spendSpp")}>
      <Input
        aria-label={t("leagueDesk.searchSkills")}
        placeholder={t("leagueDesk.searchSkills")}
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        className="h-10"
      />
      <div className="grid max-h-60 gap-2 overflow-y-auto overscroll-contain sm:grid-cols-2">
        {visible.map((option) => (
          <button
            type="button"
            key={option.skillId}
            aria-pressed={value === option.skillId}
            disabled={disabled || option.cost > available}
            onClick={() => onChange(option.skillId)}
            className={`flex items-start justify-between gap-3 rounded-md border px-3 py-2 text-left disabled:opacity-45 focus-visible:outline-2 focus-visible:outline-ring ${value === option.skillId ? "border-primary bg-secondary" : "enabled:hover:bg-secondary/40"}`}
          >
            <span className="text-xs font-medium">
              {skillName(option.skillId)}
              <span className="mt-1 block text-[10px] font-normal text-muted-foreground">
                +{option.valueIncrease / 1000}k GP
              </span>
            </span>
            <span className="shrink-0 font-mono text-xs text-primary">
              {option.cost} SPP
            </span>
          </button>
        ))}
      </div>
      {!visible.length && (
        <p className="text-xs text-muted-foreground">
          {t(search ? "leagueUx.noSearchResults" : "leagueUi.noAdvancements")}
        </p>
      )}
    </LeagueFormSection>
  );
}
