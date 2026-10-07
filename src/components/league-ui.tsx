"use client";

import { LeagueNumber } from "./league-number";
import { useState, type ReactNode } from "react";
import Link from "next/link";
import { useTranslations } from "gt-next";
import { ArrowLeft, Trophy } from "lucide-react";
import { ConvexError } from "convex/values";
import { LoginButton } from "./site-shell";
import { Button } from "./ui/button";
import { ButtonGroup } from "./ui/button-group";
import { InitialLoading } from "./initial-loading";
import { LeagueEmptyState } from "./league-layout";

export function useLeagueAction() {
  const t = useTranslations();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function run(action: () => Promise<unknown>) {
    setBusy(true);
    setError("");
    try {
      await action();
      return true;
    } catch (cause) {
      const data = cause instanceof ConvexError ? cause.data : null;
      const code =
        typeof data === "string"
          ? data
          : data &&
              typeof data === "object" &&
              "code" in data &&
              typeof data.code === "string"
            ? data.code
            : "UNKNOWN";
      const known = [
        "UNKNOWN",
        "EVENT_LIMIT",
        "EVENT_TARGET_REQUIRED",
        "EVENT_TEAM_MISMATCH",
        "EVENT_CASUALTY_REQUIRED",
        "EVENT_APOTHECARY_REQUIRED",
        "EVENT_DUPLICATE_INJURY",
        "UNAUTHENTICATED",
        "CONFLICT",
        "FORBIDDEN",
        "INVALID_INPUT",
        "LEAGUE_NAME_MISMATCH",
        "INVALID_STATS",
        "INVALID_DICE",
        "INJURY_STAT_REQUIRED",
        "INVALID_DEATH_REPORT",
        "INELIGIBLE_PLAYER",
        "ONE_MVP_PER_TEAM_REQUIRED",
        "TOUCHDOWN_TOTAL_MISMATCH",
        "REPORT_LOCKED",
        "REPORT_NOT_STARTED",
        "PRE_GAME_INCOMPLETE",
        "MATCH_IN_PROGRESS",
        "PREVIOUS_ROUND_INCOMPLETE",
        "REGISTRATION_CLOSED",
        "ALREADY_REGISTERED",
        "NOT_ENOUGH_TEAMS",
        "LEAGUE_FULL",
        "NOT_FOUND",
        "ROUND_NOT_OPEN",
        "INVALID_DEADLINE",
        "INSUFFICIENT_SPP",
        "INSUFFICIENT_TREASURY",
        "DEPENDENT_CAREER_CHANGES_REQUIRE_RECONCILIATION",
        "SPENT_SPP_CONFLICT",
        "POSTGAME_INCOMPLETE",
        "POSTGAME_REQUIRED",
        "POSTGAME_ALREADY_COMPLETED",
        "MANDATORY_ADVANCEMENT_REQUIRED",
        "ADVANCEMENT_UNAVAILABLE",
        "ILLEGAL_ADVANCEMENT",
        "ROSTER_LIMIT",
        "MINIMUM_ROSTER",
        "PLAYER_UNAVAILABLE",
        "JOURNEYMAN_UNAVAILABLE",
        "POSITION_REHIRE_AFTER_NEXT_MATCH",
        "DUPLICATE_TEAM_NAME",
        "INVALID_CAPTAIN",
        "CAPTAIN_ALREADY_ASSIGNED",
        "TEAM_REPLACEMENT_CLOSED",
        "INVALID_ROOKIE",
        "TEAM_EXPERIENCED",
        "HIRING_CLOSED",
        "CAPTAIN_REQUIRED",
        "ACTIVE_REPORT_MUST_BE_RESOLVED_FIRST",
        "ALREADY_LAUNCHED",
        "CAREER_PLAYER_LIMIT",
        "ENTRY_WITHDRAWN",
        "HIRING_MUST_PRECEDE_FIRING",
        "INVALID_PLAYER",
        "INVALID_PLAYER_CHANGES",
        "INVALID_POSITION",
        "INVALID_TREASURY",
        "JOURNEYMAN_POSITION_UNAVAILABLE",
        "ONLY_UNPLAYED_FIXTURES_CAN_BE_ADJUDICATED",
        "REPORT_NOT_COMPLETED",
        "REROLLS_CANNOT_BE_REMOVED",
        "ROUND_NOT_AVAILABLE",
        "USE_ADMINISTRATIVE_ADJUDICATION",
        "ADVANCEMENT_CORRECTION_UNAVAILABLE",
        "ADVANCEMENT_ALREADY_CAPTURED_IN_MATCH",
        "INVALID_ADVANCEMENT_LEDGER",
      ];
      setError(t(`leagueUi.errors.${known.includes(code) ? code : "UNKNOWN"}`));
      return false;
    } finally {
      setBusy(false);
    }
  }
  return { busy, error, run };
}

