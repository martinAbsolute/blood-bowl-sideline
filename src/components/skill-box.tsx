"use client";

import { useLocale, useTranslations } from "gt-next";
import { getSkill, skillName } from "@/domain/catalog";
import { RuleHelp } from "./rule-help";

export function SkillBox({
  id,
  added = false,
  captain = false,
}: {
  id: string;
  added?: boolean;
  captain?: boolean;
}) {
  const t = useTranslations();
  const locale = useLocale();
  const skill = getSkill(id);
  const category = skill?.category ?? "trait";
  const meta = [
    t(`skillCategories.${category}`),
    skill?.isElite ? t("elite") : "",
    added ? t("addedSkills") : "",
  ]
    .filter(Boolean)
    .join(" · ");
  return (
    <RuleHelp
      title={captain ? t("proCaptain") : skillName(id)}
      description={t(`skillDescriptions.${id.split(":")[0]}`)}
      meta={meta}
      href={`https://bb-rules-g2p.pages.dev/${locale === "uk" ? "uk" : "en"}/skills/${id.split(":")[0]}`}
      className={`skill-box skill-${category}${added || captain ? " skill-added" : ""}`}
    >
      {added && (
        <span aria-hidden="true" className="mr-1 font-bold">
          +
        </span>
      )}
      {captain ? t("proCaptain") : skillName(id)}
    </RuleHelp>
  );
}

export function SkillList({
  ids,
  added = false,
  additionalIds = [],
  captain = false,
}: {
  ids: string[];
  added?: boolean;
  additionalIds?: string[];
  captain?: boolean;
}) {
  const t = useTranslations();
  return ids.length || additionalIds.length || captain ? (
    <div className="flex flex-wrap gap-1.5">
      {ids.map((id) => (
        <SkillBox key={id} id={id} added={added} />
      ))}
      {captain && <SkillBox id="pro" captain />}
      {additionalIds.map((id) => (
        <SkillBox key={`added-${id}`} id={id} added />
      ))}
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
      className="table-skills w-max px-0.5 py-1 md:w-full [&>div]:flex-nowrap md:[&>div]:flex-wrap [&_.skill-box]:shrink-0"
      role="group"
      aria-label={label}
    >
      <SkillList {...skills} />
    </div>
  );
}
