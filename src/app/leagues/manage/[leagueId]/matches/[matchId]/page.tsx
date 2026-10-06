import { Suspense } from "react";
import { LeagueGate } from "@/components/league-ui";
import { LeagueMatch } from "@/components/league-match";
import { contentMetadata } from "@/lib/content-metadata";
import { api } from "../../../../../../../convex/_generated/api";
import type { Id } from "../../../../../../../convex/_generated/dataModel";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ leagueId: string; matchId: string }>;
}) {
  const { leagueId, matchId } = await params;
  return contentMetadata(
    api.leagues.getMatch,
    { matchId: matchId as Id<"leagueMatches"> },
    `/leagues/manage/${leagueId}/matches/${matchId}`,
    "Match report",
    "Shared league match report and player statistics.",
    (data) =>
      String(data.league._id) === leagueId
        ? `${data.home.team.name} vs ${data.away?.team.name ?? "Bye"} · ${data.league.name}`
        : undefined,
  );
}

async function LeagueContent({
  params,
}: {
  params: Promise<{ leagueId: string; matchId: string }>;
}) {
  const { leagueId, matchId } = await params;
  return <LeagueMatch key={matchId} leagueId={leagueId} matchId={matchId} />;
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
