"use client";
import { useTranslations } from "gt-next";
import { RosterExplorer } from "./roster-explorer";
export function TeamCatalog() {
  const t = useTranslations();
  return (
    <div className="page-width py-8 sm:py-10">
      <div className="mb-5">
        <h1 className="page-heading">{t("rosters")}</h1>
      </div>
      <RosterExplorer />
    </div>
  );
}
