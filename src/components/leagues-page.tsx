"use client";

import { useTranslations } from "gt-next";
import { Flag } from "lucide-react";

export function LeaguesPage() {
  const t = useTranslations();
  return (
    <div className="page-width py-8 sm:py-10">
      <h1 className="page-heading">{t("leagues")}</h1>
      <div className="mt-7 rounded-xl border border-dashed bg-card/60 px-6 py-16 text-center">
        <Flag
          aria-hidden="true"
          className="mx-auto mb-4 size-8 text-muted-foreground"
        />
        <p className="font-medium">{t("noLeagues")}</p>
        <p className="mt-2 text-sm text-muted-foreground">{t("leaguesHint")}</p>
      </div>
    </div>
  );
}
