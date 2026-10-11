import { inducements, skills } from "@/domain/catalog";
import type { Issue } from "@/domain/rules";
import { translatedSkillName } from "./translated-skill-name";

/** Translate catalog labels at the display boundary, never coach-entered names. */
export function translatedIssueValues(
  issue: Issue,
  t: (key: string) => string,
) {
  const values = { ...issue.values };
  if (
    ["skillAccess", "skillCompatibility", "eliteCopies"].includes(issue.code)
  ) {
    const skill = skills.find((entry) => entry.name === values.skill);
    if (skill) values.skill = translatedSkillName(skill.id, t);
  }
  if (
    issue.code === "inducementEligibility" ||
    issue.code === "inducementLimit"
  ) {
    const item = inducements.find((entry) => entry.name === values.name);
    if (item) values.name = t(`inducementNames.${item.id}`);
  }
  return values;
}
