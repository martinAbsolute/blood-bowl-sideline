import { getSkill, skillName } from "@/domain/catalog";

/** Display only: catalog IDs, rule matching, and English sorting stay stable. */
export function translatedSkillName(id: string, t: (key: string) => string) {
  const [base, parameter] = id.split(":");
  if (!getSkill(id)) return skillName(id);
  const key = `skillNames.${base}`;
  const entry = t(key);
  if (!entry || entry === key) return skillName(id);
  const translated = parameter
    ? /\(x\+?\)/i.test(entry)
      ? entry.replace(/\(x\+?\)/i, `(${parameter})`)
      : `${entry} (${parameter})`
    : entry;
  return translated;
}

/** Search both languages without adding English to the displayed label. */
export function skillSearchText(id: string, t: (key: string) => string) {
  return `${translatedSkillName(id, t)} ${skillName(id)}`.toLocaleLowerCase();
}
