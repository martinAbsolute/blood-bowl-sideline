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
  const [createStep, setCreateStep] = useState<"setup" | "review">("setup");
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
    if (createStep === "setup") {
      setCreateStep("review");
      return;
    }
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
      <header className="mb-6 flex flex-wrap items-start justify-between gap-5 rounded-xl border bg-card p-5 sm:p-6">
        <div className="min-w-0 max-w-2xl">
          <p className="mb-3 flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            <Trophy className="size-4 text-primary" />
            {t("leagueUx.leagueHub")}
          </p>
          <h1 className="page-heading">{t("leagues")}</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            {t("leagueUx.hubIntro")}
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
          if (!busy) {
            setCreating(open);
            if (!open) setCreateStep("setup");
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
          <div className="grid grid-cols-2 gap-2 rounded-lg bg-secondary/50 p-1">
            {["setup", "review"].map((step, index) => (
              <div
                key={step}
                aria-current={createStep === step ? "step" : undefined}
                className={`rounded-md px-3 py-2 text-sm ${createStep === step ? "bg-card font-semibold shadow-sm" : "text-muted-foreground"}`}
              >
                {index + 1}.{" "}
                {t(`leagueUx.create${step === "setup" ? "Setup" : "Review"}`)}
              </div>
            ))}
          </div>
          <form onSubmit={createLeague} className="space-y-5">
            <LeagueError message={action.error} />
            <div hidden={createStep !== "setup"} className="space-y-5">
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
              <LeagueField>
                <span>{t("leagueUx.plannedStart")}</span>
                <Input
                  type="datetime-local"
                  value={startDate}
                  onChange={(event) => setStartDate(event.target.value)}
                  className="h-11 min-w-0"
                  aria-describedby="league-schedule-hint"
                />
              </LeagueField>
              <div className="space-y-2">
                <LeagueNumber
                  label={t("leagueRoundDays")}
                  min={1}
                  max={60}
                  value={roundDays}
                  onChange={setRoundDays}
                />
                <div className="grid grid-cols-3 gap-2">
                  {[7, 14, 21].map((days) => (
                    <Button
                      key={days}
                      type="button"
                      variant={roundDays === days ? "secondary" : "outline"}
                      className="h-10"
                      aria-pressed={roundDays === days}
                      onClick={() => setRoundDays(days)}
                    >
                      {t("leagueUx.days", { days })}
                    </Button>
                  ))}
                </div>
              </div>
              <p
                id="league-schedule-hint"
                className="text-xs leading-relaxed text-muted-foreground"
              >
                {t("leagueUx.scheduleHint")}
              </p>
            </div>
            {createStep === "review" && (
              <div className="space-y-4">
                <div className="rounded-xl border bg-secondary/20 p-5">
                  <h3 className="break-words text-xl font-semibold">
                    {name.trim()}
                  </h3>
                  <dl className="mt-4 space-y-3 text-sm">
                    <div className="flex flex-wrap justify-between gap-2">
                      <dt className="text-muted-foreground">
                        {t("leagueUx.plannedStart")}
                      </dt>
                      <dd>
                        {startDate
                          ? new Date(startDate).toLocaleString(
                              locale === "uk" ? "uk-UA" : "en-GB",
                            )
                          : t("leagueUx.startWhenReady")}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-2">
                      <dt className="text-muted-foreground">
                        {t("leagueRoundDays")}
                      </dt>
                      <dd>{roundDays}</dd>
                    </div>
                    <div className="flex justify-between gap-2">
                      <dt className="text-muted-foreground">
                        {t("leagueUx.format")}
                      </dt>
                      <dd>BB2025 · {t("leagueUx.roundRobin")}</dd>
                    </div>
                  </dl>
                </div>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {t("leagueUx.createNextHint")}
                </p>
              </div>
            )}
            <div className="flex flex-col-reverse gap-3 border-t pt-5 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="outline"
                disabled={busy}
                onClick={() =>
                  createStep === "review"
                    ? setCreateStep("setup")
                    : setCreating(false)
                }
              >
                {t(createStep === "review" ? "leagueUx.backToSetup" : "cancel")}
              </Button>
              <Button type="submit" disabled={busy || !name.trim()}>
                {busy ? (
                  <LoaderCircle className="size-4 animate-spin" />
                ) : (
                  <Plus className="size-4" />
                )}
                {t(
                  createStep === "setup"
                    ? "leagueUx.createReview"
                    : "leagueCreate",
                )}
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
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {visible.map((league) => (
              <Link
                key={league._id}
                href={`/leagues/manage/${league._id}`}
                className="group flex min-w-0 flex-col items-start gap-4 rounded-xl border bg-card p-5 transition-colors hover:border-primary/40 hover:bg-secondary/20 focus-visible:outline-2 focus-visible:outline-ring"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <span className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-secondary">
                    <Trophy
                      className="size-5 text-primary"
                      aria-hidden="true"
                    />
                  </span>
                  <div className="min-w-0">
                    <h3 className="break-words text-base font-semibold">
                      {league.name}
                    </h3>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {league.commissionerName} · BB2025 ·{" "}
                      {t("leagueUx.roundDuration", { days: league.roundDays })}
                    </p>
                  </div>
                </div>
                <div className="mt-auto flex w-full flex-wrap items-center justify-between gap-2 border-t pt-4">
                  <LeagueStatus status={league.status} />
                  <span className="flex items-center gap-2 text-xs text-muted-foreground">
                    <CalendarDays className="size-3.5" />
                    {dateFormat.format(league.startAt)}
                  </span>
                </div>
                <span className="flex w-full items-center justify-between text-sm font-medium text-primary">
                  {t("leagueUx.openLeague")}
                  <ArrowRight
                    className="size-4 transition-transform group-hover:translate-x-1"
                    aria-hidden="true"
                  />
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
