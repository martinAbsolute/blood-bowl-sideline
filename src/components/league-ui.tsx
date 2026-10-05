"use client";

import { LeagueNumber } from "./league-number";
import { useState, type ReactNode } from "react";
import Link from "next/link";
import { useTranslations } from "gt-next";
import { ArrowLeft, Download, History, Search, Trophy } from "lucide-react";
import { ConvexError } from "convex/values";
import { LoginButton } from "./site-shell";
import { Button } from "./ui/button";
import { ButtonGroup } from "./ui/button-group";
import { Input } from "./ui/input";
import { LeagueHelp } from "./league-help";
import { InitialLoading } from "./initial-loading";

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
        "INVALID_STATS",
        "INVALID_DICE",
        "INJURY_STAT_REQUIRED",
        "INVALID_DEATH_REPORT",
        "INELIGIBLE_PLAYER",
        "ONE_MVP_PER_TEAM_REQUIRED",
        "TOUCHDOWN_TOTAL_MISMATCH",
        "REPORT_LOCKED",
        "REPORT_NOT_STARTED",
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
    <div className="page-width py-12">
      <div className="mx-auto max-w-lg rounded-lg border bg-card p-6 text-center">
        <Trophy
          aria-hidden="true"
          className="mx-auto mb-3 size-7 text-primary"
        />
        <h1 className="mb-2 text-lg font-semibold">{t("leagues")}</h1>
        <p className="mb-5">{t("leagueUi.signIn")}</p>
        {!authenticated && <LoginButton />}
      </div>
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
      className="mb-3 inline-flex min-h-8 items-center gap-2 text-sm text-muted-foreground hover:text-primary"
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
    <section className="min-w-0 rounded-lg border bg-card p-3 sm:p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold tracking-tight">{title}</h2>
        {action}
      </div>
      {children}
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

export type LeagueStatRow = {
  id: string;
  name: string;
  detail?: string;
  href?: string;
  values: Record<string, string | number>;
};

