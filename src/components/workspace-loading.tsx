"use client";
import { useTranslations } from "gt-next";
import { LoaderCircle } from "lucide-react";

export function WorkspaceLoading() {
  const t = useTranslations();
  return (
    <div className="page-width min-h-[70vh] py-8">
      <div
        className="flex min-h-80 items-center justify-center rounded-xl border bg-card/50 text-sm text-muted-foreground"
        role="status"
      >
        <LoaderCircle className="mr-2 size-4 animate-spin" />
        {t("loading")}
      </div>
    </div>
  );
}
