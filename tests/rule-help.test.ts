import { describe, expect, it } from "vitest";
import {
  skills,
  inducements,
  rosters,
  stars,
  skillName,
} from "../src/domain/catalog";
import en from "../src/i18n/en.json";
import uk from "../src/i18n/uk.json";

describe("rule explanations", () => {
  for (const [locale, dictionary] of Object.entries({ en, uk })) {
    it(`${locale} explains every skill, including all roster and star traits`, () => {
      const ids = new Set(
        [
          ...skills.map((s) => s.id),
          ...rosters.flatMap((r) => r.players.flatMap((p) => p.skills)),
          ...stars.flatMap((s) => s.skills),
        ].map((id) => id.split(":")[0]),
      );
      for (const id of ids) {
        expect(dictionary.skillDescriptions).toHaveProperty(id);
        expect(
          dictionary.skillDescriptions[
            id as keyof typeof dictionary.skillDescriptions
          ].trim().length,
        ).toBeGreaterThan(10);
      }
      for (const skill of skills)
        expect(dictionary.skillCategories).toHaveProperty(skill.category);
    });
    it(`${locale} explains every inducement and staff item`, () => {
      expect(Object.keys(dictionary.inducementDescriptions)).toHaveLength(19);
      for (const item of inducements)
        expect(dictionary.inducementDescriptions).toHaveProperty(item.id);
      for (const id of ["mercenary-players", "star-players-inducement"])
        expect(dictionary.inducementDescriptions).toHaveProperty(id);
      for (const key of [
        "rerolls",
        "apothecary",
        "assistantCoaches",
        "cheerleaders",
        "dedicatedFans",
      ])
        expect(dictionary.staffDescriptions).toHaveProperty(key);
    });
  }
  it("displays trait parameters once and preserves non-numeric parameters", () => {
    expect(skillName("loner:3+")).toBe("Loner (3+)");
    expect(skillName("bloodlust:2+")).toBe("Bloodlust (2+)");
    expect(skillName("hatred:Undead")).toBe("Hatred (Undead)");
    expect(skillName("block")).toBe("Block");
  });
  it("uses the same corrected skill thresholds in both languages", () => {
    for (const dictionary of [en, uk]) {
      expect(dictionary.skillDescriptions.really_stupid).toContain("+2");
      expect(dictionary.skillDescriptions.monstrous_mouth).toContain("3+");
      expect(dictionary.skillDescriptions.monstrous_mouth).toContain("1-2");
      expect(dictionary.skillDescriptions.pile_driver).not.toContain(
        "not Marking",
      );
      expect(dictionary.skillDescriptions.nerves_of_steel).toContain(
        "Passing Ability Test",
      );
    }
  });
  it("uses the BB2025 Sports-Wizard spells in both languages", () => {
    for (const dictionary of [en, uk]) {
      expect(
        dictionary.inducementDescriptions["wizard-sports-wizard"],
      ).toContain("Fireball");
      expect(
        dictionary.inducementDescriptions["wizard-sports-wizard"],
      ).toContain("Zap!");
      expect(
        dictionary.inducementDescriptions["wizard-sports-wizard"],
      ).not.toContain("Thunderbolt");
    }
  });
  it("keeps complete Ukrainian exceptions and paragraph breaks in long skill definitions", () => {
    expect(uk.skillDescriptions.pro).toContain("Armour Roll");
    expect(uk.skillDescriptions.pro).toContain("Argue the Call");
    expect(uk.skillDescriptions.always_hungry).toContain("Apothecary");
    expect(uk.skillDescriptions.always_hungry).toContain("Regeneration");
    expect(uk.skillDescriptions.kick_team_mate).toContain("Star Player Points");
    expect(uk.skillDescriptions.ball_and_chain).toContain("Chomped");
    expect(uk.skillDescriptions.monstrous_mouth).toContain("Strip Ball");
    expect(uk.skillDescriptions.kick_team_mate).toContain("\n\n");
  });
});