function downloadLeagueCsv(
  title: string,
  rows: LeagueStatRow[],
  columns: readonly string[],
  label: (column: string) => string,
) {
  const cell = (value: string | number) => {
    const text =
      typeof value === "number"
        ? String(value)
        : /^[=+@-]/.test(value)
          ? `'${value}`
          : value;
    return `"${text.replaceAll('"', '""')}"`;
  };
  const csv = [
    [title, ...columns.map(label)],
    ...rows.map((row) => [
      row.name,
      ...columns.map((column) => row.values[column] ?? 0),
    ]),
  ]
    .map((row) => row.map(cell).join(","))
    .join("\r\n");
  const url = URL.createObjectURL(
    new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = "league-statistics.csv";
  link.click();
  URL.revokeObjectURL(url);
}

export function LeagueHistory({
  records,
}: {
  records: {
    id: string;
    action: string;
    createdAt: number;
    actorName: string;
    reason: string;
    details: string;
  }[];
}) {
  const t = useTranslations();
  return (
    <ul className="divide-y">
      {records.map((record) => (
        <li key={record.id} className="relative py-3 pl-7">
          <History
            aria-hidden="true"
            className="absolute left-0 top-3.5 size-3.5 text-muted-foreground"
          />
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <p className="text-sm font-medium">
              {t(`leagueUi.audit.${record.action}`)}
            </p>
            <time
              dateTime={new Date(record.createdAt).toISOString()}
              className="text-xs text-muted-foreground"
            >
              {leagueDate(record.createdAt)}
            </time>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {record.actorName}
          </p>
          {record.reason && (
            <p className="mt-2 text-sm">
              {t("leagueUi.reason")}: {record.reason}
            </p>
          )}
          <details className="mt-2 text-xs">
            <summary className="cursor-pointer text-muted-foreground">
              {t("leagueUi.showChanges")}
            </summary>
            <div className="mt-2 max-h-80 overflow-auto rounded-md border bg-secondary/15 p-3">
              <AuditDetails raw={record.details} />
            </div>
          </details>
        </li>
      ))}
    </ul>
  );
}

export function DiceInput({
  label,
  sides,
  value,
  onChange,
}: {
  label: string;
  sides: number;
  value?: number | null;
  onChange: (value: number | null) => void;
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
      <legend className="mb-2 text-xs font-medium text-muted-foreground">
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

function AuditDetails({ raw }: { raw: string }) {
  const t = useTranslations();
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return <p className="break-words text-sm">{raw}</p>;
  }
  const fields: [string, string][] = [];
  function flatten(value: unknown, path: string[]) {
    if (value && typeof value === "object") {
      for (const [key, nested] of Object.entries(value))
        flatten(nested, [...path, key]);
    } else
      fields.push([path.join(" · "), value === null ? "—" : String(value)]);
  }
  flatten(parsed, []);
  const names: Record<string, string> = {
    previous: t("leagueUi.before"),
    next: t("leagueUi.after"),
    before: t("leagueUi.before"),
    after: t("leagueUi.after"),
  };
  return (
    <dl className="space-y-2">
      {fields.map(([path, value], index) => (
        <div
          key={index}
          className="grid gap-1 border-b pb-2 text-xs sm:grid-cols-2"
        >
          <dt className="break-words text-muted-foreground">
            {path
              .split(" · ")
              .map(
                (key) => names[key] ?? key.replace(/([a-z])([A-Z])/g, "$1 $2"),
              )
              .join(" · ")}
          </dt>
          <dd className="break-words font-mono">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function LeagueStatTable({
  rows,
  columns,
  firstLabel,
  showRank = false,
}: {
  rows: LeagueStatRow[];
  columns: readonly string[];
  firstLabel: string;
  showRank?: boolean;
}) {
  const t = useTranslations();
  const [requestedOrder, setOrder] = useState(columns[0]);
  const order = columns.includes(requestedOrder) ? requestedOrder : columns[0];
  const [ascending, setAscending] = useState(false);
  const [search, setSearch] = useState("");
  const sorted = rows
    .filter((row) =>
      `${row.name} ${row.detail ?? ""}`
        .toLocaleLowerCase()
        .includes(search.trim().toLocaleLowerCase()),
    )
    .sort((a, b) => {
      const numericScore = (value: string | number) =>
        (order === "td" || order === "cas") &&
        typeof value === "string" &&
        value.includes(":")
          ? Number(value.split(":")[0])
          : value;
      const left = numericScore(a.values[order] ?? 0),
        right = numericScore(b.values[order] ?? 0);
      const comparison =
        typeof left === "number" && typeof right === "number"
          ? left - right
          : String(left).localeCompare(String(right));
      return (
        (ascending ? comparison : -comparison) ||
        Number(a.values.rank ?? 0) - Number(b.values.rank ?? 0) ||
        a.name.localeCompare(b.name)
      );
    });
  return (
    <>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <label className="relative min-w-40 flex-1 sm:max-w-xs">
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute left-2.5 top-2.5 size-4 text-muted-foreground"
          />
          <Input
            aria-label={t("leagueUx.searchTable")}
            placeholder={t("leagueUx.searchTable")}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="h-9 pl-9"
          />
        </label>
        <Button
          variant="ghost"
          size="sm"
          onClick={() =>
            downloadLeagueCsv(firstLabel, sorted, columns, (column) =>
              t(`leagueUi.stats.${column}`),
            )
          }
        >
          <Download className="size-3.5" />
          {t("leagueUi.downloadCsv")}
        </Button>
      </div>
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full border-collapse text-sm">
          <caption className="sr-only">{firstLabel}</caption>
          <thead>
            <tr className="bg-secondary/40">
              <th
                scope="col"
                className="sticky left-0 z-10 w-56 min-w-40 bg-card px-3 py-2 text-left text-xs"
              >
                {firstLabel}
              </th>
              {columns.map((column) => (
                <th
                  scope="col"
                  key={column}
                  aria-sort={
                    order === column
                      ? ascending
                        ? "ascending"
                        : "descending"
                      : "none"
                  }
                  className="whitespace-nowrap text-right"
                >
                  <div className="flex items-center justify-end gap-0.5 pl-2">
                    <LeagueHelp stat={column} />
                    <button
                      type="button"
                      aria-label={`${t("leagueUx.sortBy")} ${t(`leagueUi.stats.${column}`)}`}
                      className="min-h-9 min-w-7 rounded text-xs text-muted-foreground hover:bg-secondary focus-visible:ring-2 focus-visible:ring-ring"
                      onClick={() => {
                        setOrder(column);
                        setAscending(order === column ? !ascending : false);
                      }}
                    >
                      {order === column ? (ascending ? "↑" : "↓") : "↕"}
                    </button>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((row) => (
              <tr
                key={row.id}
                className="group border-t transition-colors hover:bg-secondary/30"
              >
                <th
                  scope="row"
                  className="sticky left-0 bg-card px-3 py-2 text-left font-medium group-hover:bg-secondary"
                >
                  {showRank && (
                    <span className="mr-3 inline-flex size-6 items-center justify-center rounded-md bg-secondary text-xs tabular-nums text-muted-foreground">
                      {row.values.rank}
                    </span>
                  )}
                  {row.href ? (
                    <Link
                      href={row.href}
                      className="text-primary hover:underline"
                    >
                      {row.name}
                    </Link>
                  ) : (
                    row.name
                  )}
                  {row.detail && (
                    <p className="mt-1 text-xs font-normal text-muted-foreground">
                      {row.detail}
                    </p>
                  )}
                </th>
                {columns.map((column) => (
                  <td
                    key={column}
                    className={`whitespace-nowrap px-3 py-2 text-right font-mono text-xs tabular-nums ${column === "pts" ? "bg-secondary/30 font-semibold" : ""}`}
                  >
                    {row.values[column] ?? 0}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {!sorted.length && (
          <p className="p-6 text-center text-sm text-muted-foreground">
            {t(search ? "leagueUx.noSearchResults" : "leagueUi.noStats")}
          </p>
        )}
      </div>
    </>
  );
}
