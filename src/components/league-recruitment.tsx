"use client";

import { useState } from "react";
import { useTranslations } from "gt-next";
import { Check, Coins, Plus, Users } from "lucide-react";
import type { Roster } from "@/domain/types";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Dialog } from "./dialog";
import {
  LeagueDialogBody,
  LeagueDialogContent,
  LeagueDialogFooter,
  LeagueDialogHeader,
  LeagueFormSection,
} from "./league-dialog";
import { LeagueField } from "./league-field";
import { PlayerIcon } from "./player-icon";
import { SkillList } from "./skill-box";
import { positionLabel } from "./position-name";

export function LeagueRecruitment({
  positions,
  players,
  treasury,
  blockedPositionIds,
  busy,
  error,
  onHire,
}: {
  positions: Roster["players"];
  players: { positionId: string }[];
  treasury: number;
  blockedPositionIds: string[];
  busy: boolean;
  error: string;
  onHire: (positionId: string, name: string) => Promise<boolean>;
}) {
  const t = useTranslations();
  const [open, setOpen] = useState(false);
  const [positionId, setPositionId] = useState("");
  const [name, setName] = useState("");
  const selected = positions.find((position) => position.id === positionId);
  const blocked = (position: Roster["players"][number]) => {
    if (players.length >= 16) return t("leagueDesk.rosterFull");
    if (blockedPositionIds.includes(position.id))
      return t("leagueDesk.positionBlocked");
    if (
      players.filter((player) => player.positionId === position.id).length >=
      Number(position.qty.split("-").at(-1))
    )
      return t("leagueDesk.positionFull");
    if (position.cost > treasury) return t("leagueDesk.notEnoughGold");
    return "";
  };
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg border bg-secondary/30 p-4">
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-lg border bg-card text-primary">
            <Users className="size-5" />
          </span>
          <div>
            <h2 className="text-sm font-semibold">{t("leagueUi.recruit")}</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              {t("leagueUi.recruitHint")}
            </p>
          </div>
        </div>
        <Button
          className="min-h-11"
          disabled={busy || players.length >= 16}
          onClick={() => setOpen(true)}
        >
          <Plus className="size-4" />
          {t("leagueUi.recruit")}
        </Button>
      </div>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (!busy) setOpen(next);
        }}
      >
        <LeagueDialogContent className="sm:max-w-2xl" showCloseButton={!busy}>
          <LeagueDialogHeader
            title={t("leagueUi.recruit")}
            description={t("leagueDesk.recruitHint")}
            icon={<Users className="size-5" />}
          />
          <form
            className="flex min-h-0 flex-1 flex-col"
            onSubmit={async (event) => {
              event.preventDefault();
              if (!selected || blocked(selected) || busy) return;
              if (await onHire(selected.id, name.trim())) {
                setOpen(false);
                setPositionId("");
                setName("");
              }
            }}
          >
            <LeagueDialogBody>
              <div className="flex flex-wrap justify-between gap-3 rounded-lg border bg-secondary/25 p-3 text-xs">
                <span className="flex items-center gap-2">
                  <Coins className="size-4" />
                  {t("leagueUi.treasury")}:{" "}
                  <strong className="font-mono">{treasury / 1000}k GP</strong>
                </span>
                <span>
                  {players.length} / 16 {t("players")}
                </span>
              </div>
              <LeagueFormSection title={t("leagueUi.choosePosition")}>
                <div className="grid gap-2 sm:grid-cols-2">
                  {positions.map((position) => {
                    const reason = blocked(position),
                      chosen = positionId === position.id;
                    return (
                      <button
                        key={position.id}
                        type="button"
                        disabled={!!reason || busy}
                        aria-pressed={chosen}
                        onClick={() => setPositionId(position.id)}
                        className={`flex items-start gap-3 rounded-lg border p-3 text-left focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-55 ${chosen ? "border-primary bg-secondary" : "bg-card enabled:hover:bg-secondary/40"}`}
                      >
                        <PlayerIcon
                          positionId={position.id}
                          className="size-9 shrink-0"
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-semibold">
                            {positionLabel(position.position)}
                          </span>
                          <span className="mt-1 block text-xs text-muted-foreground">
                            {position.cost / 1000}k GP ·{" "}
                            {
                              players.filter(
                                (player) => player.positionId === position.id,
                              ).length
                            }
                            /{position.qty.split("-").at(-1)}
                          </span>
                          {reason && (
                            <span className="mt-1 block text-[11px] text-destructive">
                              {reason}
                            </span>
                          )}
                        </span>
                        {chosen && (
                          <Check className="size-4 shrink-0 text-primary" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </LeagueFormSection>
              {selected && (
                <LeagueFormSection title={positionLabel(selected.position)}>
                  <dl className="grid grid-cols-5 divide-x rounded-lg border bg-secondary/25 py-3 text-center">
                    {(["ma", "st", "ag", "pa", "av"] as const).map((stat) => (
                      <div key={stat}>
                        <dt className="text-[10px] uppercase text-muted-foreground">
                          {stat}
                        </dt>
                        <dd className="mt-1 font-mono text-base font-semibold">
                          {selected[stat]}
                        </dd>
                      </div>
                    ))}
                  </dl>
                  <SkillList ids={selected.skills} />
                  <LeagueField>
                    {t("leagueUi.playerName")}
                    <Input
                      className="h-11"
                      maxLength={80}
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                      disabled={busy}
                    />
                  </LeagueField>
                  <p className="text-xs text-muted-foreground">
                    {t("leagueDesk.afterHire")}:{" "}
                    <strong className="font-mono text-primary">
                      {(treasury - selected.cost) / 1000}k GP
                    </strong>
                  </p>
                  {blocked(selected) && (
                    <p role="status" className="text-xs text-destructive">
                      {blocked(selected)}
                    </p>
                  )}
                </LeagueFormSection>
              )}
              {error && (
                <p role="alert" className="text-sm text-destructive">
                  {error}
                </p>
              )}
            </LeagueDialogBody>
            <LeagueDialogFooter>
              <Button
                type="button"
                variant="outline"
                disabled={busy}
                onClick={() => setOpen(false)}
              >
                {t("cancel")}
              </Button>
              <Button
                type="submit"
                disabled={busy || !selected || !!blocked(selected)}
              >
                <Plus className="size-4" />
                {t("leagueUi.hire")}
                {selected ? ` · ${selected.cost / 1000}k GP` : ""}
              </Button>
            </LeagueDialogFooter>
          </form>
        </LeagueDialogContent>
      </Dialog>
    </>
  );
}
