import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import {
  getSkill,
  rosters,
  skills,
  starPairs,
  stars,
} from "../src/domain/catalog";
import { advancementChoices } from "../src/domain/league-rules";
import { skillAccess } from "../src/domain/rules";
import { SkillList } from "../src/components/skill-box";
import en from "../src/i18n/en.json";
import uk from "../src/i18n/uk.json";
import verified from "./fixtures/bb2025-star-skills.json";

vi.mock("gt-next", () => ({ useTranslations: () => (key: string) => key }));
vi.mock("../src/components/rule-help", () => ({
  RuleHelp: ({
    children,
    className,
    description,
    meta,
  }: {
    children: ReactNode;
    className: string;
    description: string;
    meta: string;
  }) =>
    createElement(
      "span",
      { className, "data-description": description, "data-meta": meta },
      children,
    ),
}));

describe("verified BB2025 star skills and special rules", () => {
  it("covers all stars and all unique special rules", () => {
    expect(verified.map((p) => p.id).sort()).toEqual(
      stars.map((s) => s.id).sort(),
    );
    expect(new Set(verified.map((p) => p.specialRule))).toEqual(
      new Set(skills.filter((s) => s.category === "special").map((s) => s.id)),
    );
  });

  it.each(verified)(
    "preserves the complete starting skills and special rule for $id",
    (profile) => {
      const star = stars.find((s) => s.id === profile.id)!;
      expect(star.skills.toSorted()).toEqual(
        [...profile.skills, profile.specialRule].toSorted(),
      );
      expect(new Set(star.skills).size).toBe(star.skills.length);
      expect(profile.source).toMatch(
        /^https:\/\/bloodbowlbase.ru\/bb2025\/starplayers\//,
      );
      const special = getSkill(profile.specialRule)!;
      expect(special.category).toBe("special");
      for (const dictionary of [en, uk]) {
        expect(dictionary.skillCategories.special).toBeTruthy();
        expect(dictionary.skillNames).toHaveProperty(special.id);
        expect(dictionary.skillDescriptions).toHaveProperty(special.id);
        expect(
          dictionary.skillDescriptions[
            special.id as keyof typeof dictionary.skillDescriptions
          ].length,
        ).toBeGreaterThan(20);
      }
      expect(en.skillNames[special.id as keyof typeof en.skillNames]).toBe(
        special.name,
      );
    },
  );

  it("gives both members of each mandatory pair their shared rule", () => {
    for (const pair of starPairs) {
      const rules = pair.map((id) =>
        stars
          .find((s) => s.id === id)!
          .skills.filter((skill) => getSkill(skill)?.category === "special"),
      );
      expect(rules[0]).toHaveLength(1);
      expect(rules[0]).toEqual(rules[1]);
    }
    for (const dictionary of [en, uk]) {
      const carry = dictionary.skillDescriptions.ill_carry_you;
      expect(carry).toContain(dictionary.skillNames.dodge);
      expect(
        dictionary.skillDescriptions.working_in_tandem.length,
      ).toBeGreaterThan(120);
    }
  });

  it("renders special rules as distinct badges with rule help", () => {
    const html = renderToStaticMarkup(
      createElement(SkillList, { ids: ["dodge", "blind_rage"] }),
    );
    expect(html).toContain('class="skill-box skill-special"');
    expect(html).toContain("Blind Rage");
    expect(html).toContain('data-description="skillDescriptions.blind_rage"');
    expect(html).toContain('data-meta="skillCategories.special"');
    expect(html).toContain('class="skill-box skill-agility"');
  });

  it("never offers star special rules as purchasable advancements", () => {
    const special = skills.filter((s) => s.category === "special");
    for (const roster of rosters)
      for (const position of roster.players) {
        for (const skill of special)
          expect(skillAccess(position, skill.id)).toBeNull();
        expect(
          advancementChoices(roster.id, position.id, []).some(
            (choice) => getSkill(choice.skillId)?.category === "special",
          ),
        ).toBe(false);
      }
  });
});
