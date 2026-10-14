import type { useTranslations } from "next-intl";

export type MessageKey = Parameters<
  ReturnType<typeof useTranslations<never>>
>[0];
export type Translate = (key: MessageKey) => string;
