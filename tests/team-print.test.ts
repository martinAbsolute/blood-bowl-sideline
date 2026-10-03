import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { newTeam, rosters, skillName, stars } from "../src/domain/catalog";
import { TeamPrint, printStyles } from "../src/components/team-print";
import { duplicateTeam } from "../src/lib/duplicate-team";
import { TEAM_NAME_MAX_LENGTH } from "../src/domain/team-name";
import en from "../src/i18n/en.json";
import uk from "../src/i18n/uk.json";

function translator(dictionary: typeof en) {
  return (key: string): string => {
    let value: unknown = dictionary;
    for (const part of key.split("."))
      value = (value as Record<string, unknown>)[part];
    if (typeof value !== "string")
      throw new Error(`Missing translation: ${key}`);
    return value;
  };
}

it("duplicates independent player identities while preserving the captain and all selections", () => {
  const team = newTeam(randomUUID(), "orc");
  team.name = "A".repeat(TEAM_NAME_MAX_LENGTH);
  const captain = randomUUID();
  team.players = [
    { id: captain, positionId: "orc-0", name: "Captain", skills: ["block"] },
  ];
  team.captainId = captain;
  team.staff.rerolls = 3;
  team.notes = "A game plan";
  const copy = duplicateTeam(team, "Copy");
  expect(copy.name).toHaveLength(TEAM_NAME_MAX_LENGTH);
  expect(copy.name.endsWith(" (Copy)")).toBe(true);
  expect(copy.uuid).not.toBe(team.uuid);
  expect(copy.captainId).toBe(copy.players[0].id);
  expect(copy.captainId).not.toBe(team.captainId);
  copy.players[0].skills.push("dodge");
  copy.staff.rerolls = 1;
  expect(team.players[0].skills).toEqual(["block"]);
  expect(team.staff.rerolls).toBe(3);
  expect(copy.notes).toBe(team.notes);
});

it("prints regular, additional and captain skills distinctly and escapes coach-entered text", () => {
  const team = newTeam(randomUUID(), "orc");
  team.name = "<script>alert('team')</script>";
  const player = {
    id: randomUUID(),
    positionId: "orc-3",
    name: "<img src=x>",
    skills: ["tackle", "guard"],
  };
  team.players = [player];
  team.captainId = player.id;
  const html = renderToStaticMarkup(
    createElement(TeamPrint, { team, t: translator(en) }),
  );
  expect(html).toContain("<span>Block</span>");
  expect(html).toContain('<span class="added">Guard</span>');
  expect(html.indexOf('<span class="added">Guard</span>')).toBeLessThan(
    html.indexOf('<span class="added">Tackle</span>'),
  );
  expect(player.skills).toEqual(["tackle", "guard"]);
  expect(html).toContain('<span class="captain">Pro (Team Captain)</span>');
  expect(html.indexOf('<span class="added">Tackle</span>')).toBeLessThan(
    html.indexOf('<span class="captain">Pro (Team Captain)</span>'),
  );
  expect(html).not.toMatch(/<script|<img|<button|<input/);
  expect(html).toContain("&lt;script&gt;");
  expect(html).toContain(en.skillDescriptions.guard);
  expect(html).toContain(
    renderToStaticMarkup(createElement("p", null, en.skillDescriptions.pro)),
  );
});

it("omits owner names and obsolete notes from printouts in both languages", () => {
  const team = { ...newTeam(randomUUID()), notes: "Obsolete notes" };
  for (const dictionary of [en, uk]) {
    const html = renderToStaticMarkup(
      createElement(TeamPrint, { team, t: translator(dictionary) }),
    );
    expect(html).not.toContain("Obsolete notes");
    expect(html).not.toContain("Coach name");
    expect(html).not.toContain("Ім’я тренера");
  }
});

describe.each([
  ["en", en],
  ["uk", uk],
] as const)("%s rule appendix", (_, dictionary) => {
  it("contains complete definitions for every roster's skills and selected star skills", () => {
    const t = translator(dictionary);
    for (const roster of rosters) {
      const team = newTeam(randomUUID(), roster.id);
      team.players = roster.players.map((position) => ({
        id: randomUUID(),
        positionId: position.id,
        name: "",
        skills: [],
      }));
      team.stars = stars.map((star) => star.id);
      const html = renderToStaticMarkup(createElement(TeamPrint, { team, t }));
      expect(html).not.toContain("undefined");
      for (const id of new Set([
        ...roster.players.flatMap((p) => p.skills),
        ...stars.flatMap((s) => s.skills),
      ])) {
        expect(html).toContain(
          renderToStaticMarkup(createElement("strong", null, skillName(id))),
        );
        expect(html).toContain(
          renderToStaticMarkup(
            createElement(
              "p",
              null,
              t(`skillDescriptions.${id.split(":")[0]}`),
            ),
          ),
        );
      }
    }
  });
});

it("uses A4 in the chosen orientation and starts the rule appendix on a new page", () => {
  expect(printStyles("portrait")).toContain("size: A4 portrait");
  expect(printStyles("landscape")).toContain("size: A4 landscape");
  expect(printStyles("portrait")).toContain(
    ".reference { break-before: page; }",
  );
  expect(printStyles("landscape")).toContain(
    "font-size: 9pt; line-height: 1.3;",
  );
});
