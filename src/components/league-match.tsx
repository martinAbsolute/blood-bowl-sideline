"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import type { FunctionArgs, FunctionReturnType } from "convex/server";
import { ConvexError } from "convex/values";
import { useTranslations } from "gt-next";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  Circle,
  LoaderCircle,
  LockKeyhole,
  ShieldCheck,
} from "lucide-react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { getRoster } from "@/domain/catalog";
import { calculateWinnings, casualtyOutcome } from "@/domain/league-rules";
import {
  leaguePlayerLabel,
  snapshotPlayerNumber,
} from "@/lib/league-player-label";
import { useBeforeUnload } from "@/lib/use-before-unload";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Textarea } from "./ui/textarea";
import { LeagueField, LeagueSelect } from "./league-field";
import { PlayerIcon } from "./player-icon";
import { SkillList } from "./skill-box";
import { LeagueHelp } from "./league-help";
import { positionLabel } from "./position-name";
import { CommissionerRuling } from "./league-commissioner";
import {
  DiceInput,
  LeagueBack,
  LeagueError,
  LeagueGate,
  LeagueSection,
  LeagueStatus,
  useLeagueAction,
} from "./league-ui";

type MatchData = FunctionReturnType<typeof api.leagues.getMatch>;
type ReportPlayer = MatchData["players"][number];
type DetailsPatch = Omit<
  FunctionArgs<typeof api.leagues.updateMatchDetails>,
  "matchId" | "expectedRevision"
>;
type PlayerPatch = Omit<
  FunctionArgs<typeof api.leagues.patchMatchPlayer>,
  "matchId" | "playerId"
>;
type Step = "pre-game" | "game" | "post-game";
const steps: Step[] = ["pre-game", "game", "post-game"];
const fields = [
  "td",
  "cas",
  "sppCas",
  "com",
  "int",
  "mvp",
  "fou",
  "sof",
  "superbThrows",
  "safeLandings",
  "inj",
  "dth",
] as const;

function patchedPlayer(player: ReportPlayer, patch: PlayerPatch): ReportPlayer {
  const next = {
    ...player,
    ...patch,
    stats: { ...player.stats, ...patch.stats },
  };
  if (patch.statusAfter !== undefined)
    next.stats.dth = patch.statusAfter === "dead" ? 1 : 0;
  if (
    next.casualtyRoll !== null &&
    (patch.casualtyRoll !== undefined || patch.lastingRoll !== undefined)
  ) {
    try {
      const result = casualtyOutcome(next.casualtyRoll, next.lastingRoll ?? 1);
      next.statusAfter = result.dead
        ? "dead"
        : result.missNextGame
          ? "missing-next-game"
          : "active";
      next.stats.inj = Math.max(1, next.stats.inj);
      next.stats.dth = result.dead ? 1 : 0;
    } catch {
      /* Invalid input is reported by the mutation. */
    }
  }
  return next;
}

