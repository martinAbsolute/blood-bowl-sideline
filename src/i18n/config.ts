import type { Formats } from "next-intl";

export const locales = ["en", "uk"] as const;
export type AppLocale = (typeof locales)[number];
export const defaultLocale: AppLocale = "en";
export const localeCookie = "bbs_locale";
export const timeZone = "Europe/Kyiv";

export const formats = {
  dateTime: {
    short: { day: "2-digit", month: "2-digit", year: "numeric" },
    medium: { day: "numeric", month: "short", year: "numeric" },
    long: { day: "numeric", month: "long", year: "numeric" },
    dateTime: {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    },
    time: { hour: "2-digit", minute: "2-digit", hourCycle: "h23" },
  },
  number: {
    integer: { maximumFractionDigits: 0 },
    gold: { maximumFractionDigits: 3 },
  },
} satisfies Formats;
