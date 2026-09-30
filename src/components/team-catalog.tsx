"use client";
import { useTranslations } from "gt-next";
import { rosters } from "@/domain/catalog";
import { RosterExplorer } from "./roster-explorer";
export function TeamCatalog() {
  const t = useTranslations();
  return (
    <div className="page-width py-6">
      <div className="mb-5 flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <h1 className="display-font text-3xl">{t("teams")}</h1>
        <span className="ml-auto text-xs font-medium text-muted-foreground">
          BB2025 · {rosters.length}
        </span>
      </div>
      <RosterExplorer />
    </div>
  );
}
