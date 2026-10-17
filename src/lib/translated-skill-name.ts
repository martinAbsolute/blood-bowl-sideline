import { getSkill, skillName } from "@/domain/catalog";

/** Display only: catalog IDs, rule matching, and English sorting stay stable. */
export function translatedSkillName(
  id: string,
  t: (key: `skillNames.${string}` | `inducementNames.${string}`) => string,
) {
  const [base, parameter] = id.split(":");
  if (!getSkill(id)) return skillName(id);
  const key = `skillNames.${base}` as const;
  const entry = t(key);
  if (!entry || entry === key) return skillName(id);
  const translated = parameter
    ? /\(x\+?\)/i.test(entry)
      ? entry.replace(/\(x\+?\)/i, `(${parameter})`)
      : `${entry} (${parameter})`
    : entry;
  return translated;
}

export function skillSearchText(id: string, t: (key: `skillNames.${string}` | `inducementNames.${string}`) => string) {
  return `${translatedSkillName(id, t)} ${skillName(id)}`.toLocaleLowerCase();
}
