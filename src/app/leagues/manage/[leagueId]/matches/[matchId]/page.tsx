import { Suspense } from "react";
import { LeagueGate } from "@/components/league-ui";
import { LeagueMatch } from "@/components/league-match";
import { pageMetadata } from "@/lib/site-metadata";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ leagueId: string; matchId: string }>;
}) {
  const { leagueId, matchId } = await params;
  return pageMetadata(
    "Match report",
    `/leagues/manage/${leagueId}/matches/${matchId}`,
    "Shared league match report and player statistics.",
  );
}

async function LeagueContent({
  params,
}: {
  params: Promise<{ leagueId: string; matchId: string }>;
}) {
  const { leagueId, matchId } = await params;
  return <LeagueMatch leagueId={leagueId} matchId={matchId} />;
}

export default function Page({
  params,
}: {
  params: Promise<{ leagueId: string; matchId: string }>;
}) {
  return (
    <Suspense fallback={<LeagueGate authenticated loading />}>
      <LeagueContent params={params} />
    </Suspense>
  );
}
