"use client";
import { useRef, useState } from "react";
import { useTranslations } from "gt-next";
import { ShieldCheck, Trash2 } from "lucide-react";
import { getRoster, starPairs, stars } from "@/domain/catalog";
import type { Team } from "@/domain/types";
import { Button } from "./ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "./dialog";
import { SkillList } from "./skill-box";
import { positionLabel } from "./position-name";

/** Player removal preserves a confirmation for customisation, not base skills. */
export function RemovePlayerButton({
  team,
  selected,
  onChange,
  onRemoved,
  dirty = false,
}: {
  team: Team;
  selected: string;
  onChange: (team: Team) => void;
  onRemoved?: () => void;
  dirty?: boolean;
}) {
  const t = useTranslations();
  const [open, setOpen] = useState(false);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const player = team.players.find((item) => item.id === selected);
  const position = getRoster(team.rosterId)?.players.find(
    (item) => item.id === player?.positionId,
  );
  const star = team.stars.includes(selected)
    ? stars.find((item) => item.id === selected)
    : undefined;
  if (!player && !star) return null;
  const savedName = player?.name.trim();
  const savedSkills = player?.skills ?? [];
  const captain = team.captainId === selected;
  const veteran = team.veteranId === selected;
  const savedCustomisation =
    !!savedName || savedSkills.length > 0 || captain || veteran;
  const removedStars = star
    ? (starPairs.find((pair) => pair.includes(star.id)) ?? [star.id]).filter(
        (id) => team.stars.includes(id),
      )
    : [];
  const name =
    savedName ||
    star?.name ||
    (position ? positionLabel(position.position) : t("player"));
  function remove() {
    const next = {
      ...team,
      players: team.players.filter((item) => item.id !== selected),
      stars: team.stars.filter((id) => !removedStars.includes(id)),
    };
    if (next.captainId === selected) delete next.captainId;
    if (next.veteranId === selected) delete next.veteranId;
    onChange(next);
    setOpen(false);
    onRemoved?.();
  }

  const button = (
    <Button
      ref={triggerRef}
      type="button"
      variant="ghost"
      size="default"
      className="h-11 text-destructive hover:bg-destructive/10 hover:text-destructive sm:h-8"
      aria-label={t("removePlayer")}
      onClick={(event) => {
        event.stopPropagation();
        if (savedCustomisation || dirty || removedStars.length > 1)
          setOpen(true);
        else remove();
      }}
    >
      <Trash2 aria-hidden="true" className="size-4" />
      <span className="sm:hidden">{t("remove")}</span>
      <span className="hidden sm:inline">{t("removePlayer")}</span>
    </Button>
  );
  return (
    <>
      {button}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          initialFocus={cancelRef}
          finalFocus={triggerRef}
          onClick={(event) => event.stopPropagation()}
        >
          <DialogHeader>
            <DialogTitle>{t("removePlayer")}</DialogTitle>
            <DialogDescription>
              {t("playerModal.removeQuestion", { player: name })}
            </DialogDescription>
          </DialogHeader>
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
          <div className="flex justify-end gap-2">
            <Button
              ref={cancelRef}
              variant="outline"
              className="h-11 sm:h-8"
              onClick={() => setOpen(false)}
            >
              {t("cancel")}
            </Button>
            <Button
              variant="destructive"
              className="h-11 sm:h-8"
              onClick={remove}
            >
              {t("removePlayer")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
