import { getRoster, getRuleset } from "@/domain/catalog";
import type { Team } from "@/domain/types";

export function libraryMatches(
  team: Team,
  filter: { search: string; rosterId: string; rulesetId: string },
) {
  if (filter.rosterId && team.rosterId !== filter.rosterId) return false;
  if (filter.rulesetId && team.rulesetId !== filter.rulesetId) return false;
  const terms = filter.search
    .trim()
    .toLocaleLowerCase()
    .split(/[\s\p{P}]+/u)
    .filter(Boolean);
  const words = [
    team.name,
    team.coach,
    getRoster(team.rosterId)?.name,
    getRuleset(team.rulesetId).name,
  ]
    .join(" ")
    .toLocaleLowerCase()
    .split(/[\s\p{P}]+/u);
  return (
    terms.length === 0 ||
    terms.some((term) => words.some((word) => word.startsWith(term)))
  );
}
