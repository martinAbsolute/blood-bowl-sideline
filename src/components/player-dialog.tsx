"use client";
import { useGold } from "@/i18n/use-gold";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Check, Plus, ShieldCheck, X } from "lucide-react";
import { getRoster, getRuleset, sortSkillIds, stars } from "@/domain/catalog";
import { isSevens, playerMovement, playerSkillCost, tierFor } from "@/domain/rules";
import type { Team } from "@/domain/types";
import { isPlayerNumberAvailable, numberedPlayers } from "@/domain/player-number";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "./dialog";
import { Button } from "./ui/button";
import { PlayerIcon, StarPlayerIcon } from "./player-icon";
import { PlayerName } from "./player-name";
import { PlayerNumber } from "./player-number";
import { PlayerSkillPicker } from "./player-skill-picker";
import { SkillBox, VeteranSkill } from "./skill-box";
import { RemovePlayerButton } from "./remove-player-button";
import { positionLabel } from "./position-name";

/** Player edits are staged until Save; removal is a separate action. */
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
  const formatGold = useGold();
  const gold = (value: number) => `${formatGold(value)} GP`;
  const titleRef = useRef<HTMLHeadingElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const [discardOpen, setDiscardOpen] = useState(false);
  const [mobileSection, setMobileSection] = useState("profile");
  const roster = getRoster(team.rosterId)!;
  const rules = getRuleset(team.rulesetId);
  const players = numberedPlayers(team.players);
  const playerIndex = players.findIndex((item) => item.id === selected);
  const player = players[playerIndex];
  const position = roster.players.find((item) => item.id === player?.positionId);
  const star = team.stars.includes(selected) ? stars.find((item) => item.id === selected) : undefined;
  const [draft, setDraft] = useState(() => ({
    number: player?.number ?? "",
    name: player?.name ?? "",
    skills: player?.skills ?? [],
  }));
  const profile = position ?? star;
  if (!profile) return null;

  const editable = !!player && !readOnly;
  const captain = team.captainId === selected;
  const veteran = isSevens(team) && team.veteranId === selected;
  const type = position ? positionLabel(position.position) : star?.playerType || t("starPlayers");
  const title = star?.name || draft.name.trim() || type;
  const invalidNumber = !isPlayerNumberAvailable(players, selected, draft.number);
  const dirty =
    editable &&
    (draft.number !== player.number ||
      draft.name.trim() !== player.name.trim() ||
      JSON.stringify(sortSkillIds(draft.skills)) !== JSON.stringify(sortSkillIds(player.skills)));
  const draftTeam = player
    ? {
        ...team,
        players: players
          .map((item) =>
            item.id === selected
              ? { ...item, ...draft, number: invalidNumber ? item.number : draft.number, name: draft.name.trim() }
              : item,
          )
          .sort((a, b) => Number(a.number) - Number(b.number)),
      }
    : team;
  const skillCost = position ? playerSkillCost(draftTeam, position, draft.skills) : 0;
  const sevensSkillBlocked =
    team.rulesetId === "kyiv-seven-sins-sevens" && (tierFor(team) === 1 || (tierFor(team) === 2 && captain));
  const max = sevensSkillBlocked
    ? 0
    : Math.min(
        6,
        rules.teamOverrides?.[roster.id]?.maxSkillsPerPlayer ??
          (rules.id === "eurobowl-2026" ? 2 : rules.maxAdvancementsPerPlayer),
      );
  const formatSkills = (value: number) => (rules.skillCurrency ? value + " " + t(rules.skillCurrency) : gold(value));
  function requestClose() {
    if (dirty) setDiscardOpen(true);
    else onClose();
  }
  function save() {
    if (!editable || !dirty || invalidNumber) return;
    onChange(draftTeam);
    onClose();
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) requestClose();
      }}
    >
      <DialogContent
        className={"player-dialog " + (editable ? "player-dialog-editable" : "player-dialog-view")}
        initialFocus={titleRef}
        showCloseButton={false}
      >
        <DialogHeader className="player-dialog-header">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex size-14 shrink-0 items-center justify-center rounded-lg border bg-card sm:size-12">
              {position ? (
                <PlayerIcon positionId={position.id} className="size-12 sm:size-10" />
              ) : (
                star && <StarPlayerIcon starId={star.id} className="size-12 sm:size-10" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <DialogDescription className="mb-1 flex flex-wrap items-baseline gap-x-1 text-xs">
                {type} ·{" "}
                {star ? (
                  t("starPlayers")
                ) : editable ? (
                  <PlayerNumber
                    value={draft.number}
                    label={t("playerModal.number")}
                    invalid={invalidNumber}
                    onChange={(number) => setDraft((current) => ({ ...current, number }))}
                  />
                ) : (
                  "#" + player.number
                )}
              </DialogDescription>
              <DialogTitle
                ref={titleRef}
                tabIndex={-1}
                className="min-w-0 text-xl font-semibold leading-tight outline-none sm:text-2xl"
              >
                {editable ? (
                  <>
                    <span className="sr-only">{title}</span>
                    <PlayerName
                      value={draft.name}
                      placeholder={t("playerModal.namePlaceholder")}
                      label={t("playerName")}
                      onChange={(name) => setDraft((current) => ({ ...current, name }))}
                    />
                  </>
                ) : (
                  <span className="line-clamp-2 wrap-anywhere" title={title}>
                    {title}
                  </span>
                )}
              </DialogTitle>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="size-11 shrink-0 self-start sm:size-8"
              aria-label={t("playerModal.close")}
              onClick={requestClose}
            >
              <X className="size-4" />
            </Button>
          </div>
        </DialogHeader>

        {editable && (
          <div className="player-dialog-navigation" role="group" aria-label={t("managePlayer")}>
            <button
              type="button"
              aria-pressed={mobileSection === "profile"}
              onClick={() => setMobileSection("profile")}
            >
              {t("managePlayer")}
            </button>
            <button type="button" aria-pressed={mobileSection === "skills"} onClick={() => setMobileSection("skills")}>
              <Plus className="size-4" />
              {t("playerModal.browseSkills")}
              <span className="font-mono text-xs">
                {draft.skills.length}/{max}
              </span>
            </button>
          </div>
        )}

        <div className="player-dialog-body" data-section={mobileSection}>
          <section className="player-dialog-profile" aria-label={t("managePlayer")}>
            <dl className="grid grid-cols-5 divide-x overflow-hidden rounded-lg border bg-card text-center">
              {[
                ["MA", position ? playerMovement(team, selected, position) : profile.ma],
                ["ST", profile.st],
                ["AG", profile.ag],
                ["PA", profile.pa],
                ["AV", profile.av],
              ].map(([label, value]) => (
                <div key={label} className="py-2.5">
                  <dt className="font-mono text-[10px] text-muted-foreground">{label}</dt>
                  <dd className="mt-1 font-mono text-base font-semibold">{value}</dd>
                </div>
              ))}
            </dl>
            <dl className="space-y-2 text-xs">
              <div className="flex items-center justify-between gap-3">
                <dt className="text-muted-foreground">{t("cost")}</dt>
                <dd className="font-mono font-medium">
                  {gold(profile.cost + (rules.id === "bb2025-default" ? skillCost : 0))}
                </dd>
              </div>
              {player && team.rulesetId !== "kyiv-seven-sins-sevens" && (
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-muted-foreground">{t("playerModal.skillSpend")}</dt>
                  <dd className="font-mono font-medium" aria-live="polite">
                    {formatSkills(skillCost)}
                  </dd>
                </div>
              )}
            </dl>
            <div className="space-y-3 border-t pt-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-xs font-semibold">{t("skillsAndTraits")}</h3>
                {player && (
                  <span className="text-xs text-muted-foreground" role="status">
                    {t("playerModal.addedCount", { count: draft.skills.length, max })}
                  </span>
                )}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {sortSkillIds(profile.skills).map((id) => (
                  <SkillBox key={id} id={id} />
                ))}
                {player &&
                  sortSkillIds(draft.skills).map((id) => (
                    <SkillBox
                      key={"added-" + id}
                      id={id}
                      added
                      onRemove={
                        editable
                          ? () =>
                              setDraft((current) => ({
                                ...current,
                                skills: current.skills.filter((value) => value !== id),
                              }))
                          : undefined
                      }
                    />
                  ))}
                {captain && <SkillBox id="pro" captain />}
                {veteran && <VeteranSkill />}
                {!profile.skills.length && !draft.skills.length && !captain && !veteran && (
                  <span className="text-xs text-muted-foreground">{t("noSkills")}</span>
                )}
              </div>
              {captain && (
                <p className="flex items-center gap-1.5 text-xs font-medium text-primary">
                  <ShieldCheck className="size-3.5" />
                  {t("teamCaptain")}
                </p>
              )}
            </div>
          </section>
          {editable && position && (
            <PlayerSkillPicker
              team={draftTeam}
              playerId={selected}
              position={position}
              selected={draft.skills}
              max={max}
              captain={captain}
              onChange={(skills) => setDraft((current) => ({ ...current, skills }))}
            />
          )}
        </div>

        <div className="player-dialog-footer flex-wrap">
          {!readOnly && (
            <RemovePlayerButton team={team} selected={selected} onChange={onChange} onRemoved={onClose} dirty={dirty} />
          )}
          <div className="ml-auto flex gap-2">
            <Button variant={editable ? "outline" : "default"} className="h-11 sm:h-8" onClick={onClose}>
              {t(editable ? "cancel" : "playerModal.close")}
            </Button>
            {editable && (
              <Button className="h-11 min-w-20 sm:h-8" disabled={!dirty || invalidNumber} onClick={save}>
                <Check className="size-4" />
                {t("playerModal.save")}
              </Button>
            )}
          </div>
        </div>

        <Dialog open={discardOpen} onOpenChange={setDiscardOpen}>
          <DialogContent initialFocus={cancelRef}>
            <DialogHeader>
              <DialogTitle>{t("playerModal.discardTitle")}</DialogTitle>
              <DialogDescription>{t("playerModal.discardHint")}</DialogDescription>
            </DialogHeader>
            <div className="flex justify-end gap-2">
              <Button ref={cancelRef} variant="outline" className="h-11 sm:h-8" onClick={() => setDiscardOpen(false)}>
                {t("playerModal.keepEditing")}
              </Button>
              <Button variant="destructive" className="h-11 sm:h-8" onClick={onClose}>
                {t("playerModal.discard")}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </DialogContent>
    </Dialog>
  );
}
