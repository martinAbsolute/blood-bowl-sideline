import { cookies } from "next/headers";
import { hasLocale } from "next-intl";
import { getRequestConfig } from "next-intl/server";
import {
  defaultLocale,
  formats,
  localeCookie,
  locales,
  timeZone,
} from "./config";

const messageLoaders = {
  en: () => import("./en.json"),
  uk: () => import("./uk.json"),
};

export default getRequestConfig(async ({ locale: requestedLocale }) => {
  const candidate =
    requestedLocale ?? (await cookies()).get(localeCookie)?.value;
  const locale = hasLocale(locales, candidate) ? candidate : defaultLocale;
  return {
    locale,
    messages: (await messageLoaders[locale]()).default,
    formats,
    timeZone,
  };
});
