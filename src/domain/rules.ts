import {
  categories,
  getRoster,
  getRuleset,
  getSkill,
  inducements,
  stars,
  starPairs,
  starChoices,
} from "./catalog";
import {
  teamSchema,
  type Team,
  type Position,
  type Star,
  type Inducement,
} from "./types";

export type Issue = { code: string; values: Record<string, string | number> };
export function tierFor(team: Team) {
  return Number(
    Object.entries(getRuleset(team.rulesetId).tiers).find(([, ids]) =>
      ids.includes(team.rosterId),
    )?.[0] ?? 0,
  );
}
export function budgetFor(team: Team) {
  const rules = getRuleset(team.rulesetId);
  return rules.tierBudgets[tierFor(team)] ?? rules.tierBudgets[0];
}
export function skillAccess(position: Position, skillId: string) {
  const skill = getSkill(skillId);
  const category = skill ? categories[skill.category] : undefined;
  return category && position.primarySkills.includes(category)
    ? "primary"
    : category && position.secondarySkills.includes(category)
      ? "secondary"
      : null;
}
export function playerSkillCost(
  team: Team,
  position: Position,
  selected: string[],
) {
  const rules = getRuleset(team.rulesetId),
    costs = rules.skillCosts;
  if (
    team.rulesetId === "eurobowl-2026" &&
    selected.length === 2 &&
    selected.every((id) => skillAccess(position, id) === "primary")
  ) {
    return costs.stackCosts[
      selected.filter((id) => getSkill(id)?.isElite).length
    ].cost;
  }
  return selected.reduce((sum, id, index) => {
    const primary = skillAccess(position, id) === "primary",
      elite = getSkill(id)?.isElite;
    if (index > 0 && rules.skillCurrency === "spp")
      return (
        sum +
        (primary
          ? elite
            ? costs.secondPrimaryElite!
            : costs.secondPrimaryNonElite!
          : elite
            ? costs.secondSecondaryElite!
            : costs.secondSecondaryNonElite!)
      );
    return (
      sum +
      (primary
        ? elite
          ? costs.primaryElite
          : costs.primaryNonElite
        : elite
          ? costs.secondaryElite
          : costs.secondaryNonElite)
    );
  }, 0);
}
export function affiliation(team: Team) {
  const roster = getRoster(team.rosterId)!;
  if (roster.id === "chaos-chosen" || roster.id === "chaos-renegade")
    return `Favoured of ${team.favouredOf}`;
  if (roster.id === "norse")
    return team.norseLeague === "Chaos Clash" ? "Favoured of Khorne" : null;
  return roster.specialRules.find((r) => r.startsWith("Favoured of")) ?? null;
}
export function starEligible(team: Team, star: Star) {
  const roster = getRoster(team.rosterId),
    rules = getRuleset(team.rulesetId);
  if (!roster || rules.bannedStarPlayers.includes(star.id)) return false;
  const leagues = roster.id === "norse" ? [team.norseLeague] : roster.leagues;
  if (
    !star.playsFor.some(
      (a) =>
        a === "Any Team" ||
        (a.startsWith("Any team except")
          ? !leagues.some((l) => a.includes(l))
          : leagues.includes(a) || a === affiliation(team)),
    )
  )
    return false;
  if (rules.id === "world-cup-2027")
    return rules.teamOverrides?.[roster.id]?.canHireStarPlayers === true;
  if (rules.id === "bb2025-default") return true;
  const limits = rules.starPlayerTierRules[tierFor(team)];
  if (!limits) return false;
  if (rules.legendStarPlayers.includes(star.id)) return limits.maxLegends > 0;
  if (
    rules.veteranStarPlayers.length &&
    !rules.veteranStarPlayers.includes(star.id)
  )
    return false;
  return limits.maxVeterans > 0;
}
export function inducementInfo(team: Team, inducement: Inducement) {
  const roster = getRoster(team.rosterId)!;
  const matching = inducement.specialCosts?.find(
    (x) =>
      roster.specialRules.includes(x.specialRule) ||
      roster.leagues.includes(x.specialRule),
  );
  let max = Number((matching?.max ?? inducement.max).split("-")[1]);
  if (
    team.rulesetId === "world-cup-2027" &&
    inducement.id === "bribes" &&
    team.stars.some((id) =>
      stars.find((s) => s.id === id)?.skills.includes("secret_weapon"),
    )
  )
    max = Math.min(max, 2);
  const required: Record<string, boolean> = {
    "mortuary-assistant": roster.specialRules.includes("Masters of Undeath"),
    "plague-doctor": affiliation(team) === "Favoured of Nurgle",
    "riotous-rookies": roster.specialRules.includes("Low Cost Linemen"),
    "wandering-apothecary": roster.apothecary,
  };
  return {
    cost: matching?.cost ?? inducement.cost,
    max,
    allowed:
      getRuleset(team.rulesetId).allowedInducements.includes(inducement.id) &&
      (required[inducement.id] ?? true),
  };
}
export function summarize(team: Team) {
  const roster = getRoster(team.rosterId)!,
    rules = getRuleset(team.rulesetId),
    budget = budgetFor(team);
  const selectedStars = team.stars.flatMap(
    (id) => stars.find((s) => s.id === id) ?? [],
  );
  const players = team.players.reduce(
    (sum, p) =>
      sum + (roster.players.find((x) => x.id === p.positionId)?.cost ?? 0),
    0,
  );
  const starGold = selectedStars.reduce((sum, s) => sum + s.cost, 0);
  const staff =
    team.staff.rerolls * roster.rerolls.cost +
    team.staff.apothecary * 50000 +
    (team.staff.assistantCoaches + team.staff.cheerleaders) * 10000 +
    team.staff.dedicatedFans * 5000;
  const induced = Object.entries(team.inducements).reduce((sum, [id, qty]) => {
    const item = inducements.find((i) => i.id === id);
    return sum + (item ? inducementInfo(team, item).cost * qty : 0);
  }, 0);
  const advancement = team.players.reduce((sum, p) => {
    const position = roster.players.find((x) => x.id === p.positionId);
    return sum + (position ? playerSkillCost(team, position, p.skills) : 0);
  }, 0);
  const starLimits = rules.starPlayerTierRules[tierFor(team)];
  const starTax =
    rules.skillCurrency === "spp" && selectedStars.length
      ? (rules.starPlayerTax?.find((t) => starGold <= t.maxCost)?.sppCost ?? 0)
      : starChoices(team.stars).reduce(
          (sum, id) =>
            sum +
            (starLimits
              ? rules.legendStarPlayers.includes(id)
                ? starLimits.legendSkillGoldCost
                : starLimits.veteranSkillGoldCost
              : 0),
          0,
        );
  const skills = advancement + starTax;
  const teamGold =
    players +
    staff +
    induced +
    starGold +
    (rules.id === "bb2025-default" ? advancement : 0);
  const fundsUsed =
    rules.id === "eurobowl-2026"
      ? Math.max(0, teamGold - budget.teamBudget) +
        Math.max(0, skills - budget.skillGold)
      : 0;
  const remaining = budget.teamBudget - teamGold;
  return {
    players,
    staff,
    inducements: induced,
    starGold,
    skills,
    starTax,
    teamGold,
    remaining,
    fundsUsed,
    budget,
    tier: tierFor(team),
    playerCount: team.players.length + team.stars.length,
  };
}
export function validateTeam(input: unknown): {
  issues: Issue[];
  valid: boolean;
} {
  const parsed = teamSchema.safeParse(input);
  const issues: Issue[] = [];
  const issue = (code: string, values: Issue["values"] = {}) =>
    issues.push({ code, values });
  if (!parsed.success)
    return { issues: [{ code: "invalidData", values: {} }], valid: false };
  const team = parsed.data,
    roster = getRoster(team.rosterId),
    rules = getRuleset(team.rulesetId);
  if (!roster)
    return { issues: [{ code: "unknownRoster", values: {} }], valid: false };
  const totals = summarize(team),
    overrides = rules.teamOverrides?.[roster.id];
  if (
    ["chaos-chosen", "chaos-renegade"].includes(roster.id) &&
    team.favouredOf === "Hashut"
  )
    issue("affiliation");
  if (team.captainId) {
    const captain = team.players.find((p) => p.id === team.captainId),
      position = roster.players.find((p) => p.id === captain?.positionId);
    if (
      !roster.specialRules.includes("Team Captain") ||
      !captain ||
      !position ||
      position.position.includes("Big Guy") ||
      captain.skills.includes("pro")
    )
      issue("captain");
  }
  if (new Set(team.players.map((p) => p.id)).size !== team.players.length)
    issue("duplicatePlayer");
  if (totals.playerCount < rules.minPlayers)
    issue("minPlayers", { count: rules.minPlayers - totals.playerCount });
  if (totals.playerCount > rules.maxPlayers)
    issue("maxPlayers", { max: rules.maxPlayers });
  if (
    team.rulesetId === "world-cup-2027" &&
    team.stars.length &&
    team.players.length < 11
  )
    issue("regularPlayers");
  let secondaryPlayers = 0,
    stackedPlayers = 0,
    eliteSkills = 0,
    bigGuys = 0,
    insignificant = 0;
  for (const p of team.players) {
    const position = roster.players.find((x) => x.id === p.positionId);
    if (!position) {
      issue("unknownPosition");
      continue;
    }
    if (position.position.includes("Big Guy")) bigGuys++;
    if (position.skills.includes("insignificant")) insignificant++;
    const secondary = p.skills.filter(
      (id) => skillAccess(position, id) === "secondary",
    );
    if (secondary.length) secondaryPlayers++;
    if (p.skills.length > 1) stackedPlayers++;
    const maxSkills =
      overrides?.maxSkillsPerPlayer ??
      (team.rulesetId === "eurobowl-2026" ? 2 : rules.maxAdvancementsPerPlayer);
    if (p.skills.length > maxSkills)
      issue("maxSkills", {
        player: p.name || position.position,
        max: maxSkills,
      });
    if (
      team.rulesetId === "eurobowl-2026" &&
      p.skills.length > 1 &&
      secondary.length
    )
      issue("primaryStack");
    if (new Set(p.skills).size !== p.skills.length)
      issue("duplicateSkill", { player: p.name || position.position });
    for (const id of p.skills) {
      if (
        !skillAccess(position, id) ||
        !getSkill(id) ||
        position.skills.map((s) => s.split(":")[0]).includes(id)
      )
        issue("skillAccess", {
          skill: getSkill(id)?.name ?? id,
          player: p.name || position.position,
        });
      if (getSkill(id)?.isElite) eliteSkills++;
    }
  }
  if (insignificant > team.players.length - insignificant)
    issue("insignificant");
  if (roster.bigGuyMax !== undefined && bigGuys > roster.bigGuyMax)
    issue("bigGuys", { max: roster.bigGuyMax });
  for (const p of roster.players) {
    const max = Number(p.qty.split("-")[1]);
    if (team.players.filter((x) => x.positionId === p.id).length > max)
      issue("positionLimit", { position: p.position, max });
  }
  if (
    secondaryPlayers >
    (rules.maxSecondaryByTier?.[totals.tier] ?? rules.maxSecondaryPerTeam)
  )
    issue("secondaryLimit", {
      max: rules.maxSecondaryByTier?.[totals.tier] ?? rules.maxSecondaryPerTeam,
    });
  if (stackedPlayers > (overrides?.maxStackPlayers ?? rules.maxStackPerTeam))
    issue("stackLimit", {
      max: overrides?.maxStackPlayers ?? rules.maxStackPerTeam,
    });
  if (
    rules.maxElitePerTeam !== undefined &&
    eliteSkills > rules.maxElitePerTeam
  )
    issue("eliteLimit", { max: rules.maxElitePerTeam });
  if (new Set(team.stars).size !== team.stars.length) issue("duplicateStar");
  let veterans = 0,
    legends = 0;
  for (const id of team.stars) {
    const star = stars.find((s) => s.id === id);
    if (!star || !starEligible(team, star))
      issue("starEligibility", { star: star?.name ?? id });
  }
  for (const id of starChoices(team.stars)) {
    if (rules.legendStarPlayers.includes(id)) legends++;
    else veterans++;
  }
  if (starChoices(team.stars).length > 2) issue("starLimit");
  const limits = rules.starPlayerTierRules[totals.tier];
  if (
    limits &&
    (veterans > limits.maxVeterans ||
      legends > limits.maxLegends ||
      (!limits.canMix && veterans > 0 && legends > 0))
  )
    issue("starLimit");
  if (
    rules.starPlayerBlocksAdvancements &&
    team.stars.length &&
    (secondaryPlayers > 0 || stackedPlayers > 0)
  )
    issue("starSkills");
  for (const [a, b] of starPairs)
    if (team.stars.includes(a) !== team.stars.includes(b)) issue("starPair");
  if (!roster.apothecary && team.staff.apothecary) issue("apothecary");
  if (team.rulesetId !== "bb2025-default" && team.staff.dedicatedFans)
    issue("fans");
  for (const [id, qty] of Object.entries(team.inducements)) {
    if (!qty) continue;
    const item = inducements.find((x) => x.id === id);
    if (!item) {
      issue("unknownInducement");
      continue;
    }
    const info = inducementInfo(team, item);
    if (!info.allowed) issue("inducementEligibility", { name: item.name });
    if (qty > info.max)
      issue("inducementLimit", { name: item.name, max: info.max });
  }
  if (team.rulesetId === "eurobowl-2026") {
    if (totals.fundsUsed > totals.budget.flowingFunds)
      issue("flowingFunds", { max: totals.budget.flowingFunds / 1000 });
  } else if (totals.teamGold > totals.budget.teamBudget)
    issue("budget", {
      excess: (totals.teamGold - totals.budget.teamBudget) / 1000,
    });
  if (rules.skillCurrency && totals.skills > totals.budget.skillGold)
    issue("skillBudget", { excess: totals.skills - totals.budget.skillGold });
  return { issues, valid: issues.length === 0 };
}
