"use client";

import { useState } from "react";
import { useTranslations } from "gt-next";
import {
  CalendarDays,
  Coins,
  Flag,
  History,
  Search,
  ShieldCheck,
  TrendingUp,
  Users,
} from "lucide-react";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
import { LeagueSelect } from "./league-field";
import { LeagueEmptyState } from "./league-layout";

type HistoryRecord = {
  id: string;
  action: string;
  createdAt: number;
  actorName: string;
  reason: string;
  details: string;
};

export function auditFields(raw: string): { path: string[]; value: string }[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return raw ? [{ path: [], value: raw }] : [];
  }
  const fields: { path: string[]; value: string }[] = [];
  function flatten(value: unknown, path: string[]) {
    if (value && typeof value === "object") {
      for (const [key, nested] of Object.entries(value))
        flatten(nested, [...path, key]);
    } else fields.push({ path, value: value === null ? "—" : String(value) });
  }
  flatten(parsed, []);
  return fields;
}

function eventIcon(action: string) {
  if (/treasury|staff/.test(action)) return Coins;
  if (/advance/.test(action)) return TrendingUp;
  if (/round|deadline/.test(action)) return CalendarDays;
  if (/player|entry|team|captain/.test(action)) return Users;
  if (/correct|adjudicat|withdraw|undo/.test(action)) return ShieldCheck;
  if (/launch|creat/.test(action)) return Flag;
  return History;
}

export function auditChanges(raw: string) {
  const fields = auditFields(raw);
  const before = new Map(
    fields
      .filter((field) => ["before", "previous"].includes(field.path[0]))
      .map((field) => [JSON.stringify(field.path.slice(1)), field.value]),
  );
  const after = new Map(
    fields
      .filter((field) => ["after", "next"].includes(field.path[0]))
      .map((field) => [JSON.stringify(field.path.slice(1)), field.value]),
  );
  const changes = [...new Set([...before.keys(), ...after.keys()])].flatMap(
    (key) => {
      const previous = before.get(key),
        next = after.get(key);
      return previous === next
        ? []
        : [
            {
              path: JSON.parse(key) as string[],
              before: previous,
              after: next,
            },
          ];
    },
  );
  return {
    changes,
    context: fields.filter(
      (field) =>
        !["before", "previous", "after", "next"].includes(field.path[0]),
    ),
  };
}

