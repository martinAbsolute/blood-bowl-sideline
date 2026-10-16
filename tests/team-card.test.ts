// @vitest-environment happy-dom
import { act, createElement, type ComponentProps } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";
import { newTeam, rosters } from "../src/domain/catalog";
import { TeamCard } from "../src/components/team-card";
import { rosterColors } from "../src/lib/roster-colors";
import en from "../src/i18n/en.json";
import uk from "../src/i18n/uk.json";

const language = vi.hoisted(() => ({ locale: "en" as "en" | "uk" }));
vi.mock("next-intl", async (importOriginal) => {
  const actual = await importOriginal<typeof import("next-intl")>();
  return {
    ...actual,
    useTranslations: () =>
      actual.createTranslator({
        locale: language.locale,
        messages: language.locale === "uk" ? uk : en,
        onError(error) {
          throw error;
        },
      }),
  };
});
vi.mock("next/link", () => ({
  default: ({
    prefetch,
    ...props
  }: ComponentProps<"a"> & { prefetch?: boolean }) => {
    void prefetch;
    return createElement("a", props);
  },
}));
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
let root: Root | undefined;
afterEach(async () => {
  if (root) await act(async () => root!.unmount());
  root = undefined;
  document.body.innerHTML = "";
  language.locale = "en";
});
const makeTeam = () => newTeam("cb875e2c-f481-4cd4-a023-4610b28cda89");
async function mount(props: ComponentProps<typeof TeamCard>) {
  const container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  await act(async () => root!.render(createElement(TeamCard, props)));
  return container;
}

it("assigns every roster a unique, stable colour", () => {
  const colors = rosters.map((roster) => rosterColors[roster.id]);
  expect(colors.every(Boolean)).toBe(true);
  expect(new Set(colors).size).toBe(rosters.length);
  expect(rosterColors.human).toBe("#455fa1");
  expect(rosterColors.orc).toBe("#752c21");
});

it("renders the real team, a front-centred lineup, and independently usable support and actions", async () => {
  const team = makeTeam();
  team.name = "Altdorf Aces";
  team.staff = {
    rerolls: 3,
    apothecary: 1,
    assistantCoaches: 2,
    cheerleaders: 1,
    dedicatedFans: 4,
  };
  team.inducements = { bribes: 2 };
  team.players = [
    {
      id: "04ebca8c-b84a-4a8b-a339-3da3d44ad7ea",
      positionId: rosters.find((roster) => roster.id === "human")!.players[0]
        .id,
      name: "Otto",
      skills: [],
    },
  ];
  const onAction = vi.fn();
  const container = await mount({
    team,
    href: `/teams/${team.uuid}`,
    saveState: "device",
    action: createElement("button", { onClick: onAction }, "Favorite"),
  });
  expect(container.querySelector("h2")?.textContent).toBe(team.name);
  expect(container.querySelector("h2 a")?.getAttribute("href")).toBe(
    `/teams/${team.uuid}`,
  );
  expect(container.textContent).toContain("BB2025 Default · Human");
  expect(container.textContent).not.toContain("/ 16");
  expect(container.textContent).not.toContain("Open team");
  expect(container.querySelector(".lucide-arrow-up-right")).toBeNull();
  expect(container.querySelector("[data-team-status] svg")).not.toBeNull();
  expect(container.querySelector("footer [role=status]")?.textContent).toBe(
    "Local draft",
  );
  expect(container.querySelector("ol li")?.textContent).toContain("Otto");
  expect(container.querySelector("ol li")?.getAttribute("data-photo-row")).toBe(
    "front",
  );
  expect(
    container.querySelector('[aria-label="Apothecary: Yes"]')?.textContent,
  ).toBe("Yes");
  const staff = container.querySelector<HTMLButtonElement>(
    '[aria-label^="Sideline staff"]',
  )!;
  expect(staff.textContent).toBe("7");
  expect(staff.closest("a")).toBeNull();
  await act(async () => staff.click());
  expect(
    document.querySelector('[data-slot="tooltip-content"]')?.textContent,
  ).toBe(
    "Sideline staff\nAssistant coaches: 2\nCheerleaders: 1\nDedicated fans: 4",
  );
  await act(async () => staff.click());
  const induced = container.querySelector<HTMLButtonElement>(
    '[aria-label^="Inducements"]',
  )!;
  expect(induced.textContent).toBe("2");
  await act(async () => induced.click());
  expect(
    document.querySelector('[data-slot="tooltip-content"]')?.textContent,
  ).toBe("Inducements\nBribes: 2");
  const action = container.querySelector<HTMLButtonElement>("footer button")!;
  expect(action.closest("a")).toBeNull();
  await act(async () => action.click());
  expect(onAction).toHaveBeenCalledOnce();
});

it.each(["en", "uk"] as const)(
  "localizes apothecary and empty support in %s",
  async (locale) => {
    language.locale = locale;
    const words = locale === "uk" ? uk : en;
    const team = makeTeam();
    const container = await mount({ team, saveState: "device" });
    expect(
      container.querySelector(`[aria-label="${words.apothecary}: ${words.no}"]`)
        ?.textContent,
    ).toBe(words.no);
    for (const label of [words.staff, words.inducements]) {
      const message = `${label}: ${words.teamCard.none}`;
      const button = container.querySelector<HTMLButtonElement>(
        `[aria-label="${message}"]`,
      )!;
      await act(async () => button.click());
      expect(
        document.querySelector('[data-slot="tooltip-content"]')?.textContent,
      ).toBe(message);
      await act(async () => button.click());
    }
    await act(async () =>
      root!.render(
        createElement(TeamCard, {
          team: { ...team, staff: { ...team.staff, apothecary: 1 } },
        }),
      ),
    );
    expect(
      container.querySelector(
        `[aria-label="${words.apothecary}: ${words.yes}"]`,
      )?.textContent,
    ).toBe(words.yes);
  },
);

it.each(["cloud", "device", "pending", "error"] as const)(
  "preserves %s save status",
  async (saveState) => {
    const labels = {
      cloud: en.savedCloud,
      device: en.teamCard.localDraft,
      pending: en.saving,
      error: en.saveStatusError,
    };
    const container = await mount({ team: makeTeam(), saveState });
    expect(container.querySelector("footer [role=status]")?.textContent).toBe(
      labels[saveState],
    );
  },
);

it("preserves selection, disabled selection, and custom footers without nesting interactive controls", async () => {
  const team = makeTeam();
  const onSelect = vi.fn();
  const container = await mount({
    team,
    selection: { disabled: false, selected: false, onSelect },
    footer: createElement("button", null, "Details"),
  });
  const pick = container.querySelector<HTMLButtonElement>(
    "button[aria-pressed]",
  )!;
  await act(async () => pick.click());
  expect(onSelect).toHaveBeenCalledOnce();
  expect(container.querySelector("footer button")?.closest("h2")).toBeNull();
  expect(container.querySelector("button button")).toBeNull();
  await act(async () =>
    root!.render(
      createElement(TeamCard, {
        team,
        selection: { disabled: true, selected: false, onSelect },
      }),
    ),
  );
  expect(
    container.querySelector<HTMLButtonElement>("button[aria-pressed]")!
      .disabled,
  ).toBe(true);
});
