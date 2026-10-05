// @vitest-environment happy-dom
import {
  act,
  createElement,
  useState,
  type InputHTMLAttributes,
  type ButtonHTMLAttributes,
} from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import { LeagueNumber } from "../src/components/league-number";

vi.mock("gt-next", () => ({
  useTranslations: () => (key: string, args: { name: string }) =>
    `${key} ${args.name}`,
}));
vi.mock("../src/components/ui/input", () => ({
  Input: (props: InputHTMLAttributes<HTMLInputElement>) =>
    createElement("input", { ...props, onInput: props.onChange }),
}));
vi.mock("../src/components/ui/button", () => ({
  Button: ({
    variant: _variant,
    ...props
  }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: string }) => {
    void _variant;
    return createElement("button", props);
  },
}));

it("allows clearing and replacing a number without sending a spurious zero or invalid value", async () => {
  const changes = vi.fn();
  function Test() {
    const [value, setValue] = useState(12);
    return createElement(LeagueNumber, {
      label: "Touchdowns",
      value,
      max: 30,
      onChange: (next) => {
        changes(next);
        setValue(next);
      },
    });
  }
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  try {
    await act(async () => root.render(createElement(Test)));
    const input = container.querySelector("input")!;
    const type = async (value: string) =>
      act(async () => {
        input.value = value;
        input.dispatchEvent(new Event("input", { bubbles: true }));
      });
    await type("");
    expect(input.value).toBe("");
    expect(changes).not.toHaveBeenCalled();
    await type("3");
    expect(changes).toHaveBeenLastCalledWith(3);
    await type("31");
    await type("-1");
    await type("1.5");
    expect(changes).toHaveBeenCalledTimes(1);
    await type("0");
    expect(changes).toHaveBeenLastCalledWith(0);
    expect(container.querySelectorAll("button")[0].disabled).toBe(true);
    await act(async () => container.querySelectorAll("button")[1].click());
    expect(input.value).toBe("1");
    await type("30");
    expect(container.querySelectorAll("button")[1].disabled).toBe(true);
    await act(async () =>
      input.dispatchEvent(
        new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }),
      ),
    );
    expect(input.value).toBe("29");
    await type("");
    await act(async () =>
      input.dispatchEvent(new FocusEvent("focusout", { bubbles: true })),
    );
    expect(input.value).toBe("29");
  } finally {
    await act(async () => root.unmount());
    container.remove();
  }
});
