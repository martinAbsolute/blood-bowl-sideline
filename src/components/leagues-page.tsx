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
  Flag,
  Archive,
  LayoutList,
  BookOpen,
} from "lucide-react";
import { LibraryHeader } from "./library-header";
import { LeagueDatePicker } from "./league-date-picker";
import { DEFAULT_LEAGUE_TREASURY } from "@/domain/league-rules";
import { leagues, leagueSlug } from "@/domain/team-reference";
import { LeagueEmptyState } from "./league-layout";
import { LeagueNavigation } from "./league-navigation";
import { api } from "../../convex/_generated/api";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { LeagueField } from "./league-field";
import { LeagueCardsLoading } from "./list-loading";
import { LeagueNumber } from "./league-number";
import { LoginButton } from "./site-shell";
import { LeagueError, LeagueStatus, useLeagueAction } from "./league-ui";
import { Dialog } from "./dialog";

import {
  LeagueDialogBody,
  LeagueDialogContent,
  LeagueDialogFooter,
  LeagueDialogHeader,
} from "./league-dialog";

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
  const treasuryValid =
    treasury >= 100_000 && treasury <= 10_000_000 && treasury % 5_000 === 0;
  const dateFormat = new Intl.DateTimeFormat(
    locale === "uk" ? "uk-UA" : "en-GB",
    { dateStyle: "medium" },
  );
  async function createLeague(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!name.trim() || !treasuryValid) return;
    await action.run(async () => {
      const leagueId = await create({
        name: name.trim(),
        startAt: startDate.getTime(),
        startingTreasury: treasury,
        roundDays,
      });
      setCreating(false);
      setName("");
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
        <LeagueDialogContent showCloseButton={!busy}>
          <LeagueDialogHeader
            title={t("leagueCreate")}
            description={t("leagueUx.createNext")}
            icon={<Trophy className="size-5" />}
          />
          <form
            onSubmit={createLeague}
            className="flex min-h-0 flex-1 flex-col"
          >
            <LeagueDialogBody>
              <LeagueField>
                {t("leagueName")}
                <Input
                  required
                  disabled={busy}
                  maxLength={100}
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  autoComplete="off"
                  placeholder={t("leagueUx.namePlaceholder")}
                  className="h-11"
                />
              </LeagueField>
              <LeagueError message={action.error} />
              <fieldset disabled={busy} className="space-y-4">
                <div className="grid items-end gap-4 sm:grid-cols-2">
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
                    type="text"
                    inputMode="numeric"
                    required
                    value={treasury ? treasury.toLocaleString("uk-UA") : ""}
                    onChange={(event) => {
                      const input = event.currentTarget;
                      const digitsBeforeCursor = input.value
                        .slice(0, input.selectionStart ?? input.value.length)
                        .replace(/\D/g, "").length;
                      const digits = input.value.replace(/\D/g, "").slice(0, 8);
                      setTreasury(digits ? Number(digits) : 0);
                      requestAnimationFrame(() => {
                        const formatted = input.value;
                        let cursor = 0;
                        let seen = 0;
                        while (
                          cursor < formatted.length &&
                          seen < digitsBeforeCursor
                        ) {
                          if (/\d/.test(formatted[cursor])) seen++;
                          cursor++;
                        }
                        input.setSelectionRange(cursor, cursor);
                      });
                    }}
                    aria-invalid={!treasuryValid || undefined}
                    className="h-11 font-mono tabular-nums"
                    aria-describedby="treasury-hint"
                  />
                </LeagueField>
                <p
                  id="treasury-hint"
                  className="-mt-3 text-xs leading-relaxed text-muted-foreground"
                >
                  {t("leagueUx.treasuryHint")}
                </p>
              </fieldset>
            </LeagueDialogBody>
            <LeagueDialogFooter>
              <Button
                type="button"
                variant="outline"
                disabled={busy}
                onClick={() => setCreating(false)}
              >
                {t("cancel")}
              </Button>
              <Button
                type="submit"
                disabled={busy || !name.trim() || !treasuryValid}
              >
                {busy ? (
                  <LoaderCircle className="size-4 animate-spin" />
                ) : (
                  <Plus className="size-4" />
                )}
                {t("leagueCreate")}
              </Button>
            </LeagueDialogFooter>
          </form>
        </LeagueDialogContent>
      </Dialog>
      <div className="catalog-layout">
        <aside className="catalog-index min-w-0 space-y-4">
          <label className="relative block">
            <Search
              className="pointer-events-none absolute left-3 top-3 size-4 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              aria-label={t("leagueUx.searchLeagues")}
              placeholder={t("leagueUx.searchLeagues")}
              className="h-10 bg-card pl-9"
            />
          </label>
          <LeagueNavigation
            vertical
            label={t("leagueUx.filterSeason")}
            value={filter}
            onChange={setFilter}
            items={[
              {
                value: "all",
                label: t("leagueUx.allSeasons"),
                icon: LayoutList,
              },
              {
                value: "registration",
                label: t("leagueStatus.registration"),
                icon: Flag,
              },
              {
                value: "active",
                label: t("leagueStatus.active"),
                icon: Trophy,
              },
              {
                value: "completed",
                label: t("leagueStatus.completed"),
                icon: Archive,
              },
            ]}
          />
          <div className="hidden border-t pt-4 lg:block">
            <p className="text-xs font-medium">
              {t("leagueUx.gettingStarted")}
            </p>
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
              {t(
                isAuthenticated
                  ? "leagueUx.directoryHint"
                  : "leagueUx.directorySignIn",
              )}
            </p>
          </div>
          <details className="border-t pt-4">
            <summary className="cursor-pointer text-xs font-medium">
              {t("leagueUx.affiliations")}
            </summary>
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
              {t("leagueUx.affiliationsHint")}
            </p>
            <nav
              aria-label={t("leagueUx.affiliations")}
              className="mt-2 flex flex-col gap-1"
            >
              {leagues.map((league) => (
                <Link
                  key={league}
                  href={`/leagues/${leagueSlug(league)}`}
                  className="flex min-h-9 items-center gap-2 rounded px-2 py-1 text-xs text-muted-foreground hover:bg-secondary hover:text-primary focus-visible:outline-2 focus-visible:outline-ring"
                >
                  <BookOpen className="size-3.5 shrink-0" aria-hidden="true" />
                  {league}
                </Link>
              ))}
            </nav>
          </details>
        </aside>
        <section aria-labelledby="league-directory-title" className="min-w-0">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 id="league-directory-title" className="text-sm font-semibold">
              {t(
                filter === "all"
                  ? "leagueUx.directoryTitle"
                  : `leagueStatus.${filter}`,
              )}
            </h2>
            {status !== "LoadingFirstPage" && (
              <span
                role="status"
                className="text-xs tabular-nums text-muted-foreground"
              >
                {t("leagueUx.leaguesShown", { count: visible.length })}
              </span>
            )}
          </div>
          {status === "LoadingFirstPage" ? (
            <LeagueCardsLoading label={t("loading")} />
          ) : results.length === 0 ? (
            <LeagueEmptyState
              icon={<Trophy aria-hidden="true" className="size-6" />}
              title={t("leagueUx.emptyDirectory")}
              description={t("leagueUx.emptyDirectoryHint")}
              action={
                isAuthenticated ? (
                  <Button onClick={() => setCreating(true)}>
                    <Plus className="size-4" />
                    {t("leagueCreate")}
                  </Button>
                ) : !isLoading ? (
                  <LoginButton />
                ) : null
              }
            />
          ) : (
            <div className="grid gap-4 xl:grid-cols-2">
              {visible.map((league) => (
                <article
                  key={league._id}
                  className="overflow-hidden rounded-lg border bg-card"
                >
                  <Link
                    href={`/leagues/manage/${league._id}`}
                    className="group block min-w-0 transition-colors hover:bg-secondary/20 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"
                  >
                    <div className="relative flex min-w-0 items-start gap-3 overflow-hidden bg-primary p-4 text-primary-foreground">
                      <span
                        aria-hidden="true"
                        className="pointer-events-none absolute -right-5 -top-8 size-32 rounded-full border-[18px] border-white/5"
                      />
                      <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-white/15">
                        <Trophy className="size-5" aria-hidden="true" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <h3 className="display-font break-words text-xl leading-tight">
                          {league.name}
                        </h3>
                        <p className="mt-1 text-xs text-white/75">
                          {t("leagueUx.organizedBy", {
                            name: league.commissionerName,
                          })}
                        </p>
                        <div className="mt-3 w-fit rounded-md bg-card">
                          <LeagueStatus status={league.status} />
                        </div>
                      </div>
                      <ArrowRight
                        className="relative mt-1 size-4 shrink-0 text-white/75 transition-transform group-hover:translate-x-1 motion-reduce:transform-none"
                        aria-hidden="true"
                      />
                    </div>
                    <dl className="flex flex-wrap gap-x-5 gap-y-2 border-t bg-secondary/25 px-4 py-2.5 text-xs text-muted-foreground">
                      <div className="flex items-center gap-2">
                        <CalendarDays className="size-4 text-muted-foreground" />
                        <dt className="sr-only">
                          {t("leagueUx.plannedStart")}
                        </dt>
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
                </article>
              ))}
              {!visible.length && (
                <div className="xl:col-span-2">
                  <LeagueEmptyState
                    icon={<Search className="size-6" />}
                    title={t("leagueUx.noSearchResults")}
                    description={
                      status !== "Exhausted"
                        ? t("leagueUx.loadedSeasonsHint")
                        : undefined
                    }
                    action={
                      <Button
                        variant="outline"
                        onClick={() => {
                          setSearch("");
                          setFilter("all");
                        }}
                      >
                        {t("leagueUx.clearFilters")}
                      </Button>
                    }
                  />
                </div>
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
                {status === "LoadingMore" && (
                  <LoaderCircle
                    className="size-4 animate-spin"
                    aria-hidden="true"
                  />
                )}
                {t(status === "LoadingMore" ? "loading" : "leagueUi.loadMore")}
              </Button>
            </div>
          ) : null}
        </section>
      </div>
    </div>
  );
}
