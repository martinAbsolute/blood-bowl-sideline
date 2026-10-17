// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { PLAYER_NAME_MAX_LENGTH } from "../src/domain/player-name";
import { InlinePlayerName } from "../src/components/player-name";

let root: Root;
let container: HTMLDivElement;
const onChange = vi.fn();
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  onChange.mockReset();
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});
async function render(value: string) {
  await act(async () =>
    root.render(
      createElement(InlinePlayerName, {
        value,
        designation: "Lineman",
        label: "Player name",
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

it("offers quiet name editing and keeps the designation below a named player", async () => {
  await render("");
  expect(container.querySelector("button")).toBeNull();
  expect(container.querySelector("input")!.placeholder).toBe("Lineman");
  const input = await type("  Captain  ");
  expect(container.querySelector("p")).toBeNull();
  expect(onChange).not.toHaveBeenCalled();
  await act(async () =>
    input.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
    ),
  );
  expect(onChange).toHaveBeenCalledExactlyOnceWith("Captain");
  await render("Captain");
  expect(container.querySelector("input")!.value).toBe("Captain");
  expect(container.querySelector("p")?.textContent).toBe("Lineman");
});

it("clears a saved name on blur and restores the unnamed display", async () => {
  await render("Captain");
  const input = await type("");
  await act(async () => input.blur());
  expect(onChange).toHaveBeenCalledExactlyOnceWith("");
  await render("");
  expect(input.value).toBe("");
  expect(input.placeholder).toBe("Lineman");
  expect(container.querySelector("p")).toBeNull();
});

it("cancels a name edit on Escape without opening the player modal", async () => {
  await render("Captain");
  const onKeyDown = vi.fn();
  document.body.addEventListener("keydown", onKeyDown);
  const input = await type("Another name");
  await act(async () =>
    input.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
    ),
  );
  expect(input.value).toBe("Captain");
  expect(onChange).not.toHaveBeenCalled();
  document.body.removeEventListener("keydown", onKeyDown);
  expect(onKeyDown).not.toHaveBeenCalled();
});

it("prefills and selects the designation without persisting it on untouched blur", async () => {
  await render("");
  const input = container.querySelector("input")!;
  await act(async () => input.focus());
  expect(input.value).toBe("Lineman");
  expect(input.selectionStart).toBe(0);
  expect(input.selectionEnd).toBe("Lineman".length);
  expect(container.querySelector("p")).toBeNull();
  await type("");
  expect(container.querySelector("p")).toBeNull();
  await type("New name");
  expect(container.querySelector("p")).toBeNull();
  expect(onChange).not.toHaveBeenCalled();
  await act(async () =>
    input.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
    ),
  );
  expect(input.placeholder).toBe("Lineman");
  expect(container.querySelector("p")).toBeNull();
  await act(async () => input.focus());
  await act(async () => input.blur());
  expect(onChange).not.toHaveBeenCalled();
  expect(input.value).toBe("");
});

it.each(["", "   "])("clears the saved name for %j on Enter", async (value) => {
  await render("Captain");
  const input = await type(value);
  expect(container.querySelector("p")?.textContent).toBe("Lineman");
  await act(async () =>
    input.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
    ),
  );
  expect(onChange).toHaveBeenCalledExactlyOnceWith("");
  await render("");
  expect(input.value).toBe("");
  expect(container.querySelector("p")).toBeNull();
});

it("commits a valid name on blur and leaves new external names intact", async () => {
  await render("Captain");
  const input = await type("  New name  ");
  expect(onChange).not.toHaveBeenCalled();
  await act(async () => input.blur());
  expect(onChange).toHaveBeenCalledExactlyOnceWith("New name");
  onChange.mockClear();
  await type("Unfinished");
  await render("Cloud name");
  expect(input.value).toBe("Cloud name");
  await act(async () => input.blur());
  expect(onChange).not.toHaveBeenCalled();
});

it("treats the designation as the default instead of a custom name", async () => {
  await render("Captain");
  const input = await type("Lineman");
  await act(async () => input.blur());
  expect(onChange).toHaveBeenCalledExactlyOnceWith("");
  await render("Lineman");
  expect(container.querySelector("p")).toBeNull();
});

it("limits new edits while keeping older saved names readable", async () => {
  await render("A".repeat(80));
  const input = container.querySelector("input")!;
  expect(input.value).toHaveLength(80);
  expect(input.maxLength).toBe(PLAYER_NAME_MAX_LENGTH);
  await act(async () => input.focus());
  await act(async () => input.blur());
  expect(onChange).not.toHaveBeenCalled();
  await type("B".repeat(PLAYER_NAME_MAX_LENGTH + 1));
  expect(input.value).toHaveLength(PLAYER_NAME_MAX_LENGTH);
  await act(async () => input.blur());
  expect(onChange).toHaveBeenCalledExactlyOnceWith(
    "B".repeat(PLAYER_NAME_MAX_LENGTH),
  );
});
