import {
  getRoster,
  getRuleset,
  inducements,
  skillName,
  sortSkillIds,
  stars,
} from "@/domain/catalog";
import {
  affiliation,
  dedicatedFansBase,
  inducementInfo,
  isSevens,
  playerMovement,
  playerSkillCost,
  staffInfo,
  summarize,
} from "@/domain/rules";
import type { Position, Star, Team } from "@/domain/types";
import { siteUrl } from "./site-metadata";

type PublicSnapshot = {
  team: Team;
  revision: number;
  legal: boolean;
  updatedAt: number;
  leagueLocked: boolean;
  leagueExperienced: boolean;
};

const gold = (value: number) => ({ value, unit: "gold pieces" });
const namedSkills = (ids: string[]) =>
  sortSkillIds(ids).map((id) => ({ id, name: skillName(id) }));
const staffNames: Record<keyof Team["staff"], string> = {
  rerolls: "Team re-rolls",
  apothecary: "Apothecary",
  assistantCoaches: "Assistant coaches",
  cheerleaders: "Cheerleaders",
  dedicatedFans: "Dedicated fans",
};
const attributes = (
  player: Position | Star,
  movementAllowance = player.ma,
) => ({
  movementAllowance,
  strength: player.st,
  agility: player.ag,
  passingAbility: player.pa,
  armourValue: player.av,
});

/** A public, saved roster, expanded using the same catalog/rules as the editor. */
export function teamStructuredData(data: PublicSnapshot) {
  const { team } = data;
  const roster = getRoster(team.rosterId)!;
  const ruleset = getRuleset(team.rulesetId);
  const totals = summarize(team);
  const skillUnit = ruleset.skillCurrency?.toUpperCase() ?? "gold pieces";
  const url = new URL(`/teams/${team.uuid}`, siteUrl).href;
  const players = team.players.map((player, index) => {
    const position = roster.players.find((p) => p.id === player.positionId)!;
    const skillCost = playerSkillCost(team, position, player.skills);
    return {
      id: player.id,
      number: index + 1,
      name: player.name,
      position: { id: position.id, name: position.position },
      attributes: attributes(
        position,
        playerMovement(team, player.id, position),
      ),
      builtInSkills: namedSkills(position.skills),
      addedSkills: namedSkills(player.skills),
      captainSkills: namedSkills(team.captainId === player.id ? ["pro"] : []),
      captain: team.captainId === player.id,
      veteran: isSevens(team) && team.veteranId === player.id,
      baseCost: gold(position.cost),
      advancementCost: { value: skillCost, unit: skillUnit },
      cost: gold(
        position.cost + (ruleset.id === "bb2025-default" ? skillCost : 0),
      ),
    };
  });
  const starPlayers = team.stars.map((id, index) => {
    const star = stars.find((s) => s.id === id)!;
    return {
      id,
      number: players.length + index + 1,
      name: star.name,
      playerType: star.playerType,
      attributes: attributes(star),
      builtInSkills: namedSkills(star.skills),
      cost: gold(star.cost),
    };
  });
  const staffPrices = staffInfo(team);
  const snapshot = {
    schemaVersion: 1,
    rulesVersion: team.rulesVersion,
    uuid: team.uuid,
    name: team.name,
    revision: data.revision,
    legal: data.legal,
    leagueLocked: data.leagueLocked,
    leagueExperienced: data.leagueExperienced,
    roster: {
      id: roster.id,
      name: roster.name,
      url: new URL(`/rosters/${roster.id}`, siteUrl).href,
      tier: totals.tier,
      leagues: roster.id === "norse" ? [team.norseLeague] : roster.leagues,
      specialRules: roster.specialRules.flatMap((name) =>
        name.startsWith("Favoured of") || name.startsWith("If Chaos Clash")
          ? (affiliation(team) ?? [])
          : name,
      ),
    },
    ruleset: { id: ruleset.id, name: ruleset.name, skillCurrency: skillUnit },
    players,
    starPlayers,
    staff: (Object.keys(team.staff) as (keyof Team["staff"])[]).map((id) => ({
      id,
      name: staffNames[id],
      purchased: team.staff[id],
      count:
        team.staff[id] + (id === "dedicatedFans" ? dedicatedFansBase(team) : 0),
      unitCost: gold(staffPrices[id].cost),
      cost: gold(team.staff[id] * staffPrices[id].cost),
    })),
    inducements: inducements
      .filter((item) => team.inducements[item.id] > 0)
      .map((item) => ({
        id: item.id,
        name: item.name,
        count: team.inducements[item.id],
        unitCost: gold(inducementInfo(team, item).cost),
        cost: gold(inducementInfo(team, item).cost * team.inducements[item.id]),
      })),
    summary: {
      playerCount: totals.playerCount,
      playersCost: gold(totals.players),
      starPlayersCost: gold(totals.starGold),
      staffCost: gold(totals.staff),
      inducementsCost: gold(totals.inducements),
      skillsCost: { value: totals.skills, unit: skillUnit },
      starPlayerSkillTax: { value: totals.starTax, unit: skillUnit },
      teamValue: gold(totals.teamGold),
    },
  };
  return {
    "@context": [
      "https://schema.org",
      {
        // JSON-LD 1.1 JSON literal: game-specific fields are not Schema.org terms.
        teamSnapshot: {
          "@id": "https://sideline.com.ua/ns/blood-bowl#teamSnapshot",
          "@type": "@json",
        },
      },
    ],
    "@type": "WebPage",
    "@id": url,
    url,
    name: team.name,
    dateModified: new Date(data.updatedAt).toISOString(),
    description:
      "Saved Blood Bowl tabletop game roster. League progression is recorded separately from this builder snapshot.",
    mainEntity: {
      "@type": "SportsTeam",
      "@id": `${url}#team`,
      url,
      identifier: team.uuid,
      name: team.name,
      sport: "Blood Bowl (tabletop game)",
      description: `${roster.name} roster using ${ruleset.name}. Players are fictional game characters.`,
      athlete: [
        ...players.map((player) => ({
          "@type": "Person",
          "@id": `${url}#player-${player.id}`,
          identifier: player.id,
          name: player.name || player.position.name,
          jobTitle: player.position.name,
        })),
        ...starPlayers.map((star) => ({
          "@type": "Person",
          "@id": `${url}#star-${star.id}`,
          identifier: star.id,
          name: star.name,
          jobTitle: "Star player",
        })),
      ],
      teamSnapshot: snapshot,
    },
  };
}

/** Escape raw-text script delimiters while keeping names losslessly parseable. */
export function serializeTeamStructuredData(data: PublicSnapshot) {
  return serializeTeamJsonLd(teamStructuredData(data));
}

export function serializeTeamJsonLd(
  data: ReturnType<typeof teamStructuredData>,
) {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
