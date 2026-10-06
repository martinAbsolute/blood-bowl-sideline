"use client";

import { useTranslations } from "gt-next";
import { getSkill, skillName, sortSkillIds } from "@/domain/catalog";
import { RuleHelp } from "./rule-help";
import { X } from "lucide-react";

export function VeteranSkill() {
  const t = useTranslations();
  return (
    <RuleHelp
      title={t("sevensVeteran")}
      description={t("sevensVeteranHelp")}
      skillPreview
      className="skill-box skill-trait skill-added"
    >
      {t("sevensVeteran")}
    </RuleHelp>
  );
}

export function SkillBox({
  id,
  added = false,
  captain = false,
  onRemove,
}: {
  id: string;
  added?: boolean;
  captain?: boolean;
  onRemove?: () => void;
}) {
  const t = useTranslations();
  const skill = getSkill(id);
  const category = skill?.category ?? "trait";
  const meta = [
    t(`skillCategories.${category}`),
    skill?.isElite ? t("elite") : "",
    added ? t("addedSkills") : "",
  ]
    .filter(Boolean)
    .join(" · ");
  const className = `skill-box skill-${category}${added || captain ? " skill-added" : ""}`;
  const help = (
    <RuleHelp
      title={captain ? t("proCaptain") : skillName(id)}
      description={t(`skillDescriptions.${id.split(":")[0]}`)}
      meta={meta}
      skillPreview
      className={onRemove ? "skill-removable-label" : className}
    >
      {captain ? t("proCaptain") : skillName(id)}
    </RuleHelp>
  );
  return onRemove ? (
    <span className={`${className} skill-removable`}>
      {help}
      <button
        type="button"
        className="skill-removable-action"
        aria-label={`${t("removeSkill")} · ${skillName(id)}`}
        onClick={onRemove}
      >
        <X aria-hidden="true" className="size-3" />
      </button>
    </span>
  ) : (
    help
  );
}

export function SkillList({
  ids,
  added = false,
  additionalIds = [],
  captain = false,
  veteran = false,
}: {
  ids: string[];
  added?: boolean;
  additionalIds?: string[];
  captain?: boolean;
  veteran?: boolean;
}) {
  const t = useTranslations();
  return ids.length || additionalIds.length || captain || veteran ? (
    <div className="flex flex-wrap gap-1.5">
      {sortSkillIds(ids).map((id) => (
        <SkillBox key={id} id={id} added={added} />
      ))}
      {sortSkillIds(additionalIds).map((id) => (
        <SkillBox key={`added-${id}`} id={id} added />
      ))}
      {captain && <SkillBox id="pro" captain />}
      {veteran && <VeteranSkill />}
    </div>
  ) : (
    <span className="text-xs text-muted-foreground">{t("noSkills")}</span>
  );
}

export function TableSkills(
  props: Parameters<typeof SkillList>[0] & { label: string },
) {
  const { label, ...skills } = props;
  return (
    <div
      className="table-skills min-h-9 w-max px-0.5 py-1 md:w-full [&>div]:flex-nowrap md:[&>div]:flex-wrap [&_.skill-box]:shrink-0"
      role="group"
      aria-label={label}
    >
      <SkillList {...skills} />
    </div>
  );
}
