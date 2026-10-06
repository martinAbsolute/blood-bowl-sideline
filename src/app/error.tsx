"use client";
import { useTranslations } from "gt-next";
import { Button } from "@/components/ui/button";
import { PageStatus } from "@/components/page-status";
export default function ErrorPage({
  retry,
}: {
  error: Error;
  retry: () => void;
}) {
  const t = useTranslations();
  return (
    <PageStatus
      title={t("errorTitle")}
      description={t("errorHint")}
      action={<Button onClick={retry}>{t("retry")}</Button>}
    />
  );
}