export function LeagueMatch({
  leagueId,
  matchId,
}: {
  leagueId: string;
  matchId: string;
}) {
  const t = useTranslations();
  const auth = useConvexAuth();
  const id = matchId as Id<"leagueMatches">;
  const data = useQuery(
    api.leagues.getMatch,
    auth.isAuthenticated ? { matchId: id } : "skip",
  );
  const history = useQuery(
    api.leagues.getMatchHistory,
    auth.isAuthenticated ? { matchId: id } : "skip",
  );
  const start = useMutation(api.leagues.startMatch);
  const confirm = useMutation(api.leagues.confirmMatch);
  const correct = useMutation(api.leagues.correctMatch);
  const updateDetails = useMutation(
    api.leagues.updateMatchDetails,
  ).withOptimisticUpdate((store, args) => {
    const current = store.getQuery(api.leagues.getMatch, {
      matchId: args.matchId,
    });
    if (!current) return;
    const { matchId: _id, expectedRevision: _revision, ...patch } = args;
    void _id;
    void _revision;
    store.setQuery(
      api.leagues.getMatch,
      { matchId: args.matchId },
      {
        ...current,
        match: { ...current.match, ...patch, confirmedBy: [] },
      },
    );
  });
  const updatePlayer = useMutation(
    api.leagues.patchMatchPlayer,
  ).withOptimisticUpdate((store, args) => {
    const current = store.getQuery(api.leagues.getMatch, {
      matchId: args.matchId,
    });
    if (!current) return;
    store.setQuery(
      api.leagues.getMatch,
      { matchId: args.matchId },
      {
        ...current,
        match: { ...current.match, confirmedBy: [] },
        players: current.players.map((player) =>
          player.playerId === args.playerId
            ? patchedPlayer(player, args)
            : player,
        ),
      },
    );
  });
  const action = useLeagueAction();
  const [step, setStep] = useState<Step>("pre-game");
  const [selectedSide, setSide] = useState<"home" | "away" | null>(null);
  const [correction, setCorrection] = useState<MatchData | null>(null);
  const [reason, setReason] = useState("");
  const pendingCount = useRef(0);
  const [pending, setPending] = useState(0);
  const failedEdits = useRef(
    new Map<string, { run: () => Promise<unknown>; message: string }>(),
  );
  const [syncError, setSyncError] = useState("");
  useBeforeUnload(pending > 0 || !!correction || !!syncError);

  async function edit(key: string, run: () => Promise<unknown>) {
    // Do not block unrelated fields or navigation while a mutation is in flight.
    // Lock-in does wait, so it can only acknowledge an entirely persisted report.
    failedEdits.current.delete(key);
    pendingCount.current += 1;
    setPending(pendingCount.current);
    try {
      await run();
    } catch (cause) {
      const code =
        cause instanceof ConvexError && typeof cause.data === "string"
          ? cause.data
          : "UNKNOWN";
      failedEdits.current.set(key, {
        run,
        message: t(`leagueUi.errors.${code}`),
      });
    } finally {
      pendingCount.current -= 1;
      setPending(pendingCount.current);
      setSyncError([...failedEdits.current.values()][0]?.message ?? "");
    }
  }
  function changeDetails(patch: DetailsPatch) {
    if (correction)
      setCorrection({
        ...correction,
        match: { ...correction.match, ...patch },
      });
    else
      void edit(`details:${Object.keys(patch).join(",")}`, () =>
        updateDetails({ matchId: id, ...patch }),
      );
  }
  function changePlayer(player: ReportPlayer, patch: PlayerPatch) {
    if (correction)
      setCorrection({
        ...correction,
        players: correction.players.map((row) =>
          row._id === player._id ? patchedPlayer(row, patch) : row,
        ),
      });
    else
      void edit(
        `player:${player._id}:${Object.keys(patch.stats ?? patch).join(",")}`,
        () =>
          updatePlayer({ matchId: id, playerId: player.playerId, ...patch }),
      );
  }
  if (auth.isLoading || !auth.isAuthenticated || data === undefined)
    return (
      <LeagueGate
        authenticated={auth.isAuthenticated}
        loading={auth.isLoading || auth.isAuthenticated}
      />
    );
  if (!data || String(data.league._id) !== leagueId)
    return (
      <div className="page-width py-8">
        <LeagueBack />
        <p>{t("leagueUi.notFound")}</p>
      </div>
    );

  const view = correction ?? data;
  const { match, league, home, away } = view;
  const teamSide =
    selectedSide ?? (away?.coachId === data.viewerId ? "away" : "home");
  const base = `/leagues/manage/${leagueId}`;
  const locked = data.match.status === "completed";
  const editable = (data.canEdit && !locked) || !!correction;
  const staleCorrection =
    !!correction && correction.match.revision !== data.match.revision;
  const dice = (value: number | null | undefined, sides: number) =>
    value != null && Number.isInteger(value) && value >= 1 && value <= sides;
  const checks = [
    {
      ready:
        dice(match.homeFanRoll, 3) &&
        dice(match.awayFanRoll, 3) &&
        (match.scoreHome === match.scoreAway ||
          (dice(match.homeFansRoll, 6) && dice(match.awayFansRoll, 6))),
      label: t("leagueUx.reportCheckRolls"),
      step: (dice(match.homeFanRoll, 3) && dice(match.awayFanRoll, 3)
        ? "post-game"
        : "pre-game") as Step,
    },
    {
      ready: [home, away].every(
        (entry) =>
          entry &&
          view.players
            .filter((player) => player.entryId === entry._id)
            .reduce((sum, player) => sum + player.stats.td, 0) ===
            (entry._id === home._id ? match.scoreHome : match.scoreAway),
      ),
      label: t("leagueUx.reportCheckTouchdowns"),
      step: "game" as Step,
    },
    {
      ready: [home, away].every(
        (entry) =>
          entry &&
          view.players
            .filter((player) => player.entryId === entry._id)
            .reduce((sum, player) => sum + player.stats.mvp, 0) === 1,
      ),
      label: t("leagueUx.reportCheckMvp"),
      step: "game" as Step,
    },
    {
      ready: view.players.every(
        (player) =>
          !(
            player.casualtyRoll !== null &&
            player.casualtyRoll >= 13 &&
            player.casualtyRoll <= 14 &&
            !dice(player.lastingRoll, 6)
          ),
      ),
      label: t("leagueUx.reportCheckInjuries"),
      step: "game" as Step,
    },
    {
      ready: !match.evidenceUrl || /^https:\/\//i.test(match.evidenceUrl),
      label: t("leagueUx.reportCheckEvidence"),
      step: "post-game" as Step,
    },
  ];
  const ready = checks.every((check) => check.ready);
  return (
    <div className="page-width space-y-4 py-5 sm:py-6">
      <header>
        <LeagueBack href={base}>{league.name}</LeagueBack>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="page-heading">{t("leagueUi.matchReport")}</h1>
          <LeagueStatus status={match.status} />
        </div>
        <p className="mt-3 text-sm text-muted-foreground">
          {t(
            match.administrativeResult
              ? "leagueUi.administrativeHint"
              : locked
                ? "leagueUi.lockedHint"
                : "leagueUi.sharedHint",
          )}
        </p>
      </header>
      <LeagueError message={action.error || syncError} />
      {syncError && (
        <Button
          variant="outline"
          onClick={() => {
            for (const [key, failed] of failedEdits.current)
              void edit(key, failed.run);
          }}
        >
          {t("leagueUx.reportRetry")}
        </Button>
      )}
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 rounded-lg border bg-card p-4 sm:gap-6 sm:p-5">
        {[home, away].map(
          (entry, index) =>
            entry && (
              <div
                key={entry._id}
                className={`min-w-0 ${index ? "col-start-3 text-right" : ""}`}
              >
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  {t(index ? "leagueUi.away" : "leagueUi.home")}
                </p>
                <Link
                  href={`${base}/teams/${entry._id}`}
                  className="mt-2 block break-words text-base font-semibold hover:text-primary sm:text-2xl"
                >
                  {entry.team.name}
                </Link>
                <p className="mt-2 text-xs text-muted-foreground">
                  {entry.coachName} · {getRoster(entry.team.rosterId)?.name}
                </p>
                <p
                  className={`mt-3 flex items-center gap-1.5 text-xs text-muted-foreground ${index ? "justify-end" : ""}`}
                >
                  {match.confirmedBy.includes(entry.coachId) ? (
                    <>
                      <CheckCircle2 className="size-4 text-primary" />
                      {t("leagueUi.confirmed")}
                    </>
                  ) : match.status === "in-progress" ? (
                    t("leagueUi.awaitingConfirmation")
                  ) : null}
                </p>
              </div>
            ),
        )}
        <div className="col-start-2 row-start-1 text-center font-mono text-3xl font-semibold tabular-nums sm:text-4xl">
          {match.administrativeResult ? (
            <span className="text-sm">
              {t("leagueUi." + match.administrativeResult)}
            </span>
          ) : match.status === "scheduled" ? (
            "— : —"
          ) : (
            `${match.scoreHome} : ${match.scoreAway}`
          )}
        </div>
      </div>
      {match.status === "scheduled" &&
        data.canEdit &&
        !home.withdrawn &&
        !away?.withdrawn && (
          <LeagueSection
            title={t("leagueUi.startReport")}
            action={
              <Button
                disabled={action.busy}
                onClick={() => void action.run(() => start({ matchId: id }))}
              >
                {t("leagueUi.start")}
              </Button>
            }
          >
            <p className="text-sm text-muted-foreground">
              {t("leagueUi.startHint")}
            </p>
          </LeagueSection>
        )}
      {match.status !== "scheduled" &&
        match.status !== "void" &&
        !match.administrativeResult && (
          <>
            <nav
              aria-label={t("leagueUi.matchReport")}
              className="grid grid-cols-3 border-b"
            >
              {steps.map((value, index) => (
                <button
                  key={value}
                  type="button"
                  aria-current={step === value ? "step" : undefined}
                  aria-controls={`report-${value}`}
                  onClick={() => setStep(value)}
                  className={`-mb-px flex min-h-14 items-center justify-center gap-2 border-b-2 px-2 text-sm font-medium focus-visible:outline-2 focus-visible:outline-primary ${step === value ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
                >
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full border border-current/30 text-xs">
                    {index + 1}
                  </span>
                  {t(
                    `leagueUx.report${value === "pre-game" ? "PreGame" : value === "game" ? "Game" : "PostGame"}`,
                  )}
                </button>
              ))}
            </nav>
            <p
              role="status"
              aria-live="polite"
              className="flex items-center gap-2 text-xs text-muted-foreground"
            >
              {pending ? (
                <LoaderCircle className="size-3.5 animate-spin" />
              ) : (
                <CheckCircle2 className="size-3.5" />
              )}
              {t(
                correction
                  ? "leagueUx.reportCorrectionDraft"
                  : pending
                    ? "leagueUx.reportSaving"
                    : syncError
                      ? "leagueUx.reportSyncFailed"
                      : "leagueUx.reportLive",
              )}
            </p>
            <div id="report-pre-game" hidden={step !== "pre-game"}>
              <LeagueSection title={t("leagueUx.reportPreGame")}>
                <fieldset
                  disabled={!editable || action.busy}
                  className="grid gap-4 sm:grid-cols-2"
                >
                  <LeagueField>
                    {t("leagueUx.reportWeather")}
                    <LeagueSelect
                      value={match.weather ?? ""}
                      onChange={(event) =>
                        changeDetails({
                          weather: event.target.value
                            ? Number(event.target.value)
                            : null,
                        })
                      }
                    >
                      <option value="">
                        {t("leagueUx.reportWeatherUnknown")}
                      </option>
                      {[2, 3, 4, 11, 12].map((roll) => (
                        <option key={roll} value={roll}>
                          {t(`leagueUx.reportWeather${roll}`)}
                        </option>
                      ))}
                    </LeagueSelect>
                  </LeagueField>
                  <LeagueField>
                    {t("leagueUi.venue")}
                    <Input
                      maxLength={160}
                      value={match.venue}
                      onChange={(event) =>
                        changeDetails({ venue: event.target.value })
                      }
                    />
                  </LeagueField>
                  {(["home", "away"] as const).map((side) => (
                    <div key={side} className="space-y-3 rounded-lg border p-4">
                      <h3 className="font-semibold">
                        {side === "home" ? home.team.name : away?.team.name}
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        {t("leagueUx.reportDedicatedFans")}:{" "}
                        {match[`${side}DedicatedFans`] ??
                          match[`${side}Snapshot`]?.staff.dedicatedFans ??
                          "—"}
                      </p>
                      <DiceInput
                        label={t("leagueUi.fanAttendanceRoll")}
                        sides={3}
                        value={match[`${side}FanRoll`]}
                        onChange={(value) =>
                          changeDetails({ [`${side}FanRoll`]: value })
                        }
                      />
                    </div>
                  ))}
                </fieldset>
              </LeagueSection>
            </div>
            <div
              id="report-game"
              hidden={step !== "game"}
              className="space-y-4"
            >
              <div className="flex flex-wrap gap-2">
                {[home, away].map(
                  (entry, index) =>
                    entry && (
                      <Button
                        key={entry._id}
                        variant={
                          teamSide === (index ? "away" : "home")
                            ? "default"
                            : "outline"
                        }
                        className="h-auto min-h-11 whitespace-normal"
                        aria-pressed={teamSide === (index ? "away" : "home")}
                        onClick={() => setSide(index ? "away" : "home")}
                      >
                        {entry.team.name}
                      </Button>
                    ),
                )}
              </div>
              <p className="text-sm text-muted-foreground">
                {t("leagueUx.reportPlayersHint")}
              </p>
              {[home, away].map(
                (entry, sideIndex) =>
                  entry && (
                    <div
                      key={entry._id}
                      hidden={teamSide !== (sideIndex ? "away" : "home")}
                    >
                      <LeagueSection title={entry.team.name}>
                        <div className="mb-4 flex flex-wrap gap-4 text-xs text-muted-foreground">
                          <span>
                            {t("leagueUx.reportTouchdowns")}:{" "}
                            <strong>
                              {view.players
                                .filter((p) => p.entryId === entry._id)
                                .reduce((sum, p) => sum + p.stats.td, 0)}{" "}
                              / {sideIndex ? match.scoreAway : match.scoreHome}
                            </strong>
                          </span>
                          <span>
                            {t("leagueUi.stats.mvp")}:{" "}
                            <strong>
                              {view.players
                                .filter((p) => p.entryId === entry._id)
                                .reduce((sum, p) => sum + p.stats.mvp, 0)}{" "}
                              / 1
                            </strong>
                          </span>
                        </div>
                        <div className="rounded-lg border">
                          <div className="grid grid-cols-[minmax(0,1fr)_repeat(3,2rem)_1rem] items-center gap-1 border-b bg-secondary/30 px-3 py-2 text-xs text-muted-foreground sm:grid-cols-[minmax(0,1fr)_repeat(6,3.25rem)_1.5rem]">
                            <span>{t("player")}</span>
                            {fields.slice(0, 6).map((field) => (
                              <span
                                key={field}
                                className={`text-center ${["td", "cas", "mvp"].includes(field) ? "" : "hidden sm:block"}`}
                              >
                                <LeagueHelp stat={field} />
                              </span>
                            ))}
                            <span />
                          </div>
                          {view.players
                            .filter((p) => p.entryId === entry._id)
                            .map((player, index) => (
                              <MatchPlayerRow
                                key={player._id}
                                player={player}
                                displayName={leaguePlayerLabel(
                                  player.name,
                                  positionLabel(player.snapshot.positionName),
                                  snapshotPlayerNumber(
                                    player.sourcePlayerId,
                                    entry._id === home._id
                                      ? match.homeSnapshot?.players
                                      : match.awaySnapshot?.players,
                                    index + 1,
                                  ),
                                )}
                                editable={editable && !action.busy}
                                onChange={(patch) =>
                                  changePlayer(player, patch)
                                }
                              />
                            ))}
                        </div>
                      </LeagueSection>
                    </div>
                  ),
              )}
            </div>
            <div
              id="report-post-game"
              hidden={step !== "post-game"}
              className="space-y-4"
            >
              <PostGame
                data={view}
                editable={editable && !action.busy}
                onChange={changeDetails}
              />
              <LeagueSection
                title={t(
                  correction
                    ? "leagueUi.correctReport"
                    : "leagueUi.confirmResult",
                )}
              >
                {(!locked || correction) && (
                  <ul className="mb-5 space-y-2">
                    {checks.map((check) => (
                      <li key={check.label}>
                        <button
                          type="button"
                          className="flex min-h-9 items-center gap-3 text-left text-sm hover:text-primary"
                          onClick={() => setStep(check.step)}
                        >
                          {check.ready ? (
                            <CheckCircle2 className="size-4 shrink-0 text-primary" />
                          ) : (
                            <Circle className="size-4 shrink-0 text-muted-foreground" />
                          )}
                          {check.label}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                {correction ? (
                  <div className="space-y-4">
                    <p className="text-sm text-muted-foreground">
                      {t("leagueUi.correctionHint")}
                    </p>
                    <LeagueField>
                      {t("leagueUi.reason")}
                      <Textarea
                        value={reason}
                        maxLength={1000}
                        onChange={(event) => setReason(event.target.value)}
                      />
                    </LeagueField>
                    {staleCorrection && (
                      <p role="alert" className="text-sm text-destructive">
                        {t("leagueUi.staleDraft")}
                      </p>
                    )}
                    <div className="flex flex-wrap gap-3">
                      <Button
                        disabled={
                          action.busy ||
                          !ready ||
                          staleCorrection ||
                          reason.trim().length < 3
                        }
                        onClick={() =>
                          void action
                            .run(() =>
                              correct({
                                matchId: id,
                                expectedRevision: correction.match.revision,
                                reason: reason.trim(),
                                scoreHome: match.scoreHome,
                                scoreAway: match.scoreAway,
                                weather: match.weather ?? null,
                                venue: match.venue,
                                evidenceUrl: match.evidenceUrl,
                                homeFanRoll: match.homeFanRoll,
                                awayFanRoll: match.awayFanRoll,
                                homeFansRoll: match.homeFansRoll,
                                awayFansRoll: match.awayFansRoll,
                                homeStalled: match.homeStalled,
                                awayStalled: match.awayStalled,
                                playerChanges: view.players
                                  .filter(
                                    (player) =>
                                      player.participated &&
                                      JSON.stringify(player) !==
                                        JSON.stringify(
                                          data.players.find(
                                            (row) =>
                                              row.playerId === player.playerId,
                                          ),
                                        ),
                                  )
                                  .map((player) => ({
                                    playerId: player.playerId,
                                    stats: player.stats,
                                    statusAfter: player.statusAfter,
                                    injuryNotes: player.injuryNotes,
                                    casualtyRoll: player.casualtyRoll,
                                    lastingRoll: player.lastingRoll,
                                  })),
                              }),
                            )
                            .then((saved) => {
                              if (saved) {
                                setCorrection(null);
                                setReason("");
                              }
                            })
                        }
                      >
                        {t("leagueUi.saveCorrection")}
                      </Button>
                      <Button
                        variant="outline"
                        disabled={action.busy}
                        onClick={() => {
                          setCorrection(null);
                          setReason("");
                        }}
                      >
                        {t("cancel")}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <>
                    <p className="mb-4 flex gap-2 text-sm text-muted-foreground">
                      {locked && <LockKeyhole className="size-4 shrink-0" />}
                      {t(
                        locked ? "leagueUi.lockedHint" : "leagueUi.confirmHint",
                      )}
                    </p>
                    {data.canConfirm && (
                      <Button
                        disabled={
                          action.busy || pending > 0 || !!syncError || !ready
                        }
                        onClick={() => {
                          if (pendingCount.current || failedEdits.current.size)
                            return;
                          void action.run(() =>
                            confirm({
                              matchId: id,
                              expectedRevision: data.match.revision,
                            }),
                          );
                        }}
                      >
                        <LockKeyhole className="size-4" />
                        {t("leagueUi.confirm")}
                      </Button>
                    )}
                  </>
                )}
              </LeagueSection>
            </div>
            <div className="flex items-center justify-between gap-3 border-t pt-4">
              <Button
                variant="ghost"
                disabled={step === "pre-game"}
                onClick={() => setStep(steps[steps.indexOf(step) - 1])}
              >
                <ArrowLeft className="size-4" />
                {t("leagueUx.reportPrevious")}
              </Button>
              {step !== "post-game" && (
                <Button
                  variant="outline"
                  onClick={() => setStep(steps[steps.indexOf(step) + 1])}
                >
                  {t(
                    step === "pre-game"
                      ? "leagueUx.reportNextGame"
                      : "leagueUx.reportNextPostGame",
                  )}
                  <ArrowRight className="size-4" />
                </Button>
              )}
            </div>
          </>
        )}
      {(history?.length ?? 0) > 0 && (
        <details className="rounded-lg border bg-card p-4">
          <summary className="cursor-pointer text-sm font-medium">
            {t("leagueUx.reportHistory")}
          </summary>
          <ol className="mt-3 space-y-3 text-sm">
            {history?.map((event) => (
              <li key={event.id} className="border-t pt-3">
                <p>
                  <strong>
                    {t(
                      `leagueUx.reportEvent${event.kind === "recorded" ? "Recorded" : event.kind === "corrected" ? "Corrected" : "Replayed"}`,
                    )}
                  </strong>{" "}
                  · {event.scoreHome} : {event.scoreAway} · {event.actorName}
                </p>
                {event.reason && (
                  <p className="mt-1 text-muted-foreground">{event.reason}</p>
                )}
              </li>
            ))}
          </ol>
        </details>
      )}
      {data.canCommission &&
        !correction &&
        (locked ||
          match.status === "scheduled" ||
          match.status === "void" ||
          match.administrativeResult) && (
          <details className="rounded-xl border bg-card">
            <summary className="flex min-h-14 cursor-pointer list-none items-center gap-2 px-5 text-sm font-medium [&::-webkit-details-marker]:hidden">
              <ShieldCheck className="size-4 text-muted-foreground" />
              {t("leagueUx.reportCommissioner")}
              <ChevronDown className="ml-auto size-4" />
            </summary>
            <div className="border-t p-4">
              {(match.status === "scheduled" ||
                match.status === "void" ||
                match.administrativeResult) && (
                <CommissionerRuling
                  key={`${match._id}:${match.revision}`}
                  matchId={match._id}
                  revision={match.revision}
                />
              )}
              {locked && !match.administrativeResult && (
                <Button
                  variant="outline"
                  onClick={() => {
                    setCorrection(structuredClone(data));
                    setReason("");
                    setStep("pre-game");
                  }}
                >
                  <ShieldCheck className="size-4" />
                  {t("leagueUi.correctReport")}
                </Button>
              )}
            </div>
          </details>
        )}
    </div>
  );
}

function PostGame({
  data,
  editable,
  onChange,
}: {
  data: MatchData;
  editable: boolean;
  onChange: (patch: DetailsPatch) => void;
}) {
  const t = useTranslations();
  const match = data.match;
  const attendance =
    match.homeFanRoll &&
    match.awayFanRoll &&
    match.homeSnapshot &&
    match.awaySnapshot
      ? (match.homeDedicatedFans ?? match.homeSnapshot.staff.dedicatedFans) +
        match.homeFanRoll +
        (match.awayDedicatedFans ?? match.awaySnapshot.staff.dedicatedFans) +
        match.awayFanRoll
      : null;
  return (
    <LeagueSection title={t("leagueUx.reportPostGame")}>
      <fieldset disabled={!editable} className="grid gap-4 sm:grid-cols-2">
        {(["home", "away"] as const).map((side) => {
          const scoreKey = side === "home" ? "scoreHome" : "scoreAway";
          const score = match[scoreKey];
          const earned =
            attendance === null ||
            attendance < 4 ||
            attendance > 20 ||
            !Number.isInteger(score) ||
            score < 0 ||
            score > 30
              ? null
              : calculateWinnings(attendance, score, match[`${side}Stalled`]);
          return (
            <div key={side} className="space-y-4 rounded-lg border p-4">
              <h3 className="break-words font-semibold">
                {side === "home" ? data.home.team.name : data.away?.team.name}
              </h3>
              <LeagueField>
                {t("leagueUx.reportTouchdowns")}
                <Input
                  type="number"
                  min={0}
                  max={30}
                  step={1}
                  className="h-14 text-center text-2xl font-semibold tabular-nums"
                  value={score}
                  onChange={(event) =>
                    onChange({ [scoreKey]: Number(event.target.value) })
                  }
                />
              </LeagueField>
              <label className="flex min-h-10 items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="size-4 accent-primary"
                  checked={match[`${side}Stalled`]}
                  onChange={(event) =>
                    onChange({ [`${side}Stalled`]: event.target.checked })
                  }
                />
                {t("leagueUi.stalled")}
              </label>
              {match.scoreHome !== match.scoreAway && (
                <DiceInput
                  label={t("leagueUi.fanProgressionRoll")}
                  sides={6}
                  value={match[`${side}FansRoll`]}
                  onChange={(value) => onChange({ [`${side}FansRoll`]: value })}
                />
              )}
              <p className="text-sm">
                {t("leagueUi.winnings")}:{" "}
                <span className="font-mono font-semibold">
                  {earned === null ? "—" : `${earned / 1000}k GP`}
                </span>
              </p>
            </div>
          );
        })}
        <LeagueField className="sm:col-span-2">
          {t("leagueUi.evidence")}
          <Input
            type="url"
            maxLength={1000}
            placeholder="https://"
            value={match.evidenceUrl}
            onChange={(event) => onChange({ evidenceUrl: event.target.value })}
          />
        </LeagueField>
      </fieldset>
      <p className="mt-3 text-xs text-muted-foreground">
        {t("leagueUi.winningsHint")}
      </p>
    </LeagueSection>
  );
}

function MatchPlayerRow({
  player,
  displayName,
  editable,
  onChange,
}: {
  player: ReportPlayer;
  displayName: string;
  editable: boolean;
  onChange: (patch: PlayerPatch) => void;
}) {
  const t = useTranslations();
  const canEdit = editable && player.participated;
  return (
    <details className="group/player border-b bg-card last:border-b-0">
      <summary className="grid min-h-12 cursor-pointer list-none grid-cols-[minmax(0,1fr)_repeat(3,2rem)_1rem] items-center gap-1 px-3 py-2 hover:bg-secondary/30 sm:grid-cols-[minmax(0,1fr)_repeat(6,3.25rem)_1.5rem] [&::-webkit-details-marker]:hidden">
        <span className="flex min-w-0 items-center gap-2">
          <PlayerIcon
            positionId={player.positionId}
            className="size-8 shrink-0"
          />
          <span className="min-w-0">
            <span className="block text-sm font-semibold">{displayName}</span>
            <span className="block text-xs text-muted-foreground">
              {positionLabel(player.snapshot.positionName)}
            </span>
            {(!player.participated || player.statusAfter !== "active") && (
              <span className="text-[11px] text-destructive">
                {t(
                  "leagueUi.status." +
                    (player.participated
                      ? player.statusAfter
                      : player.snapshot.status),
                )}
              </span>
            )}
          </span>
        </span>
        {fields.slice(0, 6).map((field) => (
          <span
            key={field}
            className={`text-center font-mono text-xs ${["td", "cas", "mvp"].includes(field) ? "" : "hidden sm:block"}`}
          >
            <span className="sr-only">{t("leagueUi.stats." + field)} </span>
            {player.stats[field] || "—"}
          </span>
        ))}
        <ChevronDown className="size-4 text-muted-foreground group-open/player:rotate-180" />
      </summary>
      <div className="space-y-4 border-t bg-secondary/10 p-3 sm:p-4">
        <details className="rounded-lg bg-secondary/20 p-3">
          <summary className="cursor-pointer text-xs font-medium text-muted-foreground">
            {t("leagueUx.reportPlayerProfile")}
          </summary>
          <div className="my-3 flex flex-wrap gap-4 font-mono text-sm">
            {Object.entries(player.snapshot.profile).map(([key, value]) => (
              <span key={key}>
                {key.toUpperCase()} {value}
              </span>
            ))}
          </div>
          <SkillList ids={[...player.snapshot.baseSkills, ...player.skills]} />
        </details>
        <p className="text-xs text-muted-foreground">
          {t("leagueUx.reportStatsHint")}
        </p>
        <fieldset
          disabled={!canEdit}
          className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6"
        >
          {fields.slice(0, 6).map((field) => (
            <LeagueField key={field}>
              <span title={t("leagueUi.statDescriptions." + field)}>
                {t("leagueUx.reportStatLabels." + field)}
              </span>
              <Input
                className="h-10 tabular-nums"
                type="number"
                min={0}
                max={field === "mvp" ? 1 : 99}
                step={1}
                value={player.stats[field]}
                onChange={(event) =>
                  onChange({ stats: { [field]: Number(event.target.value) } })
                }
              />
            </LeagueField>
          ))}
        </fieldset>
        <details className="rounded-lg border">
          <summary className="cursor-pointer px-4 py-3 text-sm font-medium">
            {t("leagueUx.reportMoreStats")}
          </summary>
          <fieldset
            disabled={!canEdit}
            className="grid grid-cols-2 gap-3 border-t p-4 sm:grid-cols-3"
          >
            {fields.slice(6).map((field) => (
              <LeagueField key={field}>
                {t("leagueUx.reportStatLabels." + field)}
                <Input
                  className="h-10 tabular-nums"
                  type="number"
                  min={0}
                  max={field === "dth" ? 1 : 99}
                  step={1}
                  disabled={field === "dth"}
                  value={player.stats[field]}
                  onChange={(event) =>
                    onChange({ stats: { [field]: Number(event.target.value) } })
                  }
                />
              </LeagueField>
            ))}
          </fieldset>
        </details>
        <details
          className="rounded-lg border"
          open={
            player.casualtyRoll !== null ||
            player.statusAfter !== "active" ||
            undefined
          }
        >
          <summary className="cursor-pointer px-4 py-3 text-sm font-medium">
            {t("leagueUx.reportInjuries")}
          </summary>
          <div className="border-t p-4">
            <fieldset disabled={!canEdit} className="grid gap-3 sm:grid-cols-2">
              <DiceInput
                label={t("leagueUi.casualtyRoll")}
                sides={99}
                value={player.casualtyRoll}
                onChange={(value) =>
                  onChange({ casualtyRoll: value, lastingRoll: null })
                }
              />
              {player.casualtyRoll !== null &&
                player.casualtyRoll >= 13 &&
                player.casualtyRoll <= 14 && (
                  <DiceInput
                    label={t("leagueUi.lastingRoll")}
                    sides={6}
                    value={player.lastingRoll}
                    onChange={(value) => onChange({ lastingRoll: value })}
                  />
                )}
              <LeagueField>
                {t("leagueUi.playerStatus")}
                <LeagueSelect
                  value={player.statusAfter}
                  disabled={player.casualtyRoll !== null}
                  onChange={(event) =>
                    onChange({
                      statusAfter: event.target
                        .value as ReportPlayer["statusAfter"],
                    })
                  }
                >
                  {["active", "missing-next-game", "dead"].map((status) => (
                    <option key={status} value={status}>
                      {t("leagueUi.status." + status)}
                    </option>
                  ))}
                </LeagueSelect>
              </LeagueField>
              <LeagueField>
                {t("leagueUi.injuryNotes")}
                <Input
                  value={player.injuryNotes}
                  maxLength={500}
                  onChange={(event) =>
                    onChange({ injuryNotes: event.target.value })
                  }
                />
              </LeagueField>
            </fieldset>
            <p className="mt-3 text-xs text-muted-foreground">
              {t("leagueUi.casualtyHint")}
            </p>
          </div>
        </details>
      </div>
    </details>
  );
}
