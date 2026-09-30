"use client";
import { useTranslations } from "gt-next";
import { LoadingLayout, type LoadingVariant } from "./loading-layouts";

export function WorkspaceLoading({
  variant = "library",
}: {
  variant?: LoadingVariant;
}) {
  const t = useTranslations();
  return <LoadingLayout variant={variant} label={t("loading")} />;
}
