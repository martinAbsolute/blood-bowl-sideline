import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { getRoster } from "../src/domain/catalog";
import { RosterFacts, RosterTable } from "../src/components/roster-reference";
import { TeamReference } from "../src/components/team-reference";

vi.mock("gt-next", () => ({ useTranslations: () => (key: string) => key }));
vi.mock("../src/components/team-affiliations", () => ({
  TeamAffiliations: () => null,
}));
vi.mock("../src/components/player-icon", () => ({
  PlayerIcon: () => null,
  RosterIcon: () => null,
  StarPlayerIcon: () => null,
}));
vi.mock("../src/components/create-team-button", () => ({
  CreateTeamButton: () => null,
}));
vi.mock("../src/components/roster-ruleset-picker", () => ({
  RosterRulesetPicker: () => null,
}));
vi.mock("../src/components/rule-help", () => ({
  RuleHelp: ({ description, title }: { description: string; title: string }) =>
    `${title} ${description}`,
}));
vi.mock("../src/components/skill-box", () => ({ SkillList: () => null }));
vi.mock("../src/components/position-name", () => ({
  PositionName: ({ position }: { position: string }) => position,
}));

describe("ruleset-aware roster references", () => {
  it("shows the standard Sevens SP package separately from Kyiv", () => {
    const html = renderToStaticMarkup(
      createElement(RosterFacts, {
        roster: getRoster("human")!,
        rulesetId: "bb2025-sevens",
      }),
    );
    expect(html).toContain("600k GP");
    expect(html).toContain("tier:</span> 1");
    expect(html).toContain("skillPoints:</span> 1");
    expect(html).not.toContain("referenceFlexibleSkill");
  });
  it("uses each tournament currency and displays flexible Sevens skill slots", () => {
    const roster = getRoster("dwarf")!;
    const render = (
      rulesetId: Parameters<typeof RosterFacts>[0]["rulesetId"],
    ) =>
      renderToStaticMarkup(createElement(RosterFacts, { roster, rulesetId }));
    expect(render("kyiv-seven-sins-sevens")).toContain(
      "primary 1 · referenceFlexibleSkill 1",
    );
    expect(render("bb2025-matched-play")).toContain("skillPoints:</span>");
    expect(render("world-cup-2027")).toContain("spp:</span>");
    expect(render("eurobowl-2026")).toContain("skillGold:</span>");
  });
  it("shows Sevens inducements with matching help and omits the empty stars section", () => {
    const html = renderToStaticMarkup(
      createElement(TeamReference, {
        roster: getRoster("human")!,
        rulesetId: "kyiv-seven-sins-sevens",
      }),
    );
    expect(html).toContain("sevensPrayersHelp");
    expect(html).toContain("sevensApothecaryHelp");
    expect(html).toContain("Desperate Measures");
    expect(html).not.toContain("starPlayers");
    expect(html).not.toContain("inducementDescriptions.mercenary-players");
    expect(html).not.toContain("referencePreset");
  });
  it("switches treasury, tier, skill allowance, player count and staff prices for Sevens", () => {
    const roster = getRoster("human")!;
    const html = renderToStaticMarkup(
      createElement(RosterFacts, {
        roster,
        rulesetId: "kyiv-seven-sins-sevens",
      }),
    );
    expect(html).toContain("650k GP");
    expect(html).toContain("7–11");
    expect(html).toContain("100k GP");
    expect(html).toContain("80k GP");
    expect(html).toContain("tier:</span> 2");
    expect(html).toContain("skillAllowance:</span> primary 1");
    expect(html).toContain("referenceSpecialists:</span> 0–4");
    const standard = renderToStaticMarkup(
      createElement(RosterFacts, { roster }),
    );
    expect(standard).toContain("1000k GP");
    expect(standard).toContain("11–16");
    expect(standard).not.toContain("referenceSpecialists");
  });
  it("caps position quantities to the chosen ruleset team size", () => {
    const roster = getRoster("human")!;
    const sevens = renderToStaticMarkup(
      createElement(RosterTable, {
        roster,
        rulesetId: "kyiv-seven-sins-sevens",
      }),
    );
    expect(sevens).toContain("0–11");
    expect(sevens).not.toContain("0–16");
    const standard = renderToStaticMarkup(
      createElement(RosterTable, { roster }),
    );
    expect(standard).toContain("0–16");
  });
});
