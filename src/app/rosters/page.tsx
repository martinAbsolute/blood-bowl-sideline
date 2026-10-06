import { BuilderStart } from "@/components/builder-start";
import { TeamCatalog } from "@/components/team-catalog";
import { pageMetadata } from "@/lib/site-metadata";
import { rosterRuleset } from "@/lib/roster-ruleset";
export const metadata = pageMetadata(
  "BB2025 Rosters & Players",
  "/rosters",
  "Explore all 31 Blood Bowl rosters: player stats, skills, star players and team costs. Choose your roster and build a team for your next game.",
);
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{
    roster?: string;
    draft?: string;
    new?: string;
    ruleset?: string | string[];
  }>;
}) {
  const params = await searchParams;
  return params.roster || params.draft || params.new === "1" ? (
    <BuilderStart
      roster={params.roster}
      draft={params.draft}
      fresh={params.new === "1"}
    />
  ) : (
    <TeamCatalog rulesetId={rosterRuleset(params.ruleset)} />
  );
}
