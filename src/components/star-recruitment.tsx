"use client";

import { Plus, Search, X } from "lucide-react";
import { useRef } from "react";
import { useTranslations } from "next-intl";
import { stars, starPairs } from "@/domain/catalog";
import type { Star } from "@/domain/types";
import { useGold } from "@/i18n/use-gold";
import { DialogClose, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "./dialog";
import { StarPlayerIcon } from "./player-icon";
import { SkillList } from "./skill-box";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table";

const playerStatLabels = ["MA", "ST", "AG", "PA", "AV"];

export function StarRecruitment({
  choices,
  search,
  onSearch,
  onHire,
}: {
  choices: Star[];
  search: string;
  onSearch: (value: string) => void;
  onHire: (id: string) => void;
}) {
  const t = useTranslations();
  const gold = useGold();
  const titleRef = useRef<HTMLHeadingElement>(null);
  const groups = choices.map((choice) => {
    const pair = starPairs.find((pair) => pair.includes(choice.id)) ?? [choice.id];
    return { choice, members: pair.map((id) => stars.find((star) => star.id === id)!) };
  });

  return (
    <DialogContent className="player-dialog star-recruitment" initialFocus={titleRef} showCloseButton={false}>
      <DialogHeader className="player-dialog-header">
        <DialogTitle
          ref={titleRef}
          tabIndex={-1}
          className="pr-12 text-xl font-semibold leading-tight outline-none sm:text-2xl"
        >
          {t("addStar")}
        </DialogTitle>
        <DialogDescription className="pr-12">{t("starHint")}</DialogDescription>
        <DialogClose
          render={<Button variant="ghost" size="icon" className="absolute right-3 top-3 size-11 sm:size-8" />}
          aria-label={t("playerModal.close")}
        >
          <X className="size-4" aria-hidden="true" />
        </DialogClose>
      </DialogHeader>
      <div className="min-h-0 overflow-auto overscroll-contain bg-card [scrollbar-gutter:stable]" data-star-player-list>
        <div className="sticky left-0 bg-card p-4 sm:px-6">
          <label className="relative block">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              className="h-11 bg-background pl-10 text-base"
              value={search}
              onChange={(event) => onSearch(event.target.value)}
              placeholder={t("leagueUx.searchStars")}
              aria-label={t("leagueUx.searchStars")}
            />
          </label>
        </div>
        {/* A native table keeps its sticky header attached to the modal body scroll area. */}
        <table className="w-full min-w-[960px] table-fixed caption-bottom text-sm" aria-label={t("starPlayers")}>
          <TableHeader className="sticky top-0 z-10 bg-muted shadow-sm">
            <TableRow>
              <TableHead scope="col" className="w-52 pl-6">
                {t("player")}
              </TableHead>
              {playerStatLabels.map((stat) => (
                <TableHead scope="col" key={stat} className="w-9 text-center font-mono text-xs">
                  {stat}
                </TableHead>
              ))}
              <TableHead scope="col">{t("skillsAndTraits")}</TableHead>
              <TableHead scope="col" className="w-20 text-right">
                {t("cost")}
              </TableHead>
              <TableHead scope="col" className="sticky right-0 w-20 bg-muted pr-6">
                <span className="sr-only">{t("addStar")}</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {groups.flatMap(({ choice, members }) =>
              members.map((star, index) => (
                <TableRow key={star.id}>
                  <TableCell className="pl-6 whitespace-normal">
                    <div className="flex items-center gap-2">
                      <StarPlayerIcon starId={star.id} className="size-9 shrink-0" />
                      <strong className="min-w-0 text-sm">{star.name}</strong>
                    </div>
                  </TableCell>
                  {[star.ma, star.st, star.ag, star.pa, star.av].map((value, i) => (
                    <TableCell key={i} className="text-center font-mono text-xs">
                      {value}
                    </TableCell>
                  ))}
                  <TableCell className="whitespace-normal">
                    <SkillList ids={star.skills} />
                  </TableCell>
                  <TableCell className="text-right font-mono text-xs tabular-nums">{gold(star.cost)}</TableCell>
                  {index === 0 && (
                    <TableCell rowSpan={members.length} className="sticky right-0 bg-card pr-6 text-right">
                      <Button
                        size="icon"
                        className="size-11"
                        aria-label={t("hireStarPlayer", { player: members.map((star) => star.name).join(" & ") })}
                        onClick={() => onHire(choice.id)}
                      >
                        <Plus className="size-4" aria-hidden="true" />
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              )),
            )}
          </TableBody>
        </table>
        {!choices.length && (
          <p role="status" className="px-6 py-12 text-center text-sm text-muted-foreground">
            {t(search.trim() ? "leagueUx.noSearchResults" : "noStars")}
          </p>
        )}
      </div>
    </DialogContent>
  );
}
