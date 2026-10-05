"use client";

import { useLocale, useTranslations } from "gt-next";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useConvexAuth, useMutation, usePaginatedQuery } from "convex/react";
import {
  Trophy,
  Plus,
  ArrowRight,
  LoaderCircle,
  CalendarDays,
  Search,
} from "lucide-react";
import { api } from "../../convex/_generated/api";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { LeagueField, LeagueSelect } from "./league-field";
import { LeagueCardsLoading } from "./list-loading";
import { LoginButton } from "./site-shell";
import { LeagueError, LeagueStatus, useLeagueAction } from "./league-ui";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";

export function LeaguesPage() {
  const t = useTranslations();
  const locale = useLocale();
  const router = useRouter();
  const { isAuthenticated, isLoading } = useConvexAuth();
  const { results, status, loadMore } = usePaginatedQuery(
    api.leagues.list,
    {},
    { initialNumItems: 12 },
  );
  const create = useMutation(api.leagues.create);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const visible = results.filter(
    (league) =>
      (filter === "all" || league.status === filter) &&
      `${league.name} ${league.commissionerName}`
        .toLocaleLowerCase()
        .includes(search.trim().toLocaleLowerCase()),
  );
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [roundDays, setRoundDays] = useState(14);
  const action = useLeagueAction();
  const busy = action.busy;
  const dateFormat = new Intl.DateTimeFormat(
    locale === "uk" ? "uk-UA" : "en-GB",
    { dateStyle: "medium" },
  );
  async function createLeague(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await action.run(async () => {
      const leagueId = await create({
        name: name.trim(),
        startAt: startDate ? new Date(startDate).getTime() : Date.now(),
        roundDays,
      });
      router.push(`/leagues/manage/${leagueId}`);
    });
  }
  return (
    <div className="page-width py-8 sm:py-10">
      <header className="mb-5 flex flex-wrap items-start justify-between gap-5">
        <div>
          <h1 className="page-heading">{t("leagues")}</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            {t("leagueUx.directoryIntro")}
          </p>
        </div>
        {isAuthenticated ? (
          <Button onClick={() => setCreating(true)}>
            <Plus className="size-4" />
            {t("leagueCreate")}
          </Button>
        ) : isLoading ? null : (
          <LoginButton />
        )}
      </header>
      <Dialog
        open={creating && isAuthenticated}
        onOpenChange={(open) => {
          if (!busy) setCreating(open);
        }}
      >
        <DialogContent
          className="max-h-[90svh] overflow-y-auto p-6 sm:max-w-lg"
          showCloseButton={!busy}
        >
          <DialogHeader>
            <div className="mb-2 flex size-11 items-center justify-center rounded-xl bg-secondary text-primary">
              <Trophy className="size-5" aria-hidden="true" />
            </div>
            <DialogTitle className="text-xl font-semibold">
              {t("leagueCreate")}
            </DialogTitle>
            <DialogDescription>{t("leagueUx.createIntro")}</DialogDescription>
          </DialogHeader>
          <form onSubmit={createLeague} className="space-y-5">
            <LeagueError message={action.error} />
            <div className="grid gap-4 sm:grid-cols-3">
              <LeagueField className="sm:col-span-3">
                <span>{t("leagueName")}</span>
                <Input
                  required
                  maxLength={100}
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  autoComplete="off"
                  placeholder={t("leagueUx.namePlaceholder")}
                  className="h-11"
                />
              </LeagueField>
              <LeagueField className="sm:col-span-2">
                <span>{t("leagueUx.plannedStart")}</span>
                <Input
                  type="datetime-local"
                  value={startDate}
                  onChange={(event) => setStartDate(event.target.value)}
                  className="h-11 min-w-0"
                  aria-describedby="league-schedule-hint"
                />
              </LeagueField>
              <LeagueField>
                <span>{t("leagueRoundDays")}</span>
                <Input
                  type="number"
                  min={1}
                  max={60}
                  required
                  value={roundDays}
                  onChange={(event) => setRoundDays(Number(event.target.value))}
                  className="h-11"
                  aria-describedby="league-schedule-hint"
                />
              </LeagueField>
            </div>
            <p
              id="league-schedule-hint"
              className="text-xs leading-relaxed text-muted-foreground"
            >
              {t("leagueUx.scheduleHint")}
            </p>
            <div className="flex flex-col-reverse gap-3 border-t pt-5 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="outline"
                disabled={busy}
                onClick={() => setCreating(false)}
              >
                {t("cancel")}
              </Button>
              <Button type="submit" disabled={busy || !name.trim()}>
                {busy ? (
                  <LoaderCircle className="size-4 animate-spin" />
                ) : (
                  <Plus className="size-4" />
                )}
                {t("leagueCreate")}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
      <section aria-labelledby="league-directory-title">
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <h2 id="league-directory-title" className="sr-only">
            {t("leagueUx.directoryTitle")}
          </h2>
          <label className="relative min-w-48 flex-1 sm:max-w-sm">
            <Search
              className="pointer-events-none absolute left-3 top-2.5 size-4 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              aria-label={t("leagueUx.searchLeagues")}
              placeholder={t("leagueUx.searchLeagues")}
              className="h-9 pl-9"
            />
          </label>
          <LeagueSelect
            className="h-9 w-auto"
            aria-label={t("leagueUx.filterSeason")}
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
          >
            {["all", "registration", "active", "completed"].map((value) => (
              <option key={value} value={value}>
                {t(
                  value === "all"
                    ? "leagueUx.allSeasons"
                    : `leagueStatus.${value}`,
                )}
              </option>
            ))}
          </LeagueSelect>
        </div>
        {status === "LoadingFirstPage" ? (
          <LeagueCardsLoading label={t("loading")} />
        ) : results.length === 0 ? (
          <div className="rounded-2xl border bg-card px-6 py-16 text-center">
            <div className="mx-auto mb-5 flex size-16 items-center justify-center rounded-2xl bg-secondary">
              <Trophy aria-hidden="true" className="size-7 text-primary" />
            </div>
            <h3 className="text-xl font-semibold">
              {t("leagueUx.emptyDirectory")}
            </h3>
            <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
              {t("leagueUx.emptyDirectoryHint")}
            </p>
            {isAuthenticated ? (
              <Button className="mt-6" onClick={() => setCreating(true)}>
                <Plus className="size-4" />
                {t("leagueCreate")}
              </Button>
            ) : null}
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border bg-card">
            <div className="hidden grid-cols-[minmax(0,1fr)_10rem_9rem_1rem] gap-4 border-b bg-secondary/30 px-4 py-2 text-xs text-muted-foreground lg:grid">
              <span>{t("leagueName")}</span>
              <span>{t("leagueUx.plannedStart")}</span>
              <span>{t("leagueUx.seasonStatus")}</span>
              <span />
            </div>
            {visible.map((league) => (
              <Link
                key={league._id}
                href={`/leagues/manage/${league._id}`}
                className="group grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b px-4 py-3 last:border-0 hover:bg-secondary/30 focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-[-2px] lg:grid-cols-[minmax(0,1fr)_10rem_9rem_1rem] lg:gap-4"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <Trophy
                    className="size-5 shrink-0 text-primary"
                    aria-hidden="true"
                  />
                  <div className="min-w-0">
                    <h3 className="break-words text-sm font-semibold">
                      {league.name}
                    </h3>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {league.commissionerName} · BB2025 ·{" "}
                      {t("leagueUx.roundDuration", { days: league.roundDays })}
                    </p>
                  </div>
                </div>
                <span className="hidden text-xs text-muted-foreground lg:block">
                  {dateFormat.format(league.startAt)}
                </span>
                <span>
                  <LeagueStatus status={league.status} />
                </span>
                <ArrowRight
                  className="hidden size-4 text-muted-foreground group-hover:text-primary lg:block"
                  aria-hidden="true"
                />
                <span className="col-span-2 flex items-center gap-2 text-xs text-muted-foreground lg:hidden">
                  <CalendarDays className="size-3.5" />
                  {dateFormat.format(league.startAt)}
                </span>
              </Link>
            ))}
            {!visible.length && (
              <p className="p-8 text-center text-sm text-muted-foreground">
                {t("leagueUx.noSearchResults")}
              </p>
            )}
          </div>
        )}
        {(search || filter !== "all") && status !== "Exhausted" && (
          <p className="mt-3 text-xs text-muted-foreground">
            {t("leagueUx.loadedSeasonsHint")}
          </p>
        )}
        {status === "CanLoadMore" || status === "LoadingMore" ? (
          <div className="mt-6 text-center">
            <Button
              variant="outline"
              disabled={status === "LoadingMore"}
              onClick={() => loadMore(12)}
            >
              {t("leagueUi.loadMore")}
            </Button>
          </div>
        ) : null}
      </section>
    </div>
  );
}
