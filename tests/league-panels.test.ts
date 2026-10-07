// @vitest-environment happy-dom
import { act, createElement, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";
import {
  LeagueStatTable,
  sortLeagueRows,
  type LeagueStatRow,
} from "../src/components/league-statistics";
import {
  auditChanges,
  auditFields,
  LeagueHistory,
} from "../src/components/league-history";
import { LeagueRecruitment } from "../src/components/league-recruitment";
import { getRoster } from "../src/domain/catalog";

vi.mock("gt-next", () => ({ useTranslations: () => (key: string) => key }));
vi.mock("next/link", () => ({
  default: ({ children, ...props }: { children: ReactNode; href: string }) =>
    createElement("a", props, children),
}));
vi.mock("../src/components/player-icon", () => ({ PlayerIcon: () => null }));
vi.mock("../src/components/skill-box", () => ({ SkillList: () => null }));
vi.mock("../src/components/league-help", () => ({
  LeagueHelp: ({ stat }: { stat: string }) => stat,
}));

let cleanup: (() => Promise<void>) | undefined;
afterEach(async () => {
  await cleanup?.();
  vi.unstubAllGlobals();
});
async function mount(node: ReactNode) {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  cleanup = async () => {
    await act(async () => root.unmount());
    container.remove();
  };
  const render = async (next: ReactNode) => {
    await act(async () => root.render(next));
  };
  await render(node);
  return { container, render };
}
async function fill(input: HTMLInputElement, value: string) {
  await act(async () => {
    Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    )!.set!.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}
const rows: LeagueStatRow[] = [
  {
    id: "b",
    name: "Bears",
    detail: "Coach B",
    values: { rank: 2, pts: 9, td: "12:6" },
  },
  {
    id: "a",
    name: "Aces",
    detail: "Coach A",
    values: { rank: 1, pts: 9, td: "8:3" },
  },
];

it("preserves official rank for tied points and sorts score pairs numerically", () => {
  expect(sortLeagueRows(rows, "pts", false).map((row) => row.id)).toEqual([
    "a",
    "b",
  ]);
  expect(sortLeagueRows(rows, "td", false).map((row) => row.id)).toEqual([
    "b",
    "a",
  ]);
  expect(sortLeagueRows(rows, "td", true).map((row) => row.id)).toEqual([
    "a",
    "b",
  ]);
  expect(rows.map((row) => row.id)).toEqual(["b", "a"]);
});

it("keeps mobile cards and table results aligned when sorting and searching", async () => {
  const { container } = await mount(
    createElement(LeagueStatTable, {
      rows,
      columns: ["pts", "td"],
      firstLabel: "Teams",
      showRank: true,
    }),
  );
  const select = container.querySelector("select")!;
  await act(async () => {
    select.value = "td";
    select.dispatchEvent(new Event("change", { bubbles: true }));
  });
  expect(container.querySelector("tbody tr")?.textContent).toContain("Bears");
  expect(container.querySelector("ol li")?.textContent).toContain("Bears");
  await fill(container.querySelector("input")!, "Coach A");
  expect(container.querySelectorAll("tbody tr")).toHaveLength(1);
  expect(container.querySelectorAll("ol li")).toHaveLength(1);
  expect(container.querySelector("tbody")?.textContent).toContain("Aces");
  await fill(container.querySelector("input")!, "Missing");
  expect(container.textContent).toContain("leagueUx.noSearchResults");
  expect(
    [...container.querySelectorAll<HTMLButtonElement>("button")].find(
      (button) => button.textContent?.includes("leagueUi.downloadCsv"),
    )?.disabled,
  ).toBe(true);
});

it("preserves nested history changes and safely handles text details", () => {
  expect(
    auditFields('{"before":{"treasury":0},"after":{"treasury":5000}}'),
  ).toEqual([
    { path: ["before", "treasury"], value: "0" },
    { path: ["after", "treasury"], value: "5000" },
  ]);
  expect(auditFields("A manual explanation")).toEqual([
    { path: [], value: "A manual explanation" },
  ]);
  expect(auditFields("{}")).toEqual([]);
  expect(
    auditChanges(
      '{"before":{"treasury":0,"name":"Same"},"after":{"treasury":5000,"name":"Same"},"reason":"Winnings"}',
    ),
  ).toEqual({
    changes: [{ path: ["treasury"], before: "0", after: "5000" }],
    context: [{ path: ["reason"], value: "Winnings" }],
  });
});

it("combines activity and author filters on the loaded history", async () => {
  const { container } = await mount(
    createElement(LeagueHistory, {
      records: [
        {
          id: "1",
          action: "career-corrected",
          actorName: "Alex",
          createdAt: 1000,
          reason: "Corrected winnings",
          details: '{"treasury":5000}',
        },
        {
          id: "2",
          action: "team-registered",
          actorName: "Morgan",
          createdAt: 2000,
          reason: "",
          details: "{}",
        },
      ],
    }),
  );
  await fill(container.querySelector("input")!, "Alex");
  expect(container.querySelectorAll("li")).toHaveLength(1);
  expect(container.querySelector("li")?.textContent).toContain(
    "Corrected winnings",
  );
  const select = container.querySelector("select")!;
  await act(async () => {
    select.value = "team-registered";
    select.dispatchEvent(new Event("change", { bubbles: true }));
  });
  expect(container.textContent).toContain("leagueUx.noSearchResults");
  await act(async () =>
    [...container.querySelectorAll<HTMLButtonElement>("button")]
      .find((button) => button.textContent === "leagueUx.clearFilters")!
      .click(),
  );
  expect(container.querySelectorAll("li")).toHaveLength(2);
  expect(container.querySelectorAll("details")).toHaveLength(1);
});

it("revalidates the selected recruit when treasury or position availability changes", async () => {
  const position = getRoster("human")!.players[0];
  const hire = vi.fn().mockResolvedValue(true);
  const props = {
    positions: [position],
    players: [],
    treasury: position.cost,
    blockedPositionIds: [] as string[],
    busy: false,
    error: "",
    onHire: hire,
  };
  const { container, render } = await mount(
    createElement(LeagueRecruitment, props),
  );
  await act(async () =>
    container.querySelector<HTMLButtonElement>("button")!.click(),
  );
  const dialog = () => document.querySelector('[role="dialog"]')!;
  await act(async () =>
    dialog()
      .querySelector<HTMLButtonElement>('button[aria-pressed="false"]')!
      .click(),
  );
  expect(
    dialog().querySelector<HTMLButtonElement>('button[type="submit"]')!
      .disabled,
  ).toBe(false);
  await render(createElement(LeagueRecruitment, { ...props, treasury: 0 }));
  expect(dialog().textContent).toContain("leagueDesk.notEnoughGold");
  expect(
    dialog().querySelector<HTMLButtonElement>('button[type="submit"]')!
      .disabled,
  ).toBe(true);
  await render(
    createElement(LeagueRecruitment, {
      ...props,
      blockedPositionIds: [position.id],
    }),
  );
  expect(dialog().textContent).toContain("leagueDesk.positionBlocked");
  await act(async () =>
    dialog()
      .querySelector("form")!
      .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })),
  );
  expect(hire).not.toHaveBeenCalled();
});
