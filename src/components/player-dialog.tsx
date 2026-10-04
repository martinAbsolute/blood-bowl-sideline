"use client";

import { useRef, useState } from "react";
import { useTranslations } from "gt-next";
import { Check, Plus, ShieldCheck, Trash2, X } from "lucide-react";
import { getRoster, getRuleset, skillName, stars } from "@/domain/catalog";
import { playerSkillCost } from "@/domain/rules";
import type { Team } from "@/domain/types";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "./dialog";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { PlayerIcon, StarPlayerIcon } from "./player-icon";
import { PlayerSkillPicker } from "./player-skill-picker";
import { SkillBox, SkillList } from "./skill-box";
import { positionLabel } from "./position-name";

const gold = (value: number) => `${(value / 1000).toLocaleString("en")}k GP`;

/** One player workspace, with the same immediate edits as the roster. */
export function PlayerDialog({
  team,
  selected,
  readOnly,
  onChange,
  onClose,
}: {
  team: Team;
  selected: string;
  readOnly: boolean;
  onChange: (team: Team) => void;
  onClose: () => void;
}) {
  const t = useTranslations();
  const titleRef = useRef<HTMLHeadingElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const [confirmRemoval, setConfirmRemoval] = useState(false);
  const [mobileSection, setMobileSection] = useState("profile");
  const roster = getRoster(team.rosterId)!;
  const rules = getRuleset(team.rulesetId);
  const player = team.players.find((item) => item.id === selected);
  const position = roster.players.find(
    (item) => item.id === player?.positionId,
  );
  const star = team.stars.includes(selected)
    ? stars.find((item) => item.id === selected)
    : undefined;
  const profile = position ?? star;
  if (!profile) return null;

  const captain = team.captainId === selected;
  const title =
    star?.name || (position && positionLabel(position.position)) || "";
  const skillCost =
    player && position ? playerSkillCost(team, position, player.skills) : 0;
  const max = Math.min(
    6,
    rules.teamOverrides?.[roster.id]?.maxSkillsPerPlayer ??
      (rules.id === "eurobowl-2026" ? 2 : rules.maxAdvancementsPerPlayer),
  );
  const editable = !!player && !readOnly;
  const formatSkills = (value: number) =>
    rules.skillCurrency ? `${value} ${t(rules.skillCurrency)}` : gold(value);
  function editPlayer(update: Partial<Team["players"][number]>) {
    onChange({
      ...team,
      players: team.players.map((item) =>
        item.id === selected ? { ...item, ...update } : item,
      ),
    });
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent
        className={`player-dialog ${editable ? "player-dialog-editable" : "player-dialog-view"}`}
        initialFocus={titleRef}
        showCloseButton={false}
      >
        <DialogHeader className="player-dialog-header">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex size-14 shrink-0 items-center justify-center rounded-lg border bg-card">
              {position ? (
                <PlayerIcon
                  positionId={position.id}
                  variant={team.players.findIndex(
                    (item) => item.id === selected,
                  )}
                  className="size-12"
                />
              ) : (
                star && <StarPlayerIcon starId={star.id} className="size-12" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <DialogDescription className="mb-1 text-xs">
                {player?.name.trim() ? title : t("managePlayer")} ·{" "}
                {star
                  ? t("starPlayers")
                  : `#${String(team.players.findIndex((item) => item.id === selected) + 1).padStart(2, "0")}`}
              </DialogDescription>
              <DialogTitle
                ref={titleRef}
                tabIndex={-1}
                className="line-clamp-2 wrap-anywhere text-xl font-semibold leading-tight outline-none sm:text-2xl"
                title={player?.name.trim() || title}
              >
                {player?.name.trim() || title}
              </DialogTitle>
            </div>
            <DialogClose
              render={
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-11 shrink-0 self-start"
                />
              }
              aria-label={t("close")}
            >
              <X className="size-5" />
            </DialogClose>
          </div>
        </DialogHeader>

        {editable && (
          <div
            className="player-dialog-navigation"
            role="group"
            aria-label={t("managePlayer")}
          >
            <button
              type="button"
              aria-pressed={mobileSection === "profile"}
              onClick={() => setMobileSection("profile")}
            >
              {t("managePlayer")}
            </button>
            <button
              type="button"
              aria-pressed={mobileSection === "skills"}
              onClick={() => setMobileSection("skills")}
            >
              <Plus className="size-4" />
              {t("playerModal.browseSkills")}
              <span className="font-mono text-xs">
                {player?.skills.length}/{max}
              </span>
            </button>
          </div>
        )}
        <div className="player-dialog-body" data-section={mobileSection}>
          <section
            className="player-dialog-profile"
            aria-label={t("managePlayer")}
          >
            <dl className="grid grid-cols-5 divide-x overflow-hidden rounded-lg border bg-card text-center">
              {[
                ["MA", profile.ma],
                ["ST", profile.st],
                ["AG", profile.ag],
                ["PA", profile.pa],
                ["AV", profile.av],
              ].map(([label, value]) => (
                <div key={label} className="py-2.5">
                  <dt className="font-mono text-[10px] text-muted-foreground">
                    {label}
                  </dt>
                  <dd className="mt-1 font-mono text-base font-semibold">
                    {value}
                  </dd>
                </div>
              ))}
            </dl>
            <dl className="space-y-2 text-xs">
              <div className="flex items-center justify-between gap-3">
                <dt className="text-muted-foreground">{t("cost")}</dt>
                <dd className="font-mono font-medium">
                  {gold(
                    profile.cost +
                      (rules.id === "bb2025-default" ? skillCost : 0),
                  )}
                </dd>
              </div>
              {player && (
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-muted-foreground">
                    {t("playerModal.skillSpend")}
                  </dt>
                  <dd className="font-mono font-medium" aria-live="polite">
                    {formatSkills(skillCost)}
                  </dd>
                </div>
              )}
            </dl>
            {player && (
              <label className="block text-xs font-medium">
                {t("playerName")}
                <Input
                  className="mt-2 h-11 bg-card"
                  value={player.name}
                  maxLength={80}
                  placeholder={title}
                  readOnly={readOnly}
                  onChange={(event) => editPlayer({ name: event.target.value })}
                />
              </label>
            )}
            <div className="space-y-2">
              <h3 className="text-xs font-semibold">{t("builtInSkills")}</h3>
              <SkillList ids={profile.skills} />
            </div>
            {captain && (
              <div className="space-y-2 rounded-lg border bg-card p-3">
                <p className="flex items-center gap-1.5 text-xs font-semibold text-primary">
                  <ShieldCheck className="size-4" />
                  {t("teamCaptain")}
                </p>
                <SkillList ids={[]} captain />
              </div>
            )}
            {player && (
              <div className="space-y-2 border-t pt-4">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-xs font-semibold">{t("addedSkills")}</h3>
                  <span
                    className="font-mono text-xs text-muted-foreground"
                    role="status"
                  >
                    {player.skills.length} / {max}
                  </span>
                </div>
                {player.skills.length ? (
                  <ul className="space-y-1">
                    {player.skills.map((id) => (
                      <li
                        key={id}
                        className="flex min-h-11 items-center justify-between gap-2"
                      >
                        <SkillBox id={id} added />
                        {editable && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-11 shrink-0 text-muted-foreground hover:text-destructive"
                            aria-label={`${t("removeSkill")} · ${skillName(id)}`}
                            onClick={() =>
                              editPlayer({
                                skills: player.skills.filter(
                                  (value) => value !== id,
                                ),
                              })
                            }
                          >
                            <X className="size-4" />
                          </Button>
                        )}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    {t(editable ? "playerModal.noAddedSkills" : "noSkills")}
                  </p>
                )}
              </div>
            )}
          </section>
          {editable && player && position && (
            <PlayerSkillPicker
              team={team}
              playerId={player.id}
              position={position}
              selected={player.skills}
              max={max}
              captain={captain}
              onChange={(skills) => editPlayer({ skills })}
            />
          )}
        </div>

        <div className="player-dialog-footer">
          {editable && (
            <Button
              variant="ghost"
              className="h-11 text-destructive hover:bg-destructive/10 hover:text-destructive"
              onClick={() => setConfirmRemoval(true)}
            >
              <Trash2 className="size-4" />
              {t("removePlayer")}
            </Button>
          )}
          <Button className="ml-auto h-11 min-w-24" onClick={onClose}>
            {editable && <Check className="size-4" />}
            {t(editable ? "playerModal.done" : "close")}
          </Button>
        </div>

        <Dialog open={confirmRemoval} onOpenChange={setConfirmRemoval}>
          <DialogContent initialFocus={cancelRef}>
            <DialogHeader>
              <DialogTitle>{t("removePlayer")}</DialogTitle>
              <DialogDescription>
                {t("removePlayerConfirmation", {
                  player: player?.name.trim() || title,
                })}
              </DialogDescription>
            </DialogHeader>
            <div className="flex justify-end gap-2">
              <Button
                ref={cancelRef}
                variant="outline"
                className="h-11"
                onClick={() => setConfirmRemoval(false)}
              >
                {t("cancel")}
              </Button>
              <Button
                variant="destructive"
                className="h-11"
                onClick={() => {
                  const next = {
                    ...team,
                    players: team.players.filter(
                      (item) => item.id !== selected,
                    ),
                  };
                  if (next.captainId === selected) delete next.captainId;
                  onChange(next);
                  onClose();
                }}
              >
                {t("removePlayer")}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </DialogContent>
    </Dialog>
  );
}
