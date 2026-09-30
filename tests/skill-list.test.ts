import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
import { SkillList } from "../src/components/skill-box";

vi.mock("gt-next", () => ({ useTranslations: () => (key: string) => key }));
vi.mock("../src/components/rule-help", () => ({
  RuleHelp: ({
    children,
    className,
  }: {
    children: ReactNode;
    className: string;
  }) => createElement("span", { className }, children),
}));

it("keeps starting skills before additional skills and captain Pro, sorting only within groups", () => {
  const html = renderToStaticMarkup(
    createElement(SkillList, {
      ids: ["sure_hands", "pass"],
      additionalIds: ["tackle", "block"],
      captain: true,
    }),
  );
  const names = [...html.matchAll(/<span[^>]*>([^<]*)<\/span>/g)].map(
    (match) => match[1],
  );
  expect(names).toEqual([
    "Pass",
    "Sure Hands",
    "Block",
    "Tackle",
    "proCaptain",
  ]);
});
