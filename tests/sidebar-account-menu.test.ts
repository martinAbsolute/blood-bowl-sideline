// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { SidebarAccountMenu } from "../src/components/sidebar-account-menu";
import { TooltipProvider } from "../src/components/ui/tooltip";
import en from "../src/i18n/en.json";

vi.mock("gt-next", () => ({
  useTranslations: () => (key: string) => en[key as keyof typeof en],
}));
let root: Root, container: HTMLDivElement;
const user = {
  name: "Test Coach",
  email: "coach@example.test",
  image: null,
  role: "user" as const,
};
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});
it.each([
  { collapsed: false, mobile: false },
  { collapsed: true, mobile: false },
  { collapsed: false, mobile: true },
])(
  "keeps account details and sign-out accessible when collapsed=$collapsed, mobile=$mobile",
  async ({ collapsed, mobile }) => {
    const onSignOut = vi.fn();
    await act(async () =>
      root.render(
        createElement(
          TooltipProvider,
          null,
          createElement(SidebarAccountMenu, {
            user,
            collapsed,
            mobile,
            signingOut: false,
            onSignOut,
          }),
        ),
      ),
    );
    const trigger = container.querySelector<HTMLButtonElement>("button")!;
    expect(trigger.getAttribute("aria-label")).toBe(
      "Account menu · Test Coach",
    );
    expect(trigger.querySelector('[data-slot="avatar"]')).not.toBeNull();
    await act(async () => trigger.click());
    const menu = document.querySelector('[role="menu"]')!;
    expect(menu.textContent).toContain(user.name);
    expect(menu.textContent).toContain(user.email);
    const item = menu.querySelector<HTMLElement>('[role="menuitem"]')!;
    expect(item.textContent).toBe(en.signOut);
    await act(async () => item.click());
    expect(onSignOut).toHaveBeenCalledOnce();
  },
);

it("preserves keyboard focus on the account button when the sidebar collapses", async () => {
  const onSignOut = vi.fn();
  function render(collapsed: boolean) {
    return createElement(
      TooltipProvider,
      null,
      createElement(SidebarAccountMenu, {
        user,
        collapsed,
        signingOut: false,
        onSignOut,
      }),
    );
  }
  await act(async () => root.render(render(false)));
  const trigger = container.querySelector<HTMLButtonElement>("button")!;
  await act(async () => trigger.focus());
  await act(async () => root.render(render(true)));
  expect(document.activeElement).toBe(trigger);
  expect(container.querySelector("button")).toBe(trigger);
});
