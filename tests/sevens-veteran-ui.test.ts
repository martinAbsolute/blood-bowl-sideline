import { randomUUID } from "node:crypto";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { newTeam, getRoster } from "../src/domain/catalog";
import { duplicateTeam } from "../src/lib/duplicate-team";
import { TeamPrint } from "../src/components/team-print";

it("remaps the veteran independently of the captain when duplicating a team", () => {
  const team = newTeam(randomUUID(), "human");
  team.players = [0, 1].map((index) => ({
    id: randomUUID(),
    positionId: "human-0",
    name: `Player ${index}`,
    skills: [],
  }));
  team.captainId = team.players[0].id;
  team.veteranId = team.players[1].id;
  const copy = duplicateTeam(team, "Copy");
  expect(copy.captainId).toBe(copy.players[0].id);
  expect(copy.veteranId).toBe(copy.players[1].id);
  expect(copy.veteranId).not.toBe(team.veteranId);
});

it("clears an obsolete veteran reference when duplicating", () => {
  const team = newTeam(randomUUID());
  team.veteranId = randomUUID();
  expect(duplicateTeam(team, "Copy").veteranId).toBeUndefined();
});

it("prints the veteran designation, ability and reduced MA only for Sevens", () => {
  const team = newTeam(randomUUID(), "human");
  const position = getRoster("human")!.players[0];
  team.players = [
    { id: randomUUID(), positionId: position.id, name: "Veteran", skills: [] },
  ];
  team.veteranId = team.players[0].id;
  team.rulesetId = "kyiv-seven-sins-sevens";
  const t = (key: string) => key;
  const html = renderToStaticMarkup(createElement(TeamPrint, { team, t }));
  expect(html).toContain('class="added">sevensVeteran</span>');
  expect(html).toContain("sevensVeteranHelp");
  expect(html).toContain("<dt>dedicatedFans</dt><dd>1</dd>");
  team.staff.dedicatedFans = 4;
  expect(renderToStaticMarkup(createElement(TeamPrint, { team, t }))).toContain(
    "<dt>dedicatedFans</dt><dd>5</dd>",
  );
  expect(html).toContain(`>${position.ma - 1}</td>`);
  team.rulesetId = "bb2025-default";
  const standard = renderToStaticMarkup(createElement(TeamPrint, { team, t }));
  expect(standard).not.toContain("sevensVeteran");
});
