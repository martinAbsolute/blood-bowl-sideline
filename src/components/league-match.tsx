"use client";
import { useContentTitle } from "@/lib/use-content-title";
import { LeagueEmptyState, LeaguePageHeader } from "./league-layout";

import { useRef, useState } from "react";
import { LeagueEvents } from "./league-events";
import { MatchWeather } from "./match-weather";
import { isPreGameComplete } from "@/domain/match-pregame";
import { projectMatchEvents, type MatchEvent } from "@/domain/match-events";
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
  Plus,
  ShieldCheck,
} from "lucide-react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { getRoster } from "@/domain/catalog";
import { calculateWinnings } from "@/domain/league-rules";
import { useBeforeUnload } from "@/lib/use-before-unload";
import { Button } from "./ui/button";
import { Switch } from "./ui/switch";
import { RosterIcon } from "./player-icon";
import { Textarea } from "./ui/textarea";
import { LeagueField } from "./league-field";
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
type DetailsPatch = Omit<
  FunctionArgs<typeof api.leagues.updateMatchDetails>,
  "matchId" | "expectedRevision"
>;
type Step = "pre-game" | "game" | "post-game";
const steps: Step[] = ["pre-game", "game", "post-game"];

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
  useContentTitle(
    data && String(data.league._id) === leagueId
      ? `${data.home.team.name} vs ${data.away?.team.name ?? t("leagueUi.bye")} · ${data.league.name}`
      : undefined,
  );
  const history = useQuery(
    api.leagues.getMatchHistory,
    auth.isAuthenticated ? { matchId: id } : "skip",
  );
  const start = useMutation(api.leagues.startMatch);
  const saveEvent = useMutation(api.leagues.savePlayEvent);
  const [eventDraft, setEventDraft] = useState(false);
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
  const action = useLeagueAction();
  const [requestedStep, setStep] = useState<Step>("pre-game");
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
  async function changeEvent(
    event: MatchEvent,
    version: number,
    deleted = false,
  ) {
    const payload = {
      ...event,
      playerId: event.playerId as Id<"leaguePlayers">,
      targetId: event.targetId as Id<"leaguePlayers"> | null,
    };
    return action.run(async () => {
      if (!correction) {
        await saveEvent({
          matchId: id,
          event: payload,
          expectedVersion: version,
          deleted,
        });
        return;
      }
      const existing = correction.playEvents.find(
        (row) => row.event.id === event.id,
      );
      const ledger = correction.playEvents.filter(
        (row) => row.event.id !== event.id,
      );
      if (!deleted)
        ledger.push(
          existing
            ? { ...existing, event: payload }
            : {
                _id: event.id as Id<"leaguePlayEvents">,
                _creationTime: Date.now(),
                matchId: id,
                event: payload,
                version: 1,
                deleted: false,
                actorId: correction.viewerId!,
                actorName: t("leagueUi.correctReport"),
              },
        );
      const projection = projectMatchEvents(
        correction.players,
        ledger.map((row) => row.event),
        correction.home._id,
      );
      setCorrection({
        ...correction,
        playEvents: ledger,
        players: projection.players,
        match: {
          ...correction.match,
          scoreHome: projection.scoreHome,
          scoreAway: projection.scoreAway,
        },
      });
    });
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
        <LeagueEmptyState
          icon={<LockKeyhole className="size-6" />}
          title={t("leagueUi.notFound")}
          description={t("leagueUx.notFoundHint")}
        />
      </div>
    );

  const view = correction ?? data;
  const { match, league, home, away } = view;
  const preGameComplete = isPreGameComplete(match);
  const step = preGameComplete ? requestedStep : "pre-game";
  const canProceed = preGameComplete && !pending && !syncError;
  const base = `/leagues/manage/${leagueId}`;
  const locked = data.match.status === "completed";
  const editable = (data.canEdit && !locked) || !!correction;
  const staleCorrection =
    !!correction && correction.match.revision !== data.match.revision;
  const dice = (value: number | null | undefined, sides: number) =>
    value != null && Number.isInteger(value) && value >= 1 && value <= sides;
  const checks = [
    {
      ready: preGameComplete,
      label: t("leagueUx.reportPreGameRequired"),
      step: "pre-game" as Step,
    },
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
  ];
  const ready = checks.every((check) => check.ready);
  return (
    <div className="page-width space-y-5 py-6 sm:py-8">
      <LeagueBack href={base}>{league.name}</LeagueBack>
      <LeaguePageHeader
        title={t("leagueUi.matchReport")}
        eyebrow={league.name}
        status={<LeagueStatus status={match.status} />}
        description={
          <p>
            {t(
              match.administrativeResult
                ? "leagueUi.administrativeHint"
                : locked
                  ? "leagueUi.lockedHint"
                  : data.canEdit
                    ? "leagueUx.reportCoachHint"
                    : "leagueUx.reportSpectatorHint",
            )}
          </p>
        }
      />
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
      <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3 rounded-lg border bg-secondary/35 p-4 sm:gap-5 sm:p-6">
        {[home, away].map(
          (entry, index) =>
            entry && (
              <div
                key={entry._id}
                className={`min-w-0 ${index ? "col-start-3 text-right" : ""}`}
              >
                <RosterIcon
                  rosterId={entry.team.rosterId}
                  className={`mb-2 size-9 sm:size-11 ${index ? "ml-auto" : ""}`}
                />
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  {t(index ? "leagueUi.away" : "leagueUi.home")}
                </p>
                <Link
                  href={`${base}/teams/${entry._id}`}
                  className="mt-1 block break-words text-sm font-semibold hover:text-primary sm:text-lg"
                >
                  {entry.team.name}
                </Link>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {entry.coachName} · {getRoster(entry.team.rosterId)?.name}
                </p>
                <p
                  className={`mt-1 flex items-center gap-1.5 text-[11px] text-muted-foreground ${index ? "justify-end" : ""}`}
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
        {!away && (
          <p className="col-start-3 row-start-1 text-right text-sm text-muted-foreground">
            {t("leagueUi.bye")}
          </p>
        )}
        <div className="col-start-2 row-start-1 rounded-lg border bg-card px-3 py-2 text-center font-mono text-xl font-semibold tabular-nums sm:px-5 sm:py-3 sm:text-4xl">
          {match.administrativeResult ? (
            <span className="text-sm">
              {t("leagueUi." + match.administrativeResult)}
            </span>
          ) : match.status === "bye" ? (
            "—"
          ) : match.status === "scheduled" || match.status === "void" ? (
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
        match.status !== "bye" &&
        !match.administrativeResult && (
          <>
            <nav
              aria-label={t("leagueUi.matchReport")}
              className="grid grid-cols-3 gap-1 border-b pb-2"
            >
              {steps.map((value, index) => (
                <button
                  key={value}
                  type="button"
                  aria-current={step === value ? "step" : undefined}
                  aria-controls={`report-${value}`}
                  disabled={value !== "pre-game" && !canProceed}
                  onClick={() => setStep(value)}
                  className={`flex min-h-11 items-center justify-center gap-1 rounded-md border px-2 text-xs font-medium focus-visible:outline-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-45 sm:gap-2 sm:text-sm ${step === value ? "border-border bg-secondary text-primary" : "border-transparent text-muted-foreground enabled:hover:bg-secondary/50 enabled:hover:text-foreground"}`}
                >
                  <span className="hidden size-6 shrink-0 items-center justify-center rounded-full border border-current/30 text-xs sm:flex">
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
              hidden={!pending && !syncError && !correction}
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
              <section
                className="py-1"
                aria-label={t("leagueUx.reportPreGame")}
              >
                <fieldset
                  disabled={!editable || action.busy}
                  className="space-y-4"
                >
                  <div className="grid gap-4 sm:grid-cols-2">
                    {(["home", "away"] as const).map((side) => (
                      <div
                        key={side}
                        className="min-w-0 space-y-5 rounded-lg border bg-card p-4 sm:p-5"
                      >
                        <h2 className="border-b pb-4 text-base font-semibold">
                          {side === "home" ? home.team.name : away?.team.name}
                        </h2>
                        <div className="grid grid-cols-[auto_auto_minmax(0,1fr)] items-end gap-x-3 gap-y-3 sm:gap-x-4">
                          <span className="text-xs font-medium text-muted-foreground">
                            {t("leagueUx.reportDedicatedFans")}
                          </span>
                          <span className="col-start-3 text-xs font-medium text-muted-foreground">
                            {t("leagueUi.fanAttendanceRoll")}
                          </span>
                          <strong className="flex h-11 items-center justify-center font-mono text-4xl leading-none text-primary tabular-nums">
                            {match[`${side}DedicatedFans`] ??
                              match[`${side}Snapshot`]?.staff.dedicatedFans ??
                              "—"}
                          </strong>
                          <Plus
                            aria-hidden="true"
                            className="mb-3 size-5 text-muted-foreground"
                          />
                          <DiceInput
                            label={t("leagueUi.fanAttendanceRoll")}
                            hideLabel
                            sides={3}
                            value={match[`${side}FanRoll`]}
                            onChange={(value) =>
                              changeDetails({ [`${side}FanRoll`]: value })
                            }
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                  <MatchWeather
                    value={match.weather}
                    onChange={(weather) => changeDetails({ weather })}
                  />
                  {!preGameComplete && (
                    <p className="flex items-center gap-2 text-sm text-muted-foreground">
                      <LockKeyhole className="size-4 shrink-0" />
                      {t("leagueUx.reportPreGameHint")}
                    </p>
                  )}
                </fieldset>
              </section>
            </div>
            <div
              id="report-game"
              hidden={step !== "game"}
              className="space-y-4"
            >
              <LeagueEvents
                data={view}
                editable={editable && !action.busy && canProceed}
                onSave={changeEvent}
                onDraftChange={setEventDraft}
                error={action.error}
                busy={action.busy}
              />
            </div>
            <div
              id="report-post-game"
              hidden={step !== "post-game"}
              className="space-y-4"
            >
              <LeagueEvents
                data={view}
                editable={editable && !action.busy && canProceed}
                onSave={changeEvent}
                onDraftChange={setEventDraft}
                error={action.error}
                busy={action.busy}
                review
              />
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
                          eventDraft ||
                          reason.trim().length < 3
                        }
                        onClick={() =>
                          void action
                            .run(() =>
                              correct({
                                matchId: id,
                                expectedRevision: correction.match.revision,
                                reason: reason.trim(),
                                weather: match.weather ?? null,
                                homeFanRoll: match.homeFanRoll,
                                awayFanRoll: match.awayFanRoll,
                                homeFansRoll: match.homeFansRoll,
                                awayFansRoll: match.awayFansRoll,
                                homeStalled: match.homeStalled,
                                awayStalled: match.awayStalled,
                                playEvents: view.playEvents.map(
                                  (row) => row.event,
                                ),
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
                          action.busy ||
                          eventDraft ||
                          pending > 0 ||
                          !!syncError ||
                          !ready
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
            <div className="grid grid-cols-2 items-stretch gap-3 border-t pt-4 sm:flex sm:justify-between">
              <Button
                variant="outline"
                className="min-h-12 min-w-0 whitespace-normal px-4 sm:min-w-32 sm:px-5"
                disabled={step === "pre-game"}
                onClick={() => setStep(steps[steps.indexOf(step) - 1])}
              >
                <ArrowLeft className="size-4" />
                {t("leagueUx.reportPrevious")}
              </Button>
              {step !== "post-game" && (
                <Button
                  variant="default"
                  disabled={!canProceed}
                  className="min-h-12 min-w-0 whitespace-normal px-4 sm:min-w-32 sm:px-5"
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
          <ol className="mt-4 space-y-3 text-sm">
            {history?.map((event) => (
              <li
                key={event.id}
                className="rounded-lg border bg-secondary/15 p-4"
              >
                <p>
                  <strong>
                    {t(
                      `leagueUx.reportEvent${event.kind === "recorded" ? "Recorded" : event.kind === "corrected" ? "Corrected" : "Replayed"}`,
                    )}
                  </strong>{" "}
                  <span className="ml-3 inline-flex rounded-md border bg-card px-2 py-1 font-mono font-semibold">
                    {event.scoreHome} : {event.scoreAway}
                  </span>
                  <span className="mt-2 block text-xs text-muted-foreground">
                    {event.actorName}
                  </span>
                </p>
                {event.reason && (
                  <p className="mt-3 border-l-2 border-primary/25 pl-3 text-xs text-muted-foreground">
                    {event.reason}
                  </p>
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
                    setStep("game");
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
            <div key={side} className="min-w-0 space-y-4 sm:px-2">
              <h3 className="break-words font-semibold">
                {side === "home" ? data.home.team.name : data.away?.team.name}
              </h3>
              <p className="flex items-center justify-between text-sm text-muted-foreground">
                {t("leagueUx.reportTouchdowns")}
                <strong className="font-mono text-base text-foreground">
                  {score}
                </strong>
              </p>
              <label className="flex min-h-11 items-center justify-between gap-3 rounded-lg bg-secondary/30 px-3 text-sm">
                {t("leagueUi.stalled")}
                <Switch
                  disabled={!editable}
                  checked={match[`${side}Stalled`]}
                  onCheckedChange={(checked) =>
                    onChange({ [`${side}Stalled`]: checked })
                  }
                />
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
      </fieldset>
    </LeagueSection>
  );
}