function AuditDetails({ raw }: { raw: string }) {
  const t = useTranslations();
  const names: Record<string, string> = {
    previous: t("leagueUi.before"),
    next: t("leagueUi.after"),
    before: t("leagueUi.before"),
    after: t("leagueUi.after"),
    name: t("leagueUi.playerName"),
    treasury: t("leagueUi.treasury"),
    skillId: t("skills"),
    teamName: t("teamName"),
    status: t("leagueUi.playerStatus"),
    reason: t("leagueUi.reason"),
    deadlineAt: t("leagueUi.deadline"),
    sppEarned: t("leagueUi.stats.sppEarned"),
    sppSpent: t("leagueUi.stats.sppSpent"),
    weather: t("leagueUx.reportWeather"),
    scoreHome: `${t("leagueUi.home")} · ${t("leagueUi.stats.td")}`,
    scoreAway: `${t("leagueUi.away")} · ${t("leagueUi.stats.td")}`,
    homeWinnings: `${t("leagueUi.home")} · ${t("leagueUi.winnings")}`,
    awayWinnings: `${t("leagueUi.away")} · ${t("leagueUi.winnings")}`,
    homeFanRoll: `${t("leagueUi.home")} · ${t("leagueUi.fanAttendanceRoll")}`,
    awayFanRoll: `${t("leagueUi.away")} · ${t("leagueUi.fanAttendanceRoll")}`,
    homeFansRoll: `${t("leagueUi.home")} · ${t("leagueUi.dedicatedFans")}`,
    awayFansRoll: `${t("leagueUi.away")} · ${t("leagueUi.dedicatedFans")}`,
    startAt: t("leagueUx.plannedStart"),
    roundDays: t("leagueRoundDays"),
    startingTreasury: t("leagueUx.startingTreasury"),
  };
  const { changes, context } = auditChanges(raw);
  const fieldName = (path: string[]) =>
    path
      .map(
        (key) =>
          names[key] ??
          key
            .replace(/([a-z])([A-Z])/g, "$1 $2")
            .replace(/^./, (letter) => letter.toUpperCase()),
      )
      .join(" · ") || t("leagueUi.showChanges");
  const displayValue = (value: string | undefined, path: string[]) => {
    const key = path.at(-1) ?? "";
    if (
      ["startAt", "deadlineAt", "completedAt", "openedAt"].includes(key) &&
      value &&
      Number.isFinite(Number(value))
    ) {
      return new Date(Number(value)).toLocaleString(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
      });
    }
    if (
      [
        "homeStalled",
        "awayStalled",
        "withdrawn",
        "postGamePending",
        "hiringClosed",
        "temporary",
        "participated",
      ].includes(key)
    ) {
      if (value === "true") return t("yes");
      if (value === "false") return t("no");
    }
    return value ?? "—";
  };
  return (
    <div className="space-y-3">
      {!!changes.length && (
        <dl className="divide-y overflow-hidden rounded-lg border bg-card">
          {changes.map((change, index) => (
            <div key={index} className="px-3 py-3">
              <dt className="mb-2 text-xs font-medium">
                {fieldName(change.path)}
              </dt>
              <dd className="grid grid-cols-2 gap-3 text-xs">
                <div className="min-w-0 rounded-md bg-secondary/25 px-2 py-2">
                  <span className="mb-1 block text-[10px] text-muted-foreground">
                    {t("leagueUi.before")}
                  </span>
                  <span className="break-words [overflow-wrap:anywhere]">
                    {displayValue(change.before, change.path)}
                  </span>
                </div>
                <div className="min-w-0 rounded-md bg-primary/5 px-2 py-2">
                  <span className="mb-1 block text-[10px] text-muted-foreground">
                    {t("leagueUi.after")}
                  </span>
                  <span className="break-words font-medium text-primary [overflow-wrap:anywhere]">
                    {displayValue(change.after, change.path)}
                  </span>
                </div>
              </dd>
            </div>
          ))}
        </dl>
      )}
      {!!context.length && (
        <dl className="divide-y overflow-hidden rounded-lg border bg-card">
          {context.map(({ path, value }, index) => (
            <div
              key={index}
              className="grid gap-1 px-3 py-2.5 text-xs sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] sm:gap-4"
            >
              <dt className="break-words text-muted-foreground">
                {fieldName(path)}
              </dt>
              <dd className="break-words font-medium [overflow-wrap:anywhere]">
                {displayValue(value, path)}
              </dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}

export function LeagueHistory({ records }: { records: HistoryRecord[] }) {
  const t = useTranslations();
  const [search, setSearch] = useState("");
  const [action, setAction] = useState("all");
  const actions = [...new Set(records.map((record) => record.action))];
  const visible = records.filter(
    (record) =>
      (action === "all" || record.action === action) &&
      `${t(`leagueUi.audit.${record.action}`)} ${record.actorName} ${record.reason}`
        .toLocaleLowerCase()
        .includes(search.trim().toLocaleLowerCase()),
  );
  const groups = new Map<string, HistoryRecord[]>();
  for (const record of visible) {
    const day = new Date(record.createdAt).toLocaleDateString(undefined, {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
    const group = groups.get(day);
    if (group) group.push(record);
    else groups.set(day, [record]);
  }
  if (!records.length) return null;
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-2">
        <label className="relative min-w-40 flex-1">
          <Search
            className="pointer-events-none absolute left-3 top-3 size-4 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            className="h-10 bg-card pl-9"
            aria-label={t("leagueDesk.searchHistory")}
            placeholder={t("leagueDesk.searchHistory")}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </label>
        <LeagueSelect
          aria-label={t("leagueDesk.historyAction")}
          value={action}
          onChange={(event) => setAction(event.target.value)}
          className="h-10"
          wrapperClassName="w-full sm:w-52"
        >
          <option value="all">{t("leagueDesk.allActivity")}</option>
          {actions.map((value) => (
            <option key={value} value={value}>
              {t(`leagueUi.audit.${value}`)}
            </option>
          ))}
        </LeagueSelect>
      </div>
      <p className="text-xs text-muted-foreground" role="status">
        {t("leagueDesk.historyLoaded", {
          shown: visible.length,
          total: records.length,
        })}
      </p>
      {!visible.length && (
        <LeagueEmptyState
          icon={<History className="size-5" />}
          title={t("leagueUx.noSearchResults")}
          action={
            <Button
              variant="outline"
              onClick={() => {
                setSearch("");
                setAction("all");
              }}
            >
              {t("leagueUx.clearFilters")}
            </Button>
          }
        />
      )}
      {[...groups].map(([date, events]) => (
        <section key={date}>
          <h3 className="mb-3 flex items-center gap-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            <CalendarDays className="size-3.5" />
            {date}
            <span className="h-px flex-1 bg-border" />
          </h3>
          <ol className="space-y-3">
            {events.map((record) => {
              const Icon = eventIcon(record.action);
              const details = auditChanges(record.details);
              const changeCount =
                details.changes.length + details.context.length;
              return (
                <li key={record.id} className="flex gap-3">
                  <div className="flex shrink-0 flex-col items-center">
                    <span className="flex size-9 items-center justify-center rounded-lg border bg-secondary/50 text-primary">
                      <Icon className="size-4" aria-hidden="true" />
                    </span>
                    <span className="mt-2 w-px flex-1 bg-border" />
                  </div>
                  <article className="min-w-0 flex-1 overflow-hidden rounded-lg border bg-card">
                    <div className="px-4 py-3">
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <h4 className="text-sm font-semibold">
                          {t(`leagueUi.audit.${record.action}`)}
                        </h4>
                        <time
                          dateTime={new Date(record.createdAt).toISOString()}
                          className="text-[11px] text-muted-foreground"
                        >
                          {new Date(record.createdAt).toLocaleTimeString(
                            undefined,
                            { hour: "2-digit", minute: "2-digit" },
                          )}
                        </time>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {record.actorName}
                      </p>
                      {record.reason && (
                        <blockquote className="mt-3 border-l-2 border-primary/25 pl-3 text-sm leading-relaxed">
                          <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                            {t("leagueUi.reason")}
                          </span>
                          {record.reason}
                        </blockquote>
                      )}
                    </div>
                    {changeCount > 0 && (
                      <details className="border-t bg-secondary/15">
                        <summary className="cursor-pointer px-4 py-2.5 text-xs font-medium text-primary focus-visible:outline-2 focus-visible:outline-ring">
                          {t("leagueUi.showChanges")}{" "}
                          <span className="ml-1 text-muted-foreground">
                            ({changeCount})
                          </span>
                        </summary>
                        <div className="max-h-80 overflow-y-auto px-3 pb-3">
                          <AuditDetails raw={record.details} />
                        </div>
                      </details>
                    )}
                  </article>
                </li>
              );
            })}
          </ol>
        </section>
      ))}
    </div>
  );
}
