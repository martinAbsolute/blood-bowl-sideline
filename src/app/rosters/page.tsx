import { BuilderStart } from "@/components/builder-start";
import { TeamCatalog } from "@/components/team-catalog";
export const metadata = { title: "Rosters" };
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ roster?: string; draft?: string; new?: string }>;
}) {
  const params = await searchParams;
  return params.roster || params.draft || params.new === "1" ? (
    <BuilderStart
      roster={params.roster}
      draft={params.draft}
      fresh={params.new === "1"}
    />
  ) : (
    <TeamCatalog />
  );
}
