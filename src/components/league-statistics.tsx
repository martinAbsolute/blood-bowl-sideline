"use client";

import { useState } from "react";
import Link from "next/link";
import { useTranslations } from "gt-next";
import {
  ArrowDownWideNarrow,
  ArrowUpWideNarrow,
  Download,
  Search,
  ArrowUpRight,
} from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { LeagueSelect } from "./league-field";
import { LeagueHelp } from "./league-help";
import { LeagueEmptyState } from "./league-layout";

export type LeagueStatRow = {
  id: string;
  name: string;
  detail?: string;
  href?: string;
  values: Record<string, string | number>;
};

export function sortLeagueRows(
  rows: LeagueStatRow[],
  column: string,
  ascending: boolean,
) {
  const score = (value: string | number) =>
    (column === "td" || column === "cas") &&
    typeof value === "string" &&
    value.includes(":")
      ? Number(value.split(":")[0])
      : value;
  return [...rows].sort((a, b) => {
    const left = score(a.values[column] ?? 0),
      right = score(b.values[column] ?? 0);
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
}

function downloadCsv(
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
  const filtered = rows.filter((row) =>
    `${row.name} ${row.detail ?? ""}`
      .toLocaleLowerCase()
      .includes(search.trim().toLocaleLowerCase()),
  );
  const sorted = sortLeagueRows(filtered, order, ascending);
  const sortBy = (column: string) => {
    setOrder(column);
    setAscending(order === column ? !ascending : false);
  };
  const label = (column: string) => t(`leagueUi.stats.${column}`);
  const mobileColumns = [
    order,
    ...columns.filter((column) => column !== order),
  ].slice(0, 6);
  const extraColumns = columns.filter(
    (column) => !mobileColumns.includes(column),
  );
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <label className="relative min-w-40 flex-1">
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute left-3 top-3 size-4 text-muted-foreground"
          />
          <Input
            aria-label={t("leagueUx.searchTable")}
            placeholder={t("leagueUx.searchTable")}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="h-10 bg-card pl-9"
          />
        </label>
        <Button
          variant="outline"
          className="h-10"
          disabled={!sorted.length}
          onClick={() => downloadCsv(firstLabel, sorted, columns, label)}
        >
          <Download className="size-4" />
          {t("leagueUi.downloadCsv")}
        </Button>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p role="status" className="text-xs text-muted-foreground">
          {t("leagueDesk.resultsCount", {
            shown: sorted.length,
            total: rows.length,
          })}
        </p>
        <div className="flex min-w-0 items-center gap-2">
          <LeagueSelect
            aria-label={t("leagueUx.sortBy")}
            value={order}
            onChange={(event) => {
              setOrder(event.target.value);
              setAscending(false);
            }}
            className="h-9 text-xs"
            wrapperClassName="min-w-0 max-w-52"
          >
            {columns.map((column) => (
              <option key={column} value={column}>
                {t("leagueUx.sortBy")} {label(column)}
              </option>
            ))}
          </LeagueSelect>
          <Button
            variant="outline"
            size="icon"
            className="size-9 shrink-0"
            aria-label={t(
              ascending ? "leagueDesk.ascending" : "leagueDesk.descending",
            )}
            onClick={() => setAscending(!ascending)}
          >
            {ascending ? (
              <ArrowUpWideNarrow className="size-4" />
            ) : (
              <ArrowDownWideNarrow className="size-4" />
            )}
          </Button>
        </div>
      </div>
      {!sorted.length ? (
        <LeagueEmptyState
          icon={<Search className="size-5" />}
          title={t(search ? "leagueUx.noSearchResults" : "leagueUi.noStats")}
          action={
            search ? (
              <Button variant="outline" onClick={() => setSearch("")}>
                {t("leagueUx.clearFilters")}
              </Button>
            ) : undefined
          }
        />
      ) : (
        <>
          <ol className="space-y-3 md:hidden" aria-label={firstLabel}>
            {sorted.map((row) => (
              <li
                key={row.id}
                className="overflow-hidden rounded-lg border bg-card"
              >
                <div className="flex items-start gap-3 border-b bg-secondary/25 p-3">
                  {showRank && (
                    <span
                      className={`flex size-8 shrink-0 items-center justify-center rounded-md border font-mono text-sm font-semibold ${Number(row.values.rank) === 1 ? "border-primary bg-primary text-primary-foreground" : "bg-card text-muted-foreground"}`}
                    >
                      {row.values.rank}
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    {row.href ? (
                      <Link
                        href={row.href}
                        className="flex items-start justify-between gap-2 break-words text-sm font-semibold text-primary"
                      >
                        {row.name}
                        <ArrowUpRight className="mt-0.5 size-4 shrink-0" />
                      </Link>
                    ) : (
                      <p className="break-words text-sm font-semibold">
                        {row.name}
                      </p>
                    )}
                    {row.detail && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        {row.detail}
                      </p>
                    )}
                  </div>
                </div>
                <StatisticValues
                  row={row}
                  columns={mobileColumns}
                  order={order}
                  label={label}
                />
                {!!extraColumns.length && (
                  <details className="border-t">
                    <summary className="cursor-pointer px-3 py-2.5 text-xs font-medium text-primary">
                      {t("leagueUx.allStats")}
                    </summary>
                    <StatisticValues
                      row={row}
                      columns={extraColumns}
                      order={order}
                      label={label}
                    />
                  </details>
                )}
              </li>
            ))}
          </ol>
          <div className="hidden overflow-x-auto rounded-lg border md:block">
            <table className="w-full border-collapse text-sm">
              <caption className="sr-only">{firstLabel}</caption>
              <thead>
                <tr className="bg-secondary/40">
                  <th
                    scope="col"
                    className="sticky left-0 z-10 w-64 min-w-48 bg-secondary px-4 py-3 text-left text-xs"
                  >
                    {firstLabel}
                  </th>
                  {columns.map((column) => (
                    <th
                      key={column}
                      scope="col"
                      aria-sort={
                        order === column
                          ? ascending
                            ? "ascending"
                            : "descending"
                          : "none"
                      }
                      className="whitespace-nowrap text-right"
                    >
                      <div className="flex items-center justify-end pl-2">
                        <LeagueHelp stat={column} />
                        <button
                          type="button"
                          aria-label={`${t("leagueUx.sortBy")} ${label(column)}`}
                          className="min-h-11 min-w-8 rounded text-xs text-muted-foreground hover:bg-secondary focus-visible:ring-2 focus-visible:ring-ring"
                          onClick={() => sortBy(column)}
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
                    className="group border-t hover:bg-secondary/20"
                  >
                    <th
                      scope="row"
                      className="sticky left-0 bg-card px-4 py-3 text-left font-medium group-hover:bg-secondary"
                    >
                      <div className="flex items-start gap-3">
                        {showRank && (
                          <span
                            className={`flex size-7 shrink-0 items-center justify-center rounded-md font-mono text-xs ${Number(row.values.rank) === 1 ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"}`}
                          >
                            {row.values.rank}
                          </span>
                        )}
                        <div className="min-w-0">
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
                        </div>
                      </div>
                    </th>
                    {columns.map((column) => (
                      <td
                        key={column}
                        className={`whitespace-nowrap px-3 py-3 text-right font-mono text-xs tabular-nums ${column === order ? "bg-secondary/35 font-semibold text-primary" : ""}`}
                      >
                        {row.values[column] ?? 0}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

function StatisticValues({
  row,
  columns,
  order,
  label,
}: {
  row: LeagueStatRow;
  columns: readonly string[];
  order: string;
  label: (column: string) => string;
}) {
  return (
    <dl className="grid grid-cols-3 gap-px bg-border">
      {columns.map((column) => (
        <div
          key={column}
          className={`min-w-0 px-3 py-2.5 ${column === order ? "bg-secondary" : "bg-card"}`}
        >
          <dt className="text-[10px] leading-4 text-muted-foreground">
            {label(column)}
          </dt>
          <dd className="mt-1 break-words font-mono text-sm font-semibold tabular-nums">
            {row.values[column] ?? 0}
          </dd>
        </div>
      ))}
    </dl>
  );
}
