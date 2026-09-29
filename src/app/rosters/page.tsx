import { RosterExplorer } from "@/components/roster-explorer";
import { getTranslations } from "gt-next/server";
export const metadata = { title: "Rosters" };
export default async function Page() {
  const t = await getTranslations();
  return (
    <div className="page-width py-12">
      <p className="eyebrow">BB2025</p>
      <h1 className="display-font mt-2 text-5xl text-primary">
        {t("rosterCount")}
      </h1>
      <p className="mb-8 mt-3 text-muted-foreground">{t("rosterIntro")}</p>
      <RosterExplorer />
    </div>
  );
}