export function LeagueGate({
  authenticated,
  loading,
}: {
  authenticated: boolean;
  loading: boolean;
}) {
  const t = useTranslations();
  if (loading) return <InitialLoading label={t("loading")} />;
  return (
    <div className="page-width py-8 sm:py-10">
      <LeagueBack />
      <h1 className="sr-only">{t("leagues")}</h1>
      <LeagueEmptyState
        icon={<Trophy className="size-6" aria-hidden="true" />}
        title={t("leagueUx.signInTitle")}
        description={t("leagueUi.signIn")}
        action={!authenticated && <LoginButton />}
      />
    </div>
  );
}

export function LeagueBack({
  href = "/leagues",
  children,
}: {
  href?: string;
  children?: ReactNode;
}) {
  const t = useTranslations();
  return (
    <Link
      href={href}
      className="inline-flex min-h-11 items-center gap-2 rounded text-xs text-muted-foreground hover:text-primary focus-visible:outline-2 focus-visible:outline-ring sm:min-h-8"
    >
      <ArrowLeft className="size-4" />
      {children ?? t("leagues")}
    </Link>
  );
}

export function LeagueError({ message }: { message: string }) {
  const t = useTranslations();
  return message ? (
    <div
      role="alert"
      className="my-4 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm"
    >
      <p className="font-semibold text-destructive">
        {t("leagueUi.actionFailed")}
      </p>
      <p className="mt-1 break-words">{message}</p>
    </div>
  ) : null;
}

export function LeagueSection({
  title,
  children,
  action,
}: {
  title: ReactNode;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <section className="min-w-0 rounded-lg border bg-card">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-t-lg border-b bg-secondary/40 px-4 py-3">
        <h2 className="text-sm font-semibold tracking-tight">{title}</h2>
        {action}
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}

export function LeagueStatus({ status }: { status: string }) {
  const t = useTranslations();
  const tone = ["completed", "active"].includes(status)
    ? "border-emerald-700/15 bg-emerald-700/8 text-emerald-800"
    : ["registration", "open", "in-progress", "awaiting-confirmation"].includes(
          status,
        )
      ? "border-amber-700/15 bg-amber-500/10 text-amber-900"
      : ["withdrawn", "dead", "missing-next-game"].includes(status)
        ? "border-destructive/15 bg-destructive/5 text-destructive"
        : "border-border bg-secondary/50 text-muted-foreground";
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-md border px-2 py-0.5 text-[11px] font-medium ${tone}`}
    >
      <span aria-hidden="true" className="size-1.5 rounded-full bg-current" />
      {t(`leagueUi.status.${status}`)}
    </span>
  );
}

export function leagueDate(value: number) {
  return new Date(value).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export function localDateInput(value: number) {
  const date = new Date(value);
  return new Date(value - date.getTimezoneOffset() * 60_000)
    .toISOString()
    .slice(0, 16);
}

export function DiceInput({
  label,
  sides,
  value,
  onChange,
  hideLabel = false,
}: {
  label: string;
  sides: number;
  value?: number | null;
  onChange: (value: number | null) => void;
  hideLabel?: boolean;
}) {
  const t = useTranslations();
  if (sides > 6)
    return (
      <div className="space-y-1">
        <LeagueNumber
          label={label}
          min={1}
          max={sides}
          value={value ?? null}
          onChange={onChange}
        />
        {value != null && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onChange(null)}
          >
            {t("leagueUx.clearRoll")}
          </Button>
        )}
      </div>
    );
  return (
    <fieldset className="min-w-0 space-y-2">
      <legend
        className={
          hideLabel
            ? "sr-only"
            : "mb-2 text-xs font-medium text-muted-foreground"
        }
      >
        {label}
      </legend>
      <ButtonGroup aria-label={label} className="w-full">
        {Array.from({ length: sides }, (_, index) => index + 1).map((roll) => (
          <Button
            key={roll}
            type="button"
            variant={roll === value ? "default" : "outline"}
            className="h-11 min-w-0 flex-1 font-mono text-base"
            aria-label={`${label}: ${roll}`}
            aria-pressed={roll === value}
            onClick={() => onChange(roll === value ? null : roll)}
          >
            {roll}
          </Button>
        ))}
      </ButtonGroup>
    </fieldset>
  );
}

export { LeagueHistory } from "./league-history";
export { LeagueStatTable, type LeagueStatRow } from "./league-statistics";
