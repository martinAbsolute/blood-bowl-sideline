"use client";

import { useRef, useState } from "react";
import { useTranslations } from "gt-next";
import { getRoster, getRuleset } from "@/domain/catalog";
import { isSevens, isLineman } from "@/domain/rules";
import { needsPlayerRecruitment } from "@/lib/builder";
import type { Team } from "@/domain/types";
import { PlayerIcon } from "./player-icon";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "./ui/accordion";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
import { Button } from "./ui/button";
import { SkillList, TableSkills } from "./skill-box";
import { positionLabel } from "./position-name";
import { QuantityStepper } from "./quantity-stepper";

export function PlayerRecruitment({
  team,
  onChange,
}: {
  team: Team;
  onChange: (team: Team) => void;
}) {
  const t = useTranslations();
  const roster = getRoster(team.rosterId)!;
  const [pendingRemoval, setPendingRemoval] = useState<string | null>(null);
  // null follows roster needs; a manual toggle lasts for this roster session.
  const [recruitOpen, setRecruitOpen] = useState<boolean | null>(null);
  const removalTrigger = useRef<HTMLElement | null>(null);
  const cancelButton = useRef<HTMLButtonElement | null>(null);
  const pendingPlayer = team.players.find((p) => p.id === pendingRemoval);
  const pendingPosition = roster.players.find(
    (p) => p.id === pendingPlayer?.positionId,
  );
  const playerCount = team.players.length + team.stars.length;
  const needsPlayers = needsPlayerRecruitment(team);
  const rules = getRuleset(team.rulesetId);
  const sevens = isSevens(team);
  const specialists = team.players.filter((player) => {
    const position = roster.players.find((p) => p.id === player.positionId);
    return position && !isLineman(position);
  }).length;

  function updateRecruitment(next: Team) {
    // Keep the controls in place while recruiting, even at the minimum.
    setRecruitOpen(true);
    onChange(next);
  }

  function removePlayer(id: string) {
    const next = { ...team, players: team.players.filter((p) => p.id !== id) };
    if (next.captainId === id) delete next.captainId;
    if (next.veteranId === id) delete next.veteranId;
    updateRecruitment(next);
    setPendingRemoval(null);
  }

  return (
    <>
      <Accordion
        value={(recruitOpen ?? needsPlayers) ? ["recruit"] : []}
        onValueChange={(value) => setRecruitOpen(value.includes("recruit"))}
        className="no-print recruitment-menu player-recruitment rounded-lg border bg-card"
      >
        <AccordionItem value="recruit">
          <AccordionTrigger className="items-center rounded-none rounded-t-lg aria-[expanded=false]:rounded-b-lg bg-secondary px-4 py-3.5 text-base font-semibold hover:no-underline [&>svg]:text-primary">
            {t("recruitPlayers")}
          </AccordionTrigger>
          <AccordionContent className="border-t p-0">
            {sevens && (
              <div
                className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2 text-xs text-muted-foreground"
                role="status"
              >
                <span>
                  {t(
                    playerCount < rules.minPlayers
                      ? "sevensRecruitMore"
                      : "sevensBench",
                    {
                      count: Math.max(0, rules.minPlayers - playerCount),
                      remaining: Math.max(0, rules.maxPlayers - playerCount),
                    },
                  )}
                </span>
                <span className="font-mono">
                  {t("sevensSpecialists", { count: specialists, max: 4 })}
                </span>
              </div>
            )}
            <Table
              aria-label={t("recruitPlayers")}
              className="min-w-[740px] table-auto md:table-fixed"
            >
              <TableHeader>
                <TableRow>
                  <TableHead className="w-48 pl-3">{t("player")}</TableHead>
                  {["MA", "ST", "AG", "PA", "AV"].map((stat) => (
                    <TableHead
                      key={stat}
                      className="w-8 text-center font-mono text-xs"
                    >
                      {stat}
                    </TableHead>
                  ))}
                  <TableHead>{t("skills")}</TableHead>
                  <TableHead className="w-14 text-right">{t("cost")}</TableHead>
                  <TableHead className="sticky right-0 w-32 bg-card pr-3 text-right">
                    {t("quantity")}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {roster.players.map((p) => {
                  const matching = team.players.filter(
                    (x) => x.positionId === p.id,
                  );
                  const max = Math.min(
                    Number(p.qty.split("-")[1]),
                    rules.maxPlayers,
                  );
                  return (
                    <TableRow key={p.id} className="h-12">
                      <TableCell className="pl-3">
                        <div className="flex items-center gap-2">
                          <PlayerIcon positionId={p.id} className="size-8" />
                          <strong
                            className="truncate text-sm"
                            title={positionLabel(p.position)}
                          >
                            {positionLabel(p.position)}
                          </strong>
                        </div>
                        {sevens && (
                          <p className="mt-1 text-xs text-muted-foreground">
                            {t(
                              isLineman(p)
                                ? "sevensLineman"
                                : "sevensSpecialist",
                            )}
                          </p>
                        )}
                      </TableCell>
                      {[p.ma, p.st, p.ag, p.pa, p.av].map((stat, index) => (
                        <TableCell
                          key={index}
                          className="text-center font-mono text-xs"
                        >
                          {stat}
                        </TableCell>
                      ))}
                      <TableCell>
                        <TableSkills
                          ids={p.skills}
                          label={`${t("skills")} · ${positionLabel(p.position)}`}
                        />
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs">
                        {p.cost / 1000}k
                      </TableCell>
                      <TableCell
                        className="sticky right-0 bg-card pr-3"
                        title={
                          sevens && !isLineman(p) && specialists >= 4
                            ? t("sevensSpecialistsFull")
                            : undefined
                        }
                      >
                        <QuantityStepper
                          label={positionLabel(p.position)}
                          value={matching.length}
                          max={max}
                          increaseDisabled={
                            playerCount >= rules.maxPlayers ||
                            (sevens && !isLineman(p) && specialists >= 4)
                          }
                          onDecrease={() => {
                            const player = matching[matching.length - 1];
                            if (!player) return;
                            if (
                              player.name.trim() ||
                              player.skills.length ||
                              team.captainId === player.id ||
                              team.veteranId === player.id
                            ) {
                              removalTrigger.current =
                                document.activeElement as HTMLElement;
                              setPendingRemoval(player.id);
                            } else {
                              removePlayer(player.id);
                            }
                          }}
                          onIncrease={() =>
                            updateRecruitment({
                              ...team,
                              players: [
                                ...team.players,
                                {
                                  id: crypto.randomUUID(),
                                  positionId: p.id,
                                  name: "",
                                  skills: [],
                                },
                              ],
                            })
                          }
                        />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
      <Dialog
        open={!!pendingPlayer}
        onOpenChange={(open) => {
          if (!open) setPendingRemoval(null);
        }}
      >
        <DialogContent initialFocus={cancelButton} finalFocus={removalTrigger}>
          <DialogHeader>
            <DialogTitle>{t("removePlayer")}</DialogTitle>
            <DialogDescription>
              {t("removePlayerConfirmation", {
                player:
                  pendingPlayer?.name ||
                  (pendingPosition
                    ? positionLabel(pendingPosition.position)
                    : ""),
              })}
            </DialogDescription>
          </DialogHeader>
          {pendingPlayer && pendingPosition && (
            <div className="space-y-3 rounded-md border bg-card p-3">
              <div className="flex items-center gap-2">
                <PlayerIcon
                  positionId={pendingPosition.id}
                  className="size-10"
                />
                <div>
                  <p className="font-semibold">
                    {pendingPlayer.name ||
                      positionLabel(pendingPosition.position)}
                  </p>
                  {pendingPlayer.name && (
                    <p className="text-xs text-muted-foreground">
                      {positionLabel(pendingPosition.position)}
                    </p>
                  )}
                </div>
              </div>
              {pendingPlayer.skills.length > 0 && (
                <div>
                  <p className="mb-1.5 text-xs font-medium">
                    {t("addedSkills")}
                  </p>
                  <SkillList ids={pendingPlayer.skills} added />
                </div>
              )}
              {team.captainId === pendingPlayer.id && (
                <p className="text-sm font-semibold text-primary">
                  {t("teamCaptain")}
                </p>
              )}
              {isSevens(team) && team.veteranId === pendingPlayer.id && (
                <p className="text-sm font-semibold text-primary">
                  {t("sevensVeteran")}
                </p>
              )}
            </div>
          )}
          <DialogFooter>
            <Button
              ref={cancelButton}
              variant="outline"
              onClick={() => setPendingRemoval(null)}
            >
              {t("cancel")}
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (pendingPlayer) removePlayer(pendingPlayer.id);
              }}
            >
              {t("removePlayer")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
