import { LeagueWorkspace } from "@/components/league-workspace";
import { contentMetadata } from "@/lib/content-metadata";
import { api } from "../../../../../convex/_generated/api";
import type { Id } from "../../../../../convex/_generated/dataModel";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ leagueId: string }>;
}) {
  const { leagueId } = await params;
  return contentMetadata(
    api.leagues.get,
    { leagueId: leagueId as Id<"leagues"> },
    `/leagues/manage/${leagueId}`,
    "League",
    "League fixtures, standings and team development.",
    (data) => data.league.name,
  );
}

export default async function Page({
  params,
}: {
  params: Promise<{ leagueId: string }>;
}) {
  const { leagueId } = await params;
  return <LeagueWorkspace leagueId={leagueId} />;
}
