"use client";
import { useTranslations } from "gt-next";
import { Button } from "@/components/ui/button";
export default function ErrorPage({
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  const t = useTranslations();
  return (
    <div className="page-width py-24">
      <h1 className="display-font text-5xl">{t("errorTitle")}</h1>
      <p className="mt-4 text-muted-foreground">{t("errorHint")}</p>
      <Button className="mt-8" onClick={reset}>
        {t("retry")}
      </Button>
    </div>
  );
}
