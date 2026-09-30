import { rosters, stars } from "./catalog";
import type { Star } from "./types";

const leagueAliases: Record<string, string> = {
  "Elven Kingdom Leagues": "Elven Kingdoms League",
};
export const leagueName = (name: string) => leagueAliases[name] ?? name;
export const leagueSlug = (name: string) =>
  leagueName(name).toLowerCase().replaceAll(" ", "-");
export const leagues = [
  ...new Set(rosters.flatMap((r) => r.leagues.map(leagueName))),
];

/** A league reference lists league affiliations, not god-specific hires. */
export function starsForLeague(name: string): Star[] {
  return stars.filter((star) =>
    star.playsFor.some(
      (affiliation) =>
        affiliation === "Any Team" ||
        (affiliation.startsWith("Any team except")
          ? !affiliation.includes(name)
          : leagueName(affiliation) === name),
    ),
  );
}

export function specialRuleKey(name: string): string {
  if (name.startsWith("If Chaos Clash")) return "norse";
  if (name.startsWith("Favoured of")) return "favoured";
  const keys: Record<string, string> = {
    "Brawlin' Brutes": "brawlin",
    "Bribery and Corruption": "bribery",
    "Low Cost Linemen": "linemen",
    "Masters of Undeath": "undeath",
    Swarming: "swarming",
    "Team Captain": "captain",
  };
  return keys[name];
}
