import { BuilderStart } from "@/components/builder-start";
import { TeamCatalog } from "@/components/team-catalog";
import { Suspense } from "react";
import { WorkspaceLoading } from "@/components/workspace-loading";
import { pageMetadata } from "@/lib/site-metadata";
export const metadata = pageMetadata(
  "BB2025 Rosters & Players",
  "/rosters",
  "Explore all 31 Blood Bowl rosters: player stats, skills, star players and team costs. Choose your roster and build a team for your next game.",
);
export default function Page(props: {
  searchParams: Promise<{ roster?: string; draft?: string; new?: string }>;
}) {
  return (
    <Suspense fallback={<WorkspaceLoading variant="catalog" />}>
      <RosterPage {...props} />
    </Suspense>
  );
}
async function RosterPage({
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
