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
  Coins,
  Clock3,
  Search,
} from "lucide-react";
import { LibraryHeader } from "./library-header";
import { LeagueDatePicker } from "./league-date-picker";
import { DEFAULT_LEAGUE_TREASURY } from "@/domain/league-rules";
import { Card } from "./ui/card";
import { api } from "../../convex/_generated/api";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { LeagueField, LeagueSelect } from "./league-field";
import { LeagueCardsLoading } from "./list-loading";
import { LeagueNumber } from "./league-number";
import { LoginButton } from "./site-shell";
import { LeagueError, LeagueStatus, useLeagueAction } from "./league-ui";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "./dialog";

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
  const [startDate, setStartDate] = useState(() => new Date());
  const [treasury, setTreasury] = useState(DEFAULT_LEAGUE_TREASURY);
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
        startAt: startDate.getTime(),
        startingTreasury: treasury,
        roundDays,
      });
      router.push(`/leagues/manage/${leagueId}`);
    });
  }
  return (
    <div className="page-width py-8 sm:py-10">
      <LibraryHeader
        title={t("leagues")}
        description={t("leagueUx.directoryIntro")}
        action={
          isAuthenticated ? (
            <Button onClick={() => setCreating(true)}>
              <Plus className="size-4" />
              {t("leagueCreate")}
            </Button>
          ) : isLoading ? null : (
            <LoginButton />
          )
        }
      />
      <Dialog
        open={creating && isAuthenticated}
        onOpenChange={(open) => {
          if (!busy) {
            setCreating(open);
          }
        }}
      >
        <DialogContent
          className="max-h-[90svh] overflow-y-auto p-5 sm:max-w-xl sm:p-6"
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
            <fieldset disabled={busy} className="space-y-5">
              <LeagueField>
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
              <div className="grid gap-4 sm:grid-cols-2">
                <LeagueDatePicker
                  value={startDate}
                  onChange={setStartDate}
                  disabled={busy}
                />
                <LeagueNumber
                  label={t("leagueRoundDays")}
                  min={1}
                  max={60}
                  value={roundDays}
                  onChange={setRoundDays}
                  disabled={busy}
                />
              </div>
              <LeagueField>
                <span>{t("leagueUx.startingTreasury")}</span>
                <Input
                  type="number"
                  min={100000}
                  max={10000000}
                  step={5000}
                  required
                  value={treasury || ""}
                  onChange={(event) => setTreasury(Number(event.target.value))}
                  className="h-11"
                  aria-describedby="treasury-hint"
                />
              </LeagueField>
              <p
                id="treasury-hint"
                className="-mt-3 text-xs leading-relaxed text-muted-foreground"
              >
                {t("leagueUx.treasuryHint")}
              </p>
              <div className="rounded-lg bg-secondary/40 px-4 py-3 text-xs leading-relaxed text-muted-foreground">
                {t("leagueUx.creationRules")}
              </div>
            </fieldset>
            <div className="flex justify-end gap-3 border-t pt-5">
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
        <div className="mb-7 flex flex-wrap items-center gap-3">
          <h2 id="league-directory-title" className="sr-only">
            {t("leagueUx.directoryTitle")}
          </h2>
          <label className="relative min-w-48 flex-1">
            <Search
              className="pointer-events-none absolute left-3 top-3 size-4 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              aria-label={t("leagueUx.searchLeagues")}
              placeholder={t("leagueUx.searchLeagues")}
              className="h-10 pl-9"
            />
          </label>
          <LeagueSelect
            className="h-10 w-auto"
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
          <div className="grid gap-5">
            {visible.map((league) => (
              <Card
                key={league._id}
                className="gap-0 rounded-2xl py-0 shadow-sm"
              >
                <Link
                  href={`/leagues/manage/${league._id}`}
                  className="group grid min-w-0 gap-5 p-5 transition-colors hover:bg-secondary/20 focus-visible:outline-2 focus-visible:outline-ring sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:p-6"
                >
                  <div className="flex min-w-0 items-center gap-4">
                    <span className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-primary/10">
                      <Trophy
                        className="size-6 text-primary"
                        aria-hidden="true"
                      />
                    </span>
                    <div className="min-w-0">
                      <h3 className="break-words text-lg font-semibold group-hover:text-primary">
                        {league.name}
                      </h3>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {league.commissionerName}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <LeagueStatus status={league.status} />
                    <ArrowRight
                      className="size-4 text-primary transition-transform group-hover:translate-x-1"
                      aria-hidden="true"
                    />
                  </div>
                  <dl className="flex flex-wrap gap-x-8 gap-y-3 border-t pt-4 text-sm sm:col-span-2">
                    <div className="flex items-center gap-2">
                      <CalendarDays className="size-4 text-muted-foreground" />
                      <dt className="sr-only">{t("leagueUx.plannedStart")}</dt>
                      <dd>{dateFormat.format(league.startAt)}</dd>
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock3 className="size-4 text-muted-foreground" />
                      <dt className="sr-only">{t("leagueRoundDays")}</dt>
                      <dd>
                        {t("leagueUx.roundDuration", {
                          days: league.roundDays,
                        })}
                      </dd>
                    </div>
                    <div className="flex items-center gap-2">
                      <Coins className="size-4 text-muted-foreground" />
                      <dt className="text-muted-foreground">
                        {t("leagueUi.treasury")}
                      </dt>
                      <dd>
                        {(
                          league.startingTreasury ?? DEFAULT_LEAGUE_TREASURY
                        ).toLocaleString("uk-UA")}{" "}
                        {t("leagueUx.goldUnit")}
                      </dd>
                    </div>
                  </dl>
                </Link>
              </Card>
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
