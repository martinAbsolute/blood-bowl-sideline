"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useTranslations } from "gt-next";
import { ArrowUpRight, BookOpen, Search, Star } from "lucide-react";
import { LeagueEmptyState, LeaguePageHeader } from "./league-layout";
import { LeagueBack } from "./league-ui";
import { LeagueSelect } from "./league-field";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
import {
  LeagueDialogBody,
  LeagueDialogContent,
  LeagueDialogFooter,
  LeagueDialogHeader,
} from "./league-dialog";
import { rosters, stars, starPairs } from "@/domain/catalog";
import {
  leagues,
  leagueName,
  leagueSlug,
  starsForLeague,
} from "@/domain/team-reference";
import { RosterIcon, StarPlayerIcon } from "./player-icon";
import { SkillList } from "./skill-box";
import { LeagueLinks, SpecialRules } from "./team-affiliations";
import { Dialog } from "./dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "./ui/table";

export function LeagueReference({ name }: { name: string }) {
  const t = useTranslations();
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = stars.find((star) => star.id === selectedId);
  const partnerId =
    selected &&
    starPairs
      .find((pair) => pair.includes(selected.id))
      ?.find((id) => id !== selected.id);
  const partner = stars.find((star) => star.id === partnerId);
  const players = starsForLeague(name);
  const visiblePlayers = players.filter((star) =>
    star.name.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()),
  );
  const teams = rosters.filter((r) =>
    r.leagues.some((l) => leagueName(l) === name),
  );
  return (
    <div className="page-width space-y-5 py-6 sm:py-8">
      <LeagueBack href="/rosters">{t("allRosters")}</LeagueBack>
      <LeaguePageHeader
        title={name}
        eyebrow={t("leagueUx.affiliations")}
        description={t("leagueReferenceHint")}
        icon={<BookOpen className="size-6" aria-hidden="true" />}
      >
        <span>
          {teams.length} {t("rosters")}
        </span>
        <span>
          {players.length} {t("starPlayers")}
        </span>
        <span>BB2025</span>
      </LeaguePageHeader>
      <div className="catalog-layout">
        <aside className="catalog-index min-w-0">
          <LeagueSelect
            wrapperClassName="lg:hidden"
            aria-label={t("leagueUx.affiliations")}
            value={name}
            onChange={(event) => {
              setSearch("");
              router.push(`/leagues/${leagueSlug(event.target.value)}`);
            }}
          >
            {leagues.map((league) => (
              <option key={league} value={league}>
                {league}
              </option>
            ))}
          </LeagueSelect>
          <nav
            aria-label={t("leagueUx.affiliations")}
            className="hidden flex-col gap-1 lg:flex"
          >
            {leagues.map((league) => (
              <Link
                key={league}
                href={`/leagues/${leagueSlug(league)}`}
                aria-current={league === name ? "page" : undefined}
                onClick={() => setSearch("")}
                className={`flex min-h-10 items-center gap-2 rounded-md border px-3 py-2 text-xs focus-visible:outline-2 focus-visible:outline-ring ${league === name ? "border-border bg-secondary font-semibold text-primary" : "border-transparent text-muted-foreground hover:bg-secondary/50"}`}
              >
                <BookOpen className="size-3.5 shrink-0" aria-hidden="true" />
                {league}
              </Link>
            ))}
          </nav>
        </aside>
        <div className="min-w-0 space-y-5">
          <section className="overflow-hidden rounded-lg border bg-card">
            <h2 className="border-b bg-secondary/40 px-4 py-3 text-sm font-semibold">
              {t("rosters")}
            </h2>
            <div className="grid sm:grid-cols-2 xl:grid-cols-3">
              {teams.map((roster) => (
                <Link
                  key={roster.id}
                  href={`/rosters/${roster.id}`}
                  className="group flex min-w-0 items-center gap-3 p-3 text-sm hover:bg-secondary/40 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"
                >
                  <RosterIcon rosterId={roster.id} className="size-7" />
                  <span className="min-w-0 flex-1">{roster.name}</span>
                  <ArrowUpRight
                    className="size-3.5 shrink-0 text-muted-foreground group-hover:text-primary"
                    aria-hidden="true"
                  />
                </Link>
              ))}
            </div>
          </section>
          <section className="overflow-hidden rounded-lg border bg-card">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b bg-secondary/40 px-4 py-3">
              <h2 className="flex items-center gap-2 text-sm font-semibold">
                <Star className="size-4 text-muted-foreground" />
                {t("starPlayers")}
                <span className="text-xs font-normal tabular-nums text-muted-foreground">
                  {visiblePlayers.length}
                </span>
              </h2>
              <label className="relative w-full sm:w-56">
                <Search
                  className="absolute left-3 top-2.5 size-4 text-muted-foreground"
                  aria-hidden="true"
                />
                <Input
                  className="h-9 bg-card pl-9"
                  aria-label={t("leagueUx.searchStars")}
                  placeholder={t("leagueUx.searchStars")}
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
              </label>
            </div>
            <div className="divide-y md:hidden">
              {visiblePlayers.map((star) => (
                <button
                  key={star.id}
                  type="button"
                  onClick={() => setSelectedId(star.id)}
                  className="flex w-full items-center gap-3 p-4 text-left hover:bg-secondary/30 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"
                >
                  <StarPlayerIcon
                    starId={star.id}
                    className="size-10 shrink-0"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold">
                      {star.name}
                    </span>
                    <span className="mt-1 block text-xs text-muted-foreground">
                      {star.playerType}
                    </span>
                  </span>
                  <span className="font-mono text-sm">{star.cost / 1000}k</span>
                  <ArrowUpRight
                    className="size-4 shrink-0 text-muted-foreground"
                    aria-hidden="true"
                  />
                </button>
              ))}
            </div>
            <div className="hidden md:block">
              <Table className="reference-table" aria-label={t("starPlayers")}>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-52">{t("player")}</TableHead>
                    <TableHead>{t("cost")}</TableHead>
                    {["MA", "ST", "AG", "PA", "AV"].map((stat) => (
                      <TableHead key={stat} className="text-center">
                        {stat}
                      </TableHead>
                    ))}
                    <TableHead className="min-w-64">
                      {t("builtInSkills")}
                    </TableHead>
                    <TableHead className="min-w-40">{t("playsFor")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visiblePlayers.map((star) => (
                    <TableRow key={star.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <StarPlayerIcon starId={star.id} className="size-8" />
                          <button
                            type="button"
                            onClick={() => setSelectedId(star.id)}
                            className="whitespace-normal text-left font-medium underline decoration-border underline-offset-4 hover:decoration-current"
                          >
                            {star.name}
                          </button>
                        </div>
                      </TableCell>
                      <TableCell className="font-mono">
                        {star.cost / 1000}k
                      </TableCell>
                      {[star.ma, star.st, star.ag, star.pa, star.av].map(
                        (stat, i) => (
                          <TableCell key={i} className="text-center font-mono">
                            {stat}
                          </TableCell>
                        ),
                      )}
                      <TableCell className="whitespace-normal">
                        <SkillList ids={star.skills} />
                      </TableCell>
                      <TableCell className="whitespace-normal text-muted-foreground">
                        {star.playsFor.join(", ")}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            {!visiblePlayers.length && (
              <LeagueEmptyState
                icon={<Search className="size-6" />}
                title={t("leagueUx.noSearchResults")}
              />
            )}
          </section>
        </div>
      </div>
      <Dialog
        open={!!selected}
        onOpenChange={(open) => {
          if (!open) setSelectedId(null);
        }}
      >
        <LeagueDialogContent className="sm:max-w-lg">
          {selected && (
            <>
              <LeagueDialogHeader
                title={selected.name}
                description={`${selected.playerType} · ${selected.cost / 1000}k GP`}
                icon={
                  <StarPlayerIcon starId={selected.id} className="size-9" />
                }
              />
              <LeagueDialogBody>
                <dl className="grid grid-cols-5 gap-2 rounded-lg border bg-secondary/30 p-3">
                  {["MA", "ST", "AG", "PA", "AV"].map((stat, i) => (
                    <div key={stat} className="text-center">
                      <dt className="text-xs text-muted-foreground">{stat}</dt>
                      <dd className="mt-1 font-mono">
                        {
                          [
                            selected.ma,
                            selected.st,
                            selected.ag,
                            selected.pa,
                            selected.av,
                          ][i]
                        }
                      </dd>
                    </div>
                  ))}
                </dl>
                <div>
                  <p className="mb-2 text-xs text-muted-foreground">
                    {t("builtInSkills")}
                  </p>
                  <SkillList ids={selected.skills} />
                </div>
                <div className="text-sm">
                  <p className="mb-2 text-xs text-muted-foreground">
                    {t("playsFor")}
                  </p>
                  <LeagueLinks
                    names={selected.playsFor.filter((name) =>
                      leagues.includes(leagueName(name)),
                    )}
                  />
                  <SpecialRules
                    names={selected.playsFor.filter((name) =>
                      name.startsWith("Favoured of"),
                    )}
                  />
                  {selected.playsFor
                    .filter(
                      (name) =>
                        !leagues.includes(leagueName(name)) &&
                        !name.startsWith("Favoured of"),
                    )
                    .map((name) => (
                      <p key={name}>{name}</p>
                    ))}
                </div>
                {partner && (
                  <p className="rounded-lg border bg-secondary/30 p-3 text-sm">
                    {t("pairedHire", { player: partner.name })}
                  </p>
                )}
              </LeagueDialogBody>
              <LeagueDialogFooter>
                <Button variant="outline" onClick={() => setSelectedId(null)}>
                  {t("close")}
                </Button>
              </LeagueDialogFooter>
            </>
          )}
        </LeagueDialogContent>
      </Dialog>
    </div>
  );
}
