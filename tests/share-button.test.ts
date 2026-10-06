// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { ShareButton } from "../src/components/share-button";

vi.mock("gt-next", () => ({ useTranslations: () => (key: string) => key }));
const writeText = vi.fn();
const share = vi.fn();
const onShared = vi.fn();
let root: Root;
let container: HTMLDivElement;
let mobile = false;

beforeEach(async () => {
  vi.useFakeTimers();
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  mobile = false;
  vi.spyOn(window, "matchMedia").mockImplementation(
    () => ({ matches: mobile }) as MediaQueryList,
  );
  vi.stubGlobal("navigator", { clipboard: { writeText }, share });
  writeText.mockReset().mockResolvedValue(undefined);
  share.mockReset().mockResolvedValue(undefined);
  onShared.mockReset();
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  await act(async () =>
    root.render(createElement(ShareButton, { path: "/teams/123", onShared })),
  );
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
const button = () => container.querySelector("button")!;
async function click() {
  await act(async () => button().click());
}
async function advance(ms: number) {
  await act(async () => vi.advanceTimersByTime(ms));
}

it("copies once, transitions to a check, and resets", async () => {
  await click();
  expect(writeText).toHaveBeenCalledExactlyOnceWith(
    `${window.location.origin}/teams/123`,
  );
  expect(button().dataset.actionState).toBe("success");
  expect(container.querySelector('[role="status"]')?.textContent).toBe(
    "shareSucceeded",
  );
  expect(
    container
      .querySelector(".lucide-check")
      ?.parentElement?.getAttribute("aria-hidden"),
  ).toBe("false");
  await click();
  expect(writeText).toHaveBeenCalledTimes(1);
  await advance(1500);
  expect(button().dataset.actionState).toBe("idle");
  expect(button().disabled).toBe(false);
});

it("shows a cross on failure and permits retry", async () => {
  writeText.mockRejectedValueOnce(new Error("Clipboard unavailable"));
  await click();
  expect(button().dataset.actionState).toBe("error");
  expect(
    container
      .querySelector(".lucide-x")
      ?.parentElement?.getAttribute("aria-hidden"),
  ).toBe("false");
  expect(container.querySelector('[role="status"]')?.textContent).toBe(
    "copyFailed",
  );
  expect(onShared).not.toHaveBeenCalled();
  await advance(1500);
  await click();
  expect(button().dataset.actionState).toBe("success");
});

it("blocks duplicate clicks immediately and delays the spinner", async () => {
  let resolve!: () => void;
  writeText.mockReturnValue(
    new Promise<void>((done) => {
      resolve = done;
    }),
  );
  await click();
  expect(button().dataset.actionState).toBe("pending");
  await click();
  expect(writeText).toHaveBeenCalledTimes(1);
  await advance(50);
  expect(button().dataset.actionState).toBe("loading");
  await act(async () => resolve());
  expect(button().dataset.actionState).toBe("success");
});

it("shows success for native sharing and remains neutral when cancelled", async () => {
  mobile = true;
  share.mockRejectedValueOnce(new DOMException("Cancelled", "AbortError"));
  await click();
  expect(button().dataset.actionState).toBe("idle");
  expect(onShared).not.toHaveBeenCalled();
  expect(writeText).not.toHaveBeenCalled();
  await click();
  expect(button().dataset.actionState).toBe("success");
  expect(onShared).toHaveBeenCalledOnce();
});
