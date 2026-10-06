"use client";

import { useRef, useState } from "react";
import { useTranslations } from "gt-next";
import { Check, Plus, ShieldCheck, Trash2, X } from "lucide-react";
import {
  getRoster,
  getRuleset,
  sortSkillIds,
  starPairs,
  stars,
} from "@/domain/catalog";
import {
  isSevens,
  playerMovement,
  playerSkillCost,
  tierFor,
} from "@/domain/rules";
import type { Team } from "@/domain/types";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "./dialog";
import { Button } from "./ui/button";
import { PlayerIcon, StarPlayerIcon } from "./player-icon";
import { PlayerName } from "./player-name";
import { PlayerSkillPicker } from "./player-skill-picker";
import { SkillBox, SkillList, VeteranSkill } from "./skill-box";
import { positionLabel } from "./position-name";

const gold = (value: number) => (value / 1000).toLocaleString("en") + "k GP";

/** Name and skill edits are staged until Save; removal is a separate action. */
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
  const [confirmation, setConfirmation] = useState<"remove" | "discard" | null>(
    null,
  );
  const [mobileSection, setMobileSection] = useState("profile");
  const roster = getRoster(team.rosterId)!;
  const rules = getRuleset(team.rulesetId);
  const playerIndex = team.players.findIndex((item) => item.id === selected);
  const player = team.players[playerIndex];
  const position = roster.players.find(
    (item) => item.id === player?.positionId,
  );
  const star = team.stars.includes(selected)
    ? stars.find((item) => item.id === selected)
    : undefined;
  const [draft, setDraft] = useState(() => ({
    name: player?.name ?? "",
    skills: player?.skills ?? [],
  }));
  const profile = position ?? star;
  if (!profile) return null;

  const editable = !!player && !readOnly;
  const captain = team.captainId === selected;
  const veteran = isSevens(team) && team.veteranId === selected;
  const type = position
    ? positionLabel(position.position)
    : star?.playerType || t("starPlayers");
  const title = star?.name || draft.name.trim() || type;
  const dirty =
    editable &&
    (draft.name.trim() !== player.name.trim() ||
      JSON.stringify(sortSkillIds(draft.skills)) !==
        JSON.stringify(sortSkillIds(player.skills)));
  const draftTeam = player
    ? {
        ...team,
        players: team.players.map((item) =>
          item.id === selected
            ? { ...item, ...draft, name: draft.name.trim() }
            : item,
        ),
      }
    : team;
  const skillCost = position
    ? playerSkillCost(draftTeam, position, draft.skills)
    : 0;
  const sevensSkillBlocked =
    team.rulesetId === "kyiv-seven-sins-sevens" &&
    (tierFor(team) === 1 || (tierFor(team) === 2 && captain));
  const max = sevensSkillBlocked
    ? 0
    : Math.min(
        6,
        rules.teamOverrides?.[roster.id]?.maxSkillsPerPlayer ??
          (rules.id === "eurobowl-2026" ? 2 : rules.maxAdvancementsPerPlayer),
      );
  const formatSkills = (value: number) =>
    rules.skillCurrency ? value + " " + t(rules.skillCurrency) : gold(value);
  const removedStars = star
    ? (starPairs.find((pair) => pair.includes(star.id)) ?? [star.id]).filter(
        (id) => team.stars.includes(id),
      )
    : [];
  const savedName = player?.name.trim();
  const savedSkills = player?.skills ?? [];
  const savedCustomisation =
    !!savedName || savedSkills.length > 0 || captain || veteran;

  function requestClose() {
    if (dirty) setConfirmation("discard");
    else onClose();
  }
  function save() {
    if (!editable || !dirty) return;
    onChange(draftTeam);
    onClose();
  }
  function remove() {
    if (readOnly) return;
    const next = {
      ...team,
      players: team.players.filter((item) => item.id !== selected),
      stars: team.stars.filter((id) => !removedStars.includes(id)),
    };
    if (next.captainId === selected) delete next.captainId;
    if (next.veteranId === selected) delete next.veteranId;
    onChange(next);
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
        className={
          "player-dialog " +
          (editable ? "player-dialog-editable" : "player-dialog-view")
        }
        initialFocus={titleRef}
        showCloseButton={false}
      >
        <DialogHeader className="player-dialog-header">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex size-14 shrink-0 items-center justify-center rounded-lg border bg-card sm:size-12">
              {position ? (
                <PlayerIcon
                  positionId={position.id}
                  variant={playerIndex}
                  className="size-12 sm:size-10"
                />
              ) : (
                star && (
                  <StarPlayerIcon
                    starId={star.id}
                    className="size-12 sm:size-10"
                  />
                )
              )}
            </div>
            <div className="min-w-0 flex-1">
              <DialogDescription className="mb-1 text-xs">
                {type} ·{" "}
                {star
                  ? t("starPlayers")
                  : "#" + String(playerIndex + 1).padStart(2, "0")}
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
                      onChange={(name) =>
                        setDraft((current) => ({ ...current, name }))
                      }
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
                {draft.skills.length}/{max}
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
                [
                  "MA",
                  position
                    ? playerMovement(team, selected, position)
                    : profile.ma,
                ],
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
              {player && team.rulesetId !== "kyiv-seven-sins-sevens" && (
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
            <div className="space-y-3 border-t pt-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-xs font-semibold">{t("skills")}</h3>
                {player && (
                  <span className="text-xs text-muted-foreground" role="status">
                    {t("playerModal.addedCount", {
                      count: draft.skills.length,
                      max,
                    })}
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
                                skills: current.skills.filter(
                                  (value) => value !== id,
                                ),
                              }))
                          : undefined
                      }
                    />
                  ))}
                {captain && <SkillBox id="pro" captain />}
                {veteran && <VeteranSkill />}
                {!profile.skills.length &&
                  !draft.skills.length &&
                  !captain &&
                  !veteran && (
                    <span className="text-xs text-muted-foreground">
                      {t("noSkills")}
                    </span>
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
              onChange={(skills) =>
                setDraft((current) => ({ ...current, skills }))
              }
            />
          )}
        </div>

        <div className="player-dialog-footer flex-wrap">
          {!readOnly && (
            <Button
              variant="ghost"
              className="h-11 text-destructive hover:bg-destructive/10 hover:text-destructive sm:h-8"
              aria-label={t("removePlayer")}
              onClick={() => {
                if (savedCustomisation || dirty || removedStars.length > 1)
                  setConfirmation("remove");
                else remove();
              }}
            >
              <Trash2 className="size-4" />
              <span className="sm:hidden">{t("remove")}</span>
              <span className="hidden sm:inline">{t("removePlayer")}</span>
            </Button>
          )}
          <div className="ml-auto flex gap-2">
            <Button
              variant={editable ? "outline" : "default"}
              className="h-11 sm:h-8"
              onClick={onClose}
            >
              {t(editable ? "cancel" : "playerModal.close")}
            </Button>
            {editable && (
              <Button
                className="h-11 min-w-20 sm:h-8"
                disabled={!dirty}
                onClick={save}
              >
                <Check className="size-4" />
                {t("playerModal.save")}
              </Button>
            )}
          </div>
        </div>

        <Dialog
          open={confirmation !== null}
          onOpenChange={(open) => {
            if (!open) setConfirmation(null);
          }}
        >
          <DialogContent initialFocus={cancelRef}>
            <DialogHeader>
              <DialogTitle>
                {t(
                  confirmation === "discard"
                    ? "playerModal.discardTitle"
                    : "removePlayer",
                )}
              </DialogTitle>
              <DialogDescription>
                {confirmation === "discard"
                  ? t("playerModal.discardHint")
                  : t("playerModal.removeQuestion", {
                      player: savedName || star?.name || type,
                    })}
              </DialogDescription>
            </DialogHeader>
            {confirmation === "remove" && (
              <div className="space-y-3 text-sm">
                {savedCustomisation && (
                  <div className="space-y-2 rounded-lg border bg-secondary/40 p-3">
                    <p className="text-xs text-muted-foreground">
                      {t("playerModal.savedDetailsLost")}
                    </p>
                    {savedName && (
                      <p>
                        {t("playerName")}:{" "}
                        <strong className="wrap-anywhere">{savedName}</strong>
                      </p>
                    )}
                    {savedSkills.length > 0 && (
                      <div>
                        <p className="mb-1.5 text-xs">{t("addedSkills")}</p>
                        <SkillList ids={savedSkills} added />
                      </div>
                    )}
                    {captain && (
                      <p className="flex items-center gap-1.5">
                        <ShieldCheck className="size-4" />
                        {t("teamCaptain")}
                      </p>
                    )}
                    {veteran && <p>{t("sevensVeteran")}</p>}
                  </div>
                )}
                {removedStars.length > 1 && (
                  <p>
                    {t("playerModal.removePair", {
                      players: removedStars
                        .map((id) => stars.find((item) => item.id === id)!.name)
                        .join(" & "),
                    })}
                  </p>
                )}
                {dirty && <p>{t("playerModal.removeUnsaved")}</p>}
              </div>
            )}
            <div className="flex justify-end gap-2">
              <Button
                ref={cancelRef}
                variant="outline"
                className="h-11 sm:h-8"
                onClick={() => setConfirmation(null)}
              >
                {t(
                  confirmation === "discard"
                    ? "playerModal.keepEditing"
                    : "cancel",
                )}
              </Button>
              <Button
                variant="destructive"
                className="h-11 sm:h-8"
                onClick={confirmation === "discard" ? onClose : remove}
              >
                {t(
                  confirmation === "discard"
                    ? "playerModal.discard"
                    : "removePlayer",
                )}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </DialogContent>
    </Dialog>
  );
}
