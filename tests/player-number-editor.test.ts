// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { newTeam } from "../src/domain/catalog";
import { InlinePlayerNumber } from "../src/components/player-number";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

let root: Root;
let container: HTMLDivElement;
let team: ReturnType<typeof newTeam>;
const onChange = vi.fn();
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  team = newTeam(crypto.randomUUID(), "human");
  team.players = ["01", "02"].map((number) => ({
    id: crypto.randomUUID(),
    positionId: "human-0",
    name: "",
    skills: [],
    number,
  }));
  onChange.mockReset();
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});
async function render() {
  await act(async () =>
    root.render(
      createElement(InlinePlayerNumber, {
        team,
        playerId: team.players[0].id,
        onChange,
      }),
    ),
  );
}
async function type(value: string) {
  const input = container.querySelector("input")!;
  await act(async () => {
    input.focus();
    Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      "value",
    )!.set!.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  return input;
}

it("edits the number directly without an edit button", async () => {
  await render();
  expect(container.querySelector("button")).toBeNull();
  await act(async () => container.querySelector("input")!.focus());
  const input = container.querySelector("input")!;
  expect(document.activeElement).toBe(input);
  expect(input.selectionStart).toBe(0);
  expect(input.selectionEnd).toBe(2);
});

it("blocks duplicates and commits a complete number on Enter in numeric order", async () => {
  await render();
  const input = await type("2");
  expect(input.getAttribute("aria-invalid")).toBe("true");
  expect(container.querySelector('[role="alert"]')).toBeNull();
  await act(async () => input.blur());
  expect(onChange).not.toHaveBeenCalled();
  expect(input.value).toBe("01");
  expect(input.getAttribute("aria-invalid")).toBe("false");
  await type("09");
  expect(onChange).not.toHaveBeenCalled();
  await act(async () =>
    input.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
    ),
  );
  expect(onChange).toHaveBeenCalledExactlyOnceWith(
    expect.objectContaining({
      players: [team.players[1], { ...team.players[0], number: "09" }],
    }),
  );
});

it("discards a table number edit on Escape", async () => {
  await render();
  const input = await type("9");
  await act(async () =>
    input.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
    ),
  );
  expect(input.value).toBe("01");
  expect(onChange).not.toHaveBeenCalled();
});

it.each(["", "02", "2", "ab"])(
  "discards invalid number %j on Enter",
  async (value) => {
    await render();
    const input = await type(value);
    expect(input.getAttribute("aria-invalid")).toBe("true");
    await act(async () =>
      input.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
      ),
    );
    expect(onChange).not.toHaveBeenCalled();
    expect(input.value).toBe("01");
    expect(input.getAttribute("aria-invalid")).toBe("false");
  },
);

it("commits a valid number on blur but keeps unfinished typing local", async () => {
  await render();
  const input = await type("7");
  expect(onChange).not.toHaveBeenCalled();
  await act(async () => input.blur());
  expect(onChange).toHaveBeenCalledExactlyOnceWith(
    expect.objectContaining({
      players: [team.players[1], { ...team.players[0], number: "7" }],
    }),
  );
});

it("drops an uncommitted number when the saved value changes externally", async () => {
  await render();
  const input = await type("9");
  team = {
    ...team,
    players: team.players.map((player, index) =>
      index === 0 ? { ...player, number: "03" } : player,
    ),
  };
  await render();
  expect(input.value).toBe("03");
  await act(async () => input.blur());
  expect(onChange).not.toHaveBeenCalled();
});
