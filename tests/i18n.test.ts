import { beforeEach, describe, expect, it, vi } from "vitest";
import { createFormatter } from "next-intl";
import { defaultLocale, formats, localeCookie, timeZone } from "../src/i18n/config";
import en from "../src/i18n/en.json";
import uk from "../src/i18n/uk.json";

const state = vi.hoisted(() => ({ cookie: undefined as string | undefined, set: vi.fn() }));
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (name === "bbs_locale" ? { value: state.cookie } : undefined),
    set: state.set,
  }),
}));
vi.mock("next-intl/server", () => ({ getRequestConfig: (fn: unknown) => fn }));
import requestConfig from "../src/i18n/request";
import { setLocale } from "../src/i18n/actions";

beforeEach(() => {
  state.cookie = undefined;
  state.set.mockReset();
});

describe("locale preferences", () => {
  it.each([undefined, "en", "uk", "ru", "../../invalid"])(
    "loads only supported messages for cookie %s",
    async (cookie) => {
      state.cookie = cookie;
      const config = await requestConfig({ requestLocale: Promise.resolve(undefined) });
      const locale = cookie === "uk" ? "uk" : defaultLocale;
      expect(config.locale).toBe(locale);
      expect(config.messages).toEqual(locale === "uk" ? uk : en);
      expect(config.timeZone).toBe(timeZone);
      expect(config.formats).toEqual(formats);
    },
  );
  it("honors an explicit locale for server translations", async () => {
    state.cookie = "uk";
    expect((await requestConfig({ locale: "en", requestLocale: Promise.resolve(undefined) })).locale).toBe("en");
  });
  it("persists language changes in the existing cookie", async () => {
    await setLocale("uk");
    expect(state.set).toHaveBeenCalledWith(
      localeCookie,
      "uk",
      expect.objectContaining({ path: "/", sameSite: "lax", httpOnly: true, maxAge: 31_536_000 }),
    );
  });
  it("rejects unsupported locale writes", async () => {
    // @ts-expect-error Server actions must also reject untyped input.
    await expect(setLocale("ru")).rejects.toThrow("Unsupported locale");
    expect(state.set).not.toHaveBeenCalled();
  });
});

it("formats dates and money consistently across server and client locales", () => {
  const english = createFormatter({ locale: "en", timeZone, formats });
  const ukrainian = createFormatter({ locale: "uk", timeZone, formats });
  const instant = new Date("2026-10-14T23:00:00Z");
  expect(english.dateTime(instant, "medium")).toBe("Oct 15, 2026");
  expect(ukrainian.dateTime(instant, "medium")).toContain("15 жовт.");
  expect(english.number(1234.5, "gold")).toBe("1,234.5");
  expect(ukrainian.number(1234.5, "gold")).toBe("1 234,5");
});
