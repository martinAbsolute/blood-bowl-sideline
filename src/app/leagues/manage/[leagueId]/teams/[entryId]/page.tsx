import { LeagueCareer } from "@/components/league-career";
import { contentMetadata } from "@/lib/content-metadata";
import { api } from "../../../../../../../convex/_generated/api";
import type { Id } from "../../../../../../../convex/_generated/dataModel";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ leagueId: string; entryId: string }>;
}) {
  const { leagueId, entryId } = await params;
  return contentMetadata(
    api.leagues.getCareer,
    { entryId: entryId as Id<"leagueTeams"> },
    `/leagues/manage/${leagueId}/teams/${entryId}`,
    "League team",
    "Official league roster, player SPP and team history.",
    (data) =>
      String(data.league._id) === leagueId
        ? `${data.entry.team.name} · ${data.league.name}`
        : undefined,
  );
}

export default async function Page({
  params,
}: {
  params: Promise<{ leagueId: string; entryId: string }>;
}) {
  const { leagueId, entryId } = await params;
  return <LeagueCareer leagueId={leagueId} entryId={entryId} />;
}
