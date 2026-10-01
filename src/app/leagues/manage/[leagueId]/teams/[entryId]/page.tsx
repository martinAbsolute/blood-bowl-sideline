import { Suspense } from "react";
import { LeagueGate } from "@/components/league-ui";
import { LeagueCareer } from "@/components/league-career";
import { pageMetadata } from "@/lib/site-metadata";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ leagueId: string; entryId: string }>;
}) {
  const { leagueId, entryId } = await params;
  return pageMetadata(
    "League team",
    `/leagues/manage/${leagueId}/teams/${entryId}`,
    "Official league roster, player SPP and team history.",
  );
}

async function LeagueContent({
  params,
}: {
  params: Promise<{ leagueId: string; entryId: string }>;
}) {
  const { leagueId, entryId } = await params;
  return <LeagueCareer leagueId={leagueId} entryId={entryId} />;
}

export default function Page({
  params,
}: {
  params: Promise<{ leagueId: string; entryId: string }>;
}) {
  return (
    <Suspense fallback={<LeagueGate authenticated loading />}>
      <LeagueContent params={params} />
    </Suspense>
  );
}
