"use client";

import { useState } from "react";
import Link from "next/link";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import type { FunctionArgs, FunctionReturnType } from "convex/server";
import { useTranslations } from "gt-next";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  Circle,
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

type MatchData = NonNullable<FunctionReturnType<typeof api.leagues.getMatch>>;
type ReportPlayer = MatchData["players"][number];
type Stats = ReportPlayer["stats"];
type PlayerDraft = {
  stats: Stats;
  statusAfter: "active" | "missing-next-game" | "dead";
  injuryNotes: string;
  revision: number;
  casualtyRoll: number | null;
  lastingRoll: number | null;
};
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
  const start = useMutation(api.leagues.startMatch);
  const confirm = useMutation(api.leagues.confirmMatch);
  const updateDetails = useMutation(api.leagues.updateMatchDetails);
  const updatePlayer = useMutation(api.leagues.updateMatchPlayer);
  const correct = useMutation(api.leagues.correctMatch);
  const action = useLeagueAction();
  const [step, setStep] = useState<"details" | "players" | "review">("details");
  const [selectedSide, setTeamSide] = useState<"home" | "away" | null>(null);
  const [dirty, setDirty] = useState<string[]>([]);
  const [correction, setCorrection] = useState(false);
  const [reason, setReason] = useState("");
  const [correctedPlayers, setCorrectedPlayers] = useState<
    Record<string, PlayerDraft>
  >({});
  const [correctedScore, setCorrectedScore] = useState<{
    home: number;
    away: number;
  } | null>(null);
  const [correctionRevision, setCorrectionRevision] = useState<number | null>(
    null,
  );
  const [correctedDetails, setCorrectedDetails] =
    useState<DetailsPayload | null>(null);
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
  const { match, league, home, away } = data;
  const teamSide =
    selectedSide ?? (away?.coachId === data.viewerId ? "away" : "home");
  const base = `/leagues/manage/${leagueId}`;
  const locked = match.status === "completed";
  const editable = data.canEdit && !locked;
  const validDice = (value: number | null, sides: number) =>
    value !== null && Number.isInteger(value) && value >= 1 && value <= sides;
  const confirmationReady =
    [home, away].every((entry) => {
      if (!entry) return false;
      const rows = data.players.filter(
        (player) => player.entryId === entry._id,
      );
      return (
        rows.reduce((total, player) => total + player.stats.td, 0) ===
          (entry._id === home._id ? match.scoreHome : match.scoreAway) &&
        rows.reduce((total, player) => total + player.stats.mvp, 0) === 1
      );
    }) &&
    validDice(match.homeFanRoll, 3) &&
    validDice(match.awayFanRoll, 3) &&
    (match.scoreHome === match.scoreAway ||
      (validDice(match.homeFansRoll, 6) && validDice(match.awayFansRoll, 6)));
  function setDirtyField(key: string, value: boolean) {
    setDirty((previous) =>
      value
        ? [...new Set([...previous, key])]
        : previous.filter((item) => item !== key),
    );
  }
  function startCorrection() {
    setStep("details");
    setCorrection(true);
    setCorrectionRevision(match.revision);
    setCorrectedScore({ home: match.scoreHome, away: match.scoreAway });
    setCorrectedPlayers({});
    setCorrectedDetails(null);
    setReason("");
  }
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
      <LeagueError message={action.error} />
      {match.administrativeResult && (
        <p className="rounded-xl border bg-secondary/20 p-4 text-sm">
          <strong>{t("leagueUi." + match.administrativeResult)}</strong> ·{" "}
          {t("leagueUi.administrativeHint")}
        </p>
      )}
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 overflow-hidden rounded-lg border bg-card p-4 sm:gap-6 sm:p-5">
        {[home, away].map((entry, index) =>
          entry ? (
            <div
              key={entry._id}
              className={`min-w-0 ${index ? "col-start-3 text-right" : ""}`}
            >
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                {t(index ? "leagueUi.away" : "leagueUi.home")}
              </p>
              <Link
                href={`${base}/teams/${entry._id}`}
                className="mt-2 block break-words text-base font-semibold leading-tight hover:text-primary sm:text-2xl"
              >
                {entry.team.name}
              </Link>
              <p className="mt-2 text-xs text-muted-foreground sm:text-sm">
                {entry.coachName} · {getRoster(entry.team.rosterId)?.name}
              </p>
              <p
                className={`mt-3 flex items-center gap-1.5 text-xs text-muted-foreground ${index ? "justify-end" : ""}`}
              >
                {match.administrativeResult ? (
                  t("leagueUi." + match.administrativeResult)
                ) : match.confirmedBy.includes(entry.coachId) ? (
                  <>
                    <CheckCircle2 className="size-4 text-primary" />
                    {t("leagueUi.confirmed")}
                  </>
                ) : match.status !== "scheduled" && match.status !== "void" ? (
                  t("leagueUi.awaitingConfirmation")
                ) : null}
              </p>
            </div>
          ) : null,
        )}
        <div
          className={`col-start-2 row-start-1 flex items-center justify-center font-semibold tracking-tight tabular-nums ${match.administrativeResult ? "max-w-24 text-center text-sm sm:max-w-40 sm:text-lg" : "whitespace-nowrap font-mono text-3xl sm:text-4xl"}`}
        >
          {match.administrativeResult
            ? t("leagueUi." + match.administrativeResult)
            : match.status === "scheduled"
              ? "— : —"
              : `${match.scoreHome} : ${match.scoreAway}`}
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
                className="h-11"
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
              {(["details", "players", "review"] as const).map(
                (value, index) => (
                  <button
                    key={value}
                    type="button"
                    aria-current={step === value ? "step" : undefined}
                    aria-controls={`report-${value}`}
                    disabled={
                      value !== step && (dirty.length > 0 || action.busy)
                    }
                    onClick={() => setStep(value)}
                    className={`-mb-px flex min-h-12 items-center justify-center gap-2 border-b-2 px-2 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-50 ${step === value ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:border-border hover:text-foreground"}`}
                  >
                    <span className="hidden size-5 items-center justify-center rounded-full border border-current/30 text-xs sm:inline-flex">
                      {index + 1}
                    </span>
                    {t(
                      `leagueUx.report${value === "details" ? "Details" : value === "players" ? "Players" : "Review"}`,
                    )}
                  </button>
                ),
              )}
            </nav>
            <p
              role="status"
              className={`flex items-center gap-2 text-xs ${dirty.length ? "text-amber-700 dark:text-amber-400" : "text-muted-foreground"}`}
            >
              {dirty.length ? (
                <Circle className="size-3" />
              ) : (
                <CheckCircle2 className="size-3.5" />
              )}
              {t(
                action.busy
                  ? "leagueUx.reportSaving"
                  : dirty.length
                    ? "leagueUx.reportUnsaved"
                    : correction
                      ? "leagueUx.reportCorrectionDraft"
                      : "leagueUx.reportSaved",
              )}
            </p>
            <div id="report-details" hidden={step !== "details"}>
              <MatchDetails
                key={correction ? "correction" : "regular"}
                data={data}
                editable={editable || correction}
                staged={correction}
                busy={action.busy}
                onDirty={(value) => setDirtyField("details", value)}
                onDiscard={() => {
                  setCorrectedDetails(null);
                  setCorrectedScore(null);
                }}
                onSave={(payload) =>
                  correction
                    ? Promise.resolve().then(() => {
                        setCorrectedDetails(payload);
                        setCorrectedScore({
                          home: payload.scoreHome,
                          away: payload.scoreAway,
                        });
                        return true;
                      })
                    : action.run(() =>
                        updateDetails({ matchId: id, ...payload }),
                      )
                }
              />
            </div>
            <div
              id="report-players"
              hidden={step !== "players"}
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
                        className="h-auto min-h-11 whitespace-normal px-4 py-2"
                        aria-pressed={teamSide === (index ? "away" : "home")}
                        disabled={dirty.length > 0 || action.busy}
                        onClick={() => setTeamSide(index ? "away" : "home")}
                      >
                        {entry.team.name}
                      </Button>
                    ),
                )}
              </div>
              <p className="text-sm text-muted-foreground">
                {t("leagueUx.reportPlayersHint")}
              </p>
              {[home, away].map((entry, sideIndex) =>
                entry ? (
                  <div
                    key={entry._id}
                    hidden={teamSide !== (sideIndex ? "away" : "home")}
                  >
                    <LeagueSection title={entry.team.name}>
                      <div className="mb-4 flex flex-wrap gap-3 text-xs text-muted-foreground">
                        <span>
                          {t("leagueUx.reportTouchdowns")}:{" "}
                          <strong className="text-foreground">
                            {data.players
                              .filter((player) => player.entryId === entry._id)
                              .reduce(
                                (sum, player) =>
                                  sum +
                                  (correctedPlayers[player.playerId]?.stats
                                    .td ?? player.stats.td),
                                0,
                              )}{" "}
                            /{" "}
                            {sideIndex
                              ? (correctedScore?.away ?? match.scoreAway)
                              : (correctedScore?.home ?? match.scoreHome)}
                          </strong>
                        </span>
                        <span>
                          {t("leagueUi.stats.mvp")}:{" "}
                          <strong className="text-foreground">
                            {data.players
                              .filter((player) => player.entryId === entry._id)
                              .reduce(
                                (sum, player) =>
                                  sum +
                                  (correctedPlayers[player.playerId]?.stats
                                    .mvp ?? player.stats.mvp),
                                0,
                              )}{" "}
                            / 1
                          </strong>
                        </span>
                      </div>
                      <div className="overflow-x-auto rounded-lg border">
                        <div className="min-w-0">
                          <div className="grid grid-cols-[minmax(0,1fr)_repeat(3,2rem)_1rem] sm:grid-cols-[minmax(12rem,1fr)_repeat(6,3.25rem)_1.5rem] items-center gap-1 border-b bg-secondary/30 px-3 py-1 text-xs text-muted-foreground">
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
                          {data.players
                            .filter((player) => player.entryId === entry._id)
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
                                revision={match.revision}
                                editable={editable || correction}
                                blocked={dirty.some(
                                  (key) => key !== String(player._id),
                                )}
                                busy={action.busy}
                                correction={correction}
                                correctionDraft={
                                  correctedPlayers[player.playerId]
                                }
                                onCorrection={(draft) =>
                                  setCorrectedPlayers((previous) => ({
                                    ...previous,
                                    [player.playerId]: draft,
                                  }))
                                }
                                onDirty={(value) =>
                                  setDirtyField(String(player._id), value)
                                }
                                onSave={(draft) =>
                                  action.run(() =>
                                    updatePlayer({
                                      matchId: id,
                                      playerId: player.playerId,
                                      stats: draft.stats,
                                      statusAfter: draft.statusAfter,
                                      injuryNotes: draft.injuryNotes,
                                      casualtyRoll: draft.casualtyRoll,
                                      lastingRoll: draft.lastingRoll,
                                      expectedRevision: draft.revision,
                                    }),
                                  )
                                }
                              />
                            ))}
                        </div>
                      </div>
                    </LeagueSection>
                  </div>
                ) : null,
              )}
            </div>
            <div
              id="report-review"
              hidden={step !== "review"}
              className="space-y-4"
            >
              {correction && (
                <LeagueSection title={t("leagueUi.correctReport")}>
                  <p className="mb-4 text-sm text-muted-foreground">
                    {t("leagueUi.correctionHint")}
                  </p>
                  <LeagueField>
                    {t("leagueUi.reason")}
                    <Textarea
                      value={reason}
                      maxLength={1000}
                      className="mt-1"
                      onChange={(event) => setReason(event.target.value)}
                    />
                  </LeagueField>
                </LeagueSection>
              )}
              {correction ? (
                <div className="flex flex-wrap gap-3">
                  <Button
                    className="h-11"
                    disabled={
                      action.busy ||
                      dirty.length > 0 ||
                      reason.trim().length < 3
                    }
                    onClick={() =>
                      void action
                        .run(() =>
                          correct({
                            ...correctedDetails,
                            matchId: id,
                            scoreHome: correctedScore?.home ?? match.scoreHome,
                            scoreAway: correctedScore?.away ?? match.scoreAway,
                            expectedRevision:
                              correctionRevision ?? match.revision,
                            reason: reason.trim(),
                            playerChanges: Object.entries(correctedPlayers).map(
                              ([playerId, draft]) => ({
                                playerId: playerId as Id<"leaguePlayers">,
                                stats: draft.stats,
                                statusAfter: draft.statusAfter,
                                injuryNotes: draft.injuryNotes,
                                casualtyRoll: draft.casualtyRoll,
                                lastingRoll: draft.lastingRoll,
                              }),
                            ),
                          }),
                        )
                        .then((saved) => {
                          if (saved) {
                            setCorrection(false);
                            setCorrectedPlayers({});
                            setCorrectedScore(null);
                            setDirty([]);
                          }
                        })
                    }
                  >
                    {t("leagueUi.saveCorrection")}
                  </Button>
                  <Button
                    variant="outline"
                    className="h-11"
                    disabled={action.busy}
                    onClick={() => {
                      setCorrection(false);
                      setCorrectedPlayers({});
                      setCorrectedScore(null);
                      setDirty([]);
                    }}
                  >
                    {t("cancel")}
                  </Button>
                </div>
              ) : (
                <LeagueSection
                  title={t("leagueUi.confirmResult")}
                  action={
                    data.canConfirm && (
                      <Button
                        className="h-11"
                        disabled={
                          action.busy ||
                          dirty.length > 0 ||
                          !confirmationReady ||
                          match.confirmedBy.includes(data.viewerId!)
                        }
                        onClick={() =>
                          void action.run(() =>
                            confirm({
                              matchId: id,
                              expectedRevision: match.revision,
                            }),
                          )
                        }
                      >
                        <CheckCircle2 className="size-4" />
                        {t("leagueUi.confirm")}
                      </Button>
                    )
                  }
                >
                  {!locked && (
                    <ul className="mb-5 space-y-3">
                      {[
                        {
                          ready: dirty.length === 0,
                          label: t("leagueUx.reportCheckSaved"),
                          target: dirty.some((field) => field !== "details")
                            ? ("players" as const)
                            : ("details" as const),
                        },
                        {
                          ready:
                            validDice(match.homeFanRoll, 3) &&
                            validDice(match.awayFanRoll, 3) &&
                            (match.scoreHome === match.scoreAway ||
                              (validDice(match.homeFansRoll, 6) &&
                                validDice(match.awayFansRoll, 6))),
                          label: t("leagueUx.reportCheckRolls"),
                          target: "details" as const,
                        },
                        {
                          ready: [home, away].every(
                            (entry) =>
                              entry &&
                              data.players
                                .filter(
                                  (player) => player.entryId === entry._id,
                                )
                                .reduce(
                                  (sum, player) => sum + player.stats.td,
                                  0,
                                ) ===
                                (entry._id === home._id
                                  ? match.scoreHome
                                  : match.scoreAway),
                          ),
                          label: t("leagueUx.reportCheckTouchdowns"),
                          target: "players" as const,
                        },
                        {
                          ready: [home, away].every(
                            (entry) =>
                              entry &&
                              data.players
                                .filter(
                                  (player) => player.entryId === entry._id,
                                )
                                .reduce(
                                  (sum, player) => sum + player.stats.mvp,
                                  0,
                                ) === 1,
                          ),
                          label: t("leagueUx.reportCheckMvp"),
                          target: "players" as const,
                        },
                      ].map((check) => (
                        <li key={check.label}>
                          <button
                            type="button"
                            onClick={() => setStep(check.target)}
                            className="flex min-h-9 items-center gap-3 text-left text-sm hover:text-primary"
                          >
                            {check.ready ? (
                              <CheckCircle2 className="size-4 shrink-0 text-primary" />
                            ) : (
                              <Circle className="size-4 shrink-0 text-muted-foreground" />
                            )}
                            <span>{check.label}</span>
                            {!check.ready && (
                              <ArrowRight className="size-3.5 shrink-0" />
                            )}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                  <p className="flex items-start gap-2 text-sm text-muted-foreground">
                    {locked && <LockKeyhole className="size-4 shrink-0" />}
                    {t(
                      locked
                        ? "leagueUi.lockedHint"
                        : dirty.length
                          ? "leagueUi.saveBeforeConfirm"
                          : !confirmationReady
                            ? "leagueUi.confirmationMissing"
                            : "leagueUi.confirmHint",
                    )}
                  </p>
                </LeagueSection>
              )}
            </div>
            <div className="flex items-center justify-between gap-3 border-t pt-4">
              <Button
                variant="ghost"
                className="h-11"
                disabled={step === "details" || dirty.length > 0 || action.busy}
                onClick={() =>
                  setStep(step === "review" ? "players" : "details")
                }
              >
                <ArrowLeft className="size-4" />
                {t("leagueUx.reportPrevious")}
              </Button>
              {step !== "review" && (
                <Button
                  variant="outline"
                  className="h-11"
                  disabled={dirty.length > 0 || action.busy}
                  onClick={() =>
                    setStep(step === "details" ? "players" : "review")
                  }
                >
                  {t(
                    step === "details"
                      ? "leagueUx.reportNextPlayers"
                      : "leagueUx.reportNextReview",
                  )}
                  <ArrowRight className="size-4" />
                </Button>
              )}
            </div>
          </>
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
              <ChevronDown className="ml-auto size-4 text-muted-foreground" />
            </summary>
            <div className="border-t p-4">
              {(match.status === "scheduled" ||
                match.status === "void" ||
                match.administrativeResult) && (
                <CommissionerRuling
                  key={`commissioner-ruling:${match._id}:${match.revision}`}
                  matchId={match._id}
                  revision={match.revision}
                />
              )}
              {locked && !match.administrativeResult && (
                <Button
                  variant="outline"
                  className="h-11"
                  onClick={startCorrection}
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

type DetailsPayload = Omit<
  FunctionArgs<typeof api.leagues.updateMatchDetails>,
  "matchId"
>;
function MatchDetails({
  data,
  editable,
  staged = false,
  busy,
  onDirty,
  onDiscard,
  onSave,
}: {
  data: MatchData;
  editable: boolean;
  staged?: boolean;
  busy: boolean;
  onDirty: (value: boolean) => void;
  onDiscard: () => void;
  onSave: (payload: DetailsPayload) => Promise<boolean>;
}) {
  const t = useTranslations();
  const [draft, setDraft] = useState<DetailsPayload | null>(null);
  const match = data.match;
  const current = draft ?? {
    scoreHome: match.scoreHome,
    scoreAway: match.scoreAway,
    venue: match.venue,
    evidenceUrl: match.evidenceUrl,
    homeFanRoll: match.homeFanRoll,
    awayFanRoll: match.awayFanRoll,
    homeStalled: match.homeStalled,
    awayStalled: match.awayStalled,
    homeFansRoll: match.homeFansRoll,
    awayFansRoll: match.awayFansRoll,
    expectedRevision: match.revision,
  };
  function change(patch: Partial<DetailsPayload>) {
    setDraft({ ...current, ...patch });
    onDirty(true);
  }
  const attendance =
    current.homeFanRoll &&
    current.awayFanRoll &&
    match.homeSnapshot &&
    match.awaySnapshot
      ? match.homeSnapshot.staff.dedicatedFans +
        current.homeFanRoll +
        match.awaySnapshot.staff.dedicatedFans +
        current.awayFanRoll
      : null;
  function winnings(home: boolean) {
    if (match.status === "completed" && !staged)
      return home ? match.homeWinnings : match.awayWinnings;
    const score = home ? current.scoreHome : current.scoreAway;
    if (
      attendance === null ||
      attendance < 4 ||
      attendance > 20 ||
      score < 0 ||
      score > 30
    )
      return null;
    return calculateWinnings(
      attendance,
      home ? current.scoreHome : current.scoreAway,
      home ? !!current.homeStalled : !!current.awayStalled,
    );
  }
  return (
    <LeagueSection title={t("leagueUi.resultDetails")}>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void onSave({
            ...current,
            venue: current.venue?.trim() || "",
            evidenceUrl: current.evidenceUrl?.trim() || "",
          }).then((saved) => {
            if (saved) {
              if (!staged) setDraft(null);
              onDirty(false);
            }
          });
        }}
      >
        <p className="mb-5 text-sm text-muted-foreground">
          {t("leagueUx.reportDetailsHint")}
        </p>
        <fieldset
          disabled={!editable || busy}
          className="grid gap-4 sm:grid-cols-2"
        >
          {(["scoreHome", "scoreAway"] as const).map((field) => (
            <LeagueField key={field}>
              {field === "scoreHome"
                ? data.home.team.name
                : data.away?.team.name}
              <span className="ml-2 text-xs font-normal text-muted-foreground">
                {t("leagueUx.reportTouchdowns")}
              </span>
              <Input
                type="number"
                min={0}
                max={30}
                step={1}
                className="mt-2 h-16 text-center text-3xl font-semibold tabular-nums"
                value={current[field]}
                onChange={(event) =>
                  change({ [field]: Number(event.target.value) })
                }
                required
              />
            </LeagueField>
          ))}
        </fieldset>
        <details className="mt-5 rounded-lg border">
          <summary className="cursor-pointer px-4 py-3 text-sm font-medium">
            {t("leagueUx.reportExtraDetails")}
          </summary>
          <fieldset
            disabled={!editable || busy}
            className="grid gap-4 border-t p-4 sm:grid-cols-2"
          >
            <LeagueField>
              {t("leagueUi.venue")}
              <Input
                className="mt-1 h-11"
                maxLength={160}
                value={current.venue}
                onChange={(event) => change({ venue: event.target.value })}
              />
            </LeagueField>
            <LeagueField>
              {t("leagueUi.evidence")}
              <Input
                type="url"
                className="mt-1 h-11"
                maxLength={1000}
                value={current.evidenceUrl}
                placeholder="https://"
                onChange={(event) =>
                  change({ evidenceUrl: event.target.value })
                }
              />
            </LeagueField>
          </fieldset>
        </details>
        <h3 className="mb-3 mt-6 font-semibold">
          {t("leagueUi.postgameEconomy")}
        </h3>
        <p className="mb-4 text-sm text-muted-foreground">
          {t("leagueUi.economyHint")}
        </p>
        <fieldset
          disabled={!editable || busy}
          className="grid gap-4 sm:grid-cols-2"
        >
          {(["home", "away"] as const).map((side) => {
            const isHome = side === "home",
              entry = isHome ? data.home : data.away,
              earned = winnings(isHome);
            const fanKey = isHome ? "homeFanRoll" : "awayFanRoll",
              fansKey = isHome ? "homeFansRoll" : "awayFansRoll",
              stalledKey = isHome ? "homeStalled" : "awayStalled";
            return (
              <div key={side} className="space-y-3 rounded-lg border p-4">
                <h4 className="break-words font-semibold">
                  {entry?.team.name}
                </h4>
                <DiceInput
                  label={t("leagueUi.fanAttendanceRoll")}
                  sides={3}
                  value={current[fanKey]}
                  onChange={(value) => change({ [fanKey]: value })}
                />
                <label className="flex min-h-10 items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="size-4 accent-primary"
                    checked={!!current[stalledKey]}
                    onChange={(event) =>
                      change({ [stalledKey]: event.target.checked })
                    }
                  />
                  {t("leagueUi.stalled")}
                </label>
                {current.scoreHome !== current.scoreAway && (
                  <DiceInput
                    label={t("leagueUi.fanProgressionRoll")}
                    sides={6}
                    value={current[fansKey]}
                    onChange={(value) => change({ [fansKey]: value })}
                  />
                )}
                <p className="text-sm">
                  {t("leagueUi.winnings")}:{" "}
                  <span className="font-mono font-semibold">
                    {earned === null ? "—" : earned / 1000 + "k GP"}
                  </span>
                </p>
              </div>
            );
          })}
        </fieldset>
        <p className="mt-3 text-xs text-muted-foreground">
          {t("leagueUi.winningsHint")}
        </p>
        {draft && draft.expectedRevision !== match.revision && (
          <p
            role="status"
            className="mt-3 text-sm text-amber-700 dark:text-amber-400"
          >
            {t("leagueUi.staleDraft")}
          </p>
        )}
        {editable && (
          <div className="mt-4 flex gap-3">
            <Button
              type="submit"
              className="h-11"
              disabled={
                !draft || busy || draft.expectedRevision !== match.revision
              }
            >
              {t("leagueUi.saveDetails")}
            </Button>
            {draft && (
              <Button
                type="button"
                variant="outline"
                className="h-11"
                onClick={() => {
                  setDraft(null);
                  onDiscard();
                  onDirty(false);
                }}
              >
                {t("leagueUx.reportDiscardChanges")}
              </Button>
            )}
          </div>
        )}
      </form>
    </LeagueSection>
  );
}

function MatchPlayerRow({
  player,
  displayName,
  revision,
  editable,
  blocked,
  busy,
  correction,
  correctionDraft,
  onCorrection,
  onDirty,
  onSave,
}: {
  player: ReportPlayer;
  displayName: string;
  revision: number;
  editable: boolean;
  blocked: boolean;
  busy: boolean;
  correction: boolean;
  correctionDraft?: PlayerDraft;
  onCorrection: (draft: PlayerDraft) => void;
  onDirty: (value: boolean) => void;
  onSave: (draft: PlayerDraft) => Promise<boolean>;
}) {
  const t = useTranslations();
  const [draft, setDraft] = useState<PlayerDraft | null>(null);
  const saved: PlayerDraft = {
    stats: player.stats,
    statusAfter: player.statusAfter,
    injuryNotes: player.injuryNotes ?? "",
    revision,
    casualtyRoll: player.casualtyRoll,
    lastingRoll: player.lastingRoll,
  };
  const current = correction ? (correctionDraft ?? saved) : (draft ?? saved);
  const canEdit = editable && player.participated && !blocked;
  function change(patch: Partial<PlayerDraft>) {
    const next = { ...current, ...patch };
    if (patch.casualtyRoll !== undefined || patch.lastingRoll !== undefined) {
      if (
        next.casualtyRoll !== null &&
        (next.casualtyRoll < 13 ||
          next.casualtyRoll > 14 ||
          next.lastingRoll !== null)
      ) {
        try {
          const outcome = casualtyOutcome(
            next.casualtyRoll,
            next.lastingRoll ?? undefined,
          );
          next.statusAfter = outcome.dead
            ? "dead"
            : outcome.missNextGame
              ? "missing-next-game"
              : "active";
          next.stats = {
            ...next.stats,
            inj: Math.max(1, next.stats.inj),
            dth: outcome.dead ? 1 : 0,
          };
        } catch {
          /* Keep invalid input editable; the backend validates on save. */
        }
      }
    }
    if (patch.statusAfter)
      next.stats = { ...next.stats, dth: patch.statusAfter === "dead" ? 1 : 0 };
    if (correction) onCorrection(next);
    else {
      setDraft(next);
      onDirty(true);
    }
  }
  return (
    <details className="group/player border-b bg-card last:border-b-0">
      <summary
        aria-disabled={blocked || !!draft}
        onClick={(event) => {
          if (blocked || draft) event.preventDefault();
        }}
        className="grid min-h-12 cursor-pointer list-none grid-cols-[minmax(0,1fr)_repeat(3,2rem)_1rem] sm:grid-cols-[minmax(12rem,1fr)_repeat(6,3.25rem)_1.5rem] items-center gap-1 px-3 py-2 transition-colors hover:bg-secondary/30 aria-disabled:cursor-default [&::-webkit-details-marker]:hidden"
      >
        <span className="flex min-w-0 items-center gap-2">
          <PlayerIcon
            positionId={player.positionId}
            className="size-8 shrink-0"
          />
          <span className="min-w-0">
            <span className="block text-sm font-semibold">{displayName}</span>
            {player.name && (
              <span className="block text-xs text-muted-foreground">
                {positionLabel(player.snapshot.positionName)}
              </span>
            )}
            {!player.participated ? (
              <span className="text-[11px] text-destructive">
                {t("leagueUi.status." + player.snapshot.status)}
              </span>
            ) : current.statusAfter !== "active" ? (
              <span className="text-[11px] text-destructive">
                {t("leagueUi.status." + current.statusAfter)}
              </span>
            ) : null}
            {draft && (
              <span className="block text-[11px] text-amber-700">
                {t("leagueUx.reportUnsavedShort")}
              </span>
            )}
          </span>
        </span>
        {fields.slice(0, 6).map((field) => (
          <span
            key={field}
            className={`text-center font-mono text-xs ${["td", "cas", "mvp"].includes(field) ? "" : "hidden sm:block"} ${current.stats[field] ? "font-semibold" : "text-muted-foreground/60"}`}
          >
            <span className="sr-only">{t("leagueUi.stats." + field)} </span>
            {current.stats[field] || "—"}
          </span>
        ))}
        <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform group-open/player:rotate-180" />
      </summary>
      <div className="border-t bg-secondary/10 p-3 sm:p-4">
        <details className="mb-5 rounded-lg bg-secondary/20 p-3">
          <summary className="cursor-pointer text-xs font-medium text-muted-foreground">
            {t("leagueUx.reportPlayerProfile")}
          </summary>
          <div className="my-4 flex items-center gap-3">
            <PlayerIcon
              positionId={player.positionId}
              className="size-10 shrink-0"
            />
            <div className="min-w-0">
              <h3 className="break-words font-semibold">{displayName}</h3>
              <p className="mb-2 text-xs text-muted-foreground">
                {player.snapshot.positionName} · {t("leagueUi.playerValue")}:{" "}
                {(player.snapshot.baseCost + player.snapshot.valueIncrease) /
                  1000}
                k GP
              </p>
              <SkillList
                ids={player.snapshot.baseSkills}
                additionalIds={player.skills}
              />
            </div>
          </div>
          {!player.participated && (
            <p className="mb-4 text-sm text-muted-foreground">
              {t("leagueUi.ineligibleHint")} ·{" "}
              {t("leagueUi.status." + player.snapshot.status)}
            </p>
          )}
          <dl className="mb-4 grid grid-cols-5 rounded-lg border bg-card p-2 text-center text-xs">
            {(["ma", "st", "ag", "pa", "av"] as const).map((label) => (
              <div key={label}>
                <dt className="text-muted-foreground">
                  <LeagueHelp stat={label} profile />
                </dt>
                <dd className="mt-1 font-mono font-semibold">
                  {player.snapshot.profile[label]}
                </dd>
              </div>
            ))}
          </dl>
        </details>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void onSave(current).then((saved) => {
              if (saved) {
                setDraft(null);
                onDirty(false);
              }
            });
          }}
        >
          <fieldset
            disabled={!canEdit || busy}
            className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6"
          >
            {fields.slice(0, 6).map((field) => (
              <LeagueField key={field}>
                <span title={t("leagueUi.statDescriptions." + field)}>
                  {t("leagueUx.reportStatLabels." + field)}
                </span>
                <Input
                  className="mt-1 h-10 tabular-nums"
                  type="number"
                  min={0}
                  max={field === "mvp" || field === "dth" ? 1 : 99}
                  step={1}
                  value={current.stats[field]}
                  onChange={(event) =>
                    change({
                      stats: {
                        ...current.stats,
                        [field]: Number(event.target.value),
                      },
                    })
                  }
                  required
                />
              </LeagueField>
            ))}
          </fieldset>
          <details className="mt-4 rounded-lg border">
            <summary className="cursor-pointer px-4 py-3 text-sm font-medium">
              {t("leagueUx.reportMoreStats")}
            </summary>
            <fieldset
              disabled={!canEdit || busy}
              className="grid grid-cols-2 gap-3 border-t p-4 sm:grid-cols-3"
            >
              {fields.slice(6).map((field) => (
                <LeagueField key={field}>
                  {t("leagueUx.reportStatLabels." + field)}
                  <Input
                    className="mt-1 h-10 tabular-nums"
                    type="number"
                    min={0}
                    max={field === "dth" ? 1 : 99}
                    step={1}
                    value={current.stats[field]}
                    onChange={(event) =>
                      change({
                        stats: {
                          ...current.stats,
                          [field]: Number(event.target.value),
                        },
                      })
                    }
                    required
                  />
                </LeagueField>
              ))}
            </fieldset>
          </details>
          <details
            className="mt-3 rounded-lg border"
            open={
              current.casualtyRoll !== null ||
              current.statusAfter !== "active" ||
              undefined
            }
          >
            <summary className="cursor-pointer px-4 py-3 text-sm font-medium">
              {t("leagueUx.reportInjuries")}
            </summary>
            <div className="border-t p-4">
              <fieldset
                disabled={!canEdit || busy}
                className="grid gap-3 sm:grid-cols-2"
              >
                <DiceInput
                  label={t("leagueUi.casualtyRoll")}
                  sides={99}
                  value={current.casualtyRoll}
                  onChange={(value) => change({ casualtyRoll: value })}
                />
                {current.casualtyRoll !== null &&
                  current.casualtyRoll >= 13 &&
                  current.casualtyRoll <= 14 && (
                    <DiceInput
                      label={t("leagueUi.lastingRoll")}
                      sides={6}
                      value={current.lastingRoll}
                      onChange={(value) => change({ lastingRoll: value })}
                    />
                  )}
                <LeagueField>
                  {t("leagueUi.playerStatus")}
                  <LeagueSelect
                    className="h-10"
                    value={current.statusAfter}
                    disabled={current.casualtyRoll !== null}
                    onChange={(event) =>
                      change({
                        statusAfter: event.target
                          .value as PlayerDraft["statusAfter"],
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
                    className="mt-1 h-10"
                    value={current.injuryNotes}
                    maxLength={500}
                    onChange={(event) =>
                      change({ injuryNotes: event.target.value })
                    }
                  />
                </LeagueField>
              </fieldset>
              <p className="mt-3 text-xs text-muted-foreground">
                {t("leagueUi.casualtyHint")}
              </p>
            </div>
          </details>
          {draft && draft.revision !== revision && !correction && (
            <p
              role="status"
              className="mt-3 text-sm text-amber-700 dark:text-amber-400"
            >
              {t("leagueUi.staleDraft")}
            </p>
          )}
          {canEdit && !correction && (
            <div className="mt-4 flex gap-3">
              <Button
                className="h-11"
                type="submit"
                disabled={!draft || busy || draft.revision !== revision}
              >
                {t("leagueUi.savePlayer")}
              </Button>
              {draft && (
                <Button
                  type="button"
                  className="h-11"
                  variant="outline"
                  onClick={() => {
                    setDraft(null);
                    onDirty(false);
                  }}
                >
                  {t("leagueUx.reportDiscardChanges")}
                </Button>
              )}
            </div>
          )}
        </form>
      </div>
    </details>
  );
}
