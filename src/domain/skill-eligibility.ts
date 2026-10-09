// BB2025 Skills & Traits prerequisites and prohibited combinations.
// Kept separate from category access, preset budgets and duplicate checks so
// league advancement and tournament drafts use the same restrictions.
export function skillCompatible(
  skillId: string,
  existingSkills: readonly string[],
): boolean {
  // Parameters belong to starting traits, never to purchased skill IDs.
  // Reject aliases before checking bans, prerequisites and duplicate limits.
  if (skillId.includes(":")) return false;
  const known = new Set(existingSkills.map((id) => id.split(":")[0]));
  const frenzyConflicts = ["grab", "hit_and_run", "multiple_block"];
  if (
    (skillId === "frenzy" && frenzyConflicts.some((id) => known.has(id))) ||
    (frenzyConflicts.includes(skillId) && known.has("frenzy"))
  )
    return false;
  const requiredTrait: Record<string, string> = {
    saboteur: "secret_weapon",
    lethal_flight: "right_stuff",
    bullseye: "throw_team_mate",
    strong_arm: "throw_team_mate",
  };
  if (requiredTrait[skillId] && !known.has(requiredTrait[skillId]))
    return false;
  if (skillId === "leap" && known.has("pogo")) return false;
  if (
    skillId === "violent_innovator" &&
    ![
      "ball_and_chain",
      "bombardier",
      "breathe_fire",
      "chainsaw",
      "hypnotic_gaze",
      "kick_team_mate",
      "projectile_vomit",
      "stab",
    ].some((id) => known.has(id))
  )
    return false;
  if (
    known.has("ball_and_chain") &&
    [
      "diving_tackle",
      "eye_gouge",
      "frenzy",
      "grab",
      "hit_and_run",
      "leap",
      "multiple_block",
      "on_the_ball",
      "shadowing",
      "steady_footing",
    ].includes(skillId)
  )
    return false;
  return true;
}
