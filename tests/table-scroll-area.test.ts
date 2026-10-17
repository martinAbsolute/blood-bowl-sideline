// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { TableScrollArea } from "../src/components/table-scroll-area";

let root: Root;
let host: HTMLDivElement;
let viewportWidth: number;
let contentWidth: number;
let resize: () => void;
const disconnect = vi.fn();

beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  viewportWidth = 400;
  contentWidth = 960;
  vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockImplementation(() => viewportWidth);
  vi.spyOn(HTMLElement.prototype, "scrollWidth", "get").mockImplementation(() => contentWidth);
  vi.stubGlobal(
    "ResizeObserver",
    class {
      constructor(callback: () => void) {
        resize = callback;
      }
      observe() {}
      disconnect = disconnect;
    },
  );
  disconnect.mockClear();
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

async function render() {
  await act(async () =>
    root.render(createElement(TableScrollArea, null, createElement("div", { className: "sticky-right-column" }))),
  );
  return host.firstElementChild as HTMLDivElement;
}

it("shows separation over hidden content and removes it at the right edge", async () => {
  const scroller = await render();
  expect(scroller.dataset.scrollRight).toBe("true");
  await act(async () => {
    scroller.scrollLeft = 560;
    scroller.dispatchEvent(new Event("scroll"));
  });
  expect(scroller.dataset.scrollRight).toBe("false");
  await act(async () => {
    scroller.scrollLeft = 100;
    scroller.dispatchEvent(new Event("scroll"));
  });
  expect(scroller.dataset.scrollRight).toBe("true");
});

it("updates when the viewport or table changes size", async () => {
  const scroller = await render();
  await act(async () => {
    viewportWidth = 1000;
    resize();
  });
  expect(scroller.dataset.scrollRight).toBe("false");
  await act(async () => {
    contentWidth = 1200;
    resize();
  });
  expect(scroller.dataset.scrollRight).toBe("true");
});

it("releases its resize observer on unmount", async () => {
  await render();
  await act(async () => root.unmount());
  expect(disconnect).toHaveBeenCalledOnce();
});
