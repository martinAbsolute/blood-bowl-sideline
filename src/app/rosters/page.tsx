import { BuilderStart } from "@/components/builder-start";
import { TeamCatalog } from "@/components/team-catalog";
import { Suspense } from "react";
import { WorkspaceLoading } from "@/components/workspace-loading";
export const metadata = { title: "Rosters" };
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
