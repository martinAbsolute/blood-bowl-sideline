import { Suspense } from "react";
import { LeagueGate } from "@/components/league-ui";
import { LeagueWorkspace } from "@/components/league-workspace";
import { pageMetadata } from "@/lib/site-metadata";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ leagueId: string }>;
}) {
  const { leagueId } = await params;
  return pageMetadata(
    "League",
    `/leagues/manage/${leagueId}`,
    "League fixtures, standings and team development.",
  );
}

async function LeagueContent({
  params,
}: {
  params: Promise<{ leagueId: string }>;
}) {
  const { leagueId } = await params;
  return <LeagueWorkspace leagueId={leagueId} />;
}

export default function Page({
  params,
}: {
  params: Promise<{ leagueId: string }>;
}) {
  return (
    <Suspense fallback={<LeagueGate authenticated loading />}>
      <LeagueContent params={params} />
    </Suspense>
  );
}
