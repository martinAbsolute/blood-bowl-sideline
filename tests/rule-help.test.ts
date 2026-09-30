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
      for (const item of inducements)
        expect(dictionary.inducementDescriptions).toHaveProperty(item.id);
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
});
