"use client";

import Link from "next/link";
import { useState } from "react";
import { useTranslations } from "gt-next";
import { ArrowLeft, Star } from "lucide-react";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "./dialog";
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
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = stars.find((star) => star.id === selectedId);
  const partnerId =
    selected &&
    starPairs
      .find((pair) => pair.includes(selected.id))
      ?.find((id) => id !== selected.id);
  const partner = stars.find((star) => star.id === partnerId);
  const players = starsForLeague(name);
  const teams = rosters.filter((r) =>
    r.leagues.some((l) => leagueName(l) === name),
  );
  return (
    <div className="page-width space-y-6 py-6">
      <Link
        href="/rosters"
        className="inline-flex items-center gap-2 text-xs text-muted-foreground hover:underline"
      >
        <ArrowLeft className="size-3.5" />
        {t("allRosters")}
      </Link>
      <header>
        <p className="eyebrow">{t("leagues")}</p>
        <h1 className="display-font mt-2 text-3xl">{name}</h1>
        <p className="mt-3 max-w-2xl text-sm text-muted-foreground">
          {t("leagueReferenceHint")}
        </p>
      </header>
      <nav aria-label={t("leagues")} className="flex flex-wrap gap-2">
        {leagues.map((league) => (
          <Link
            key={league}
            href={`/leagues/${leagueSlug(league)}`}
            aria-current={league === name ? "page" : undefined}
            className={`rounded-full border px-3 py-1.5 text-xs ${league === name ? "bg-primary text-primary-foreground" : "bg-card hover:bg-secondary"}`}
          >
            {league}
          </Link>
        ))}
      </nav>
      <section>
        <h2 className="mb-3 text-sm font-semibold">{t("rosters")}</h2>
        <div className="flex flex-wrap gap-2">
          {teams.map((roster) => (
            <Link
              key={roster.id}
              href={`/rosters/${roster.id}`}
              className="flex items-center gap-2 rounded-lg border bg-card px-3 py-2 text-sm hover:bg-secondary"
            >
              <RosterIcon rosterId={roster.id} className="size-7" />
              {roster.name}
            </Link>
          ))}
        </div>
      </section>
      <section className="overflow-hidden rounded-xl border bg-card">
        <h2 className="flex items-center gap-2 border-b px-4 py-3 font-semibold">
          <Star className="size-4 text-muted-foreground" />
          {t("starPlayers")}
          <span className="ml-auto text-xs font-normal text-muted-foreground">
            {players.length}
          </span>
        </h2>
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
              <TableHead className="min-w-64">{t("builtInSkills")}</TableHead>
              <TableHead className="min-w-40">{t("playsFor")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {players.map((star) => (
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
                <TableCell className="font-mono">{star.cost / 1000}k</TableCell>
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
      </section>
      <Dialog
        open={!!selected}
        onOpenChange={(open) => {
          if (!open) setSelectedId(null);
        }}
      >
        <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-lg">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-3">
                  <StarPlayerIcon starId={selected.id} className="size-10" />
                  {selected.name}
                </DialogTitle>
                <DialogDescription>
                  {selected.playerType} · {selected.cost / 1000}k GP
                </DialogDescription>
              </DialogHeader>
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
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
