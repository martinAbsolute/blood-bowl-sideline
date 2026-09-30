import { notFound } from "next/navigation";
import { LeagueReference } from "@/components/league-reference";
import { leagues, leagueSlug } from "@/domain/team-reference";
import { pageMetadata } from "@/lib/site-metadata";

export function generateStaticParams() {
  return leagues.map((name) => ({ league: leagueSlug(name) }));
}
export async function generateMetadata({
  params,
}: {
  params: Promise<{ league: string }>;
}) {
  const { league } = await params;
  const name = leagues.find((name) => leagueSlug(name) === league);
  return name
    ? pageMetadata(
        name,
        `/leagues/${league}`,
        `Explore ${name} in Blood Bowl: affiliated BB2025 rosters, eligible star players, stats and skills. Find the right players for your team.`,
      )
    : {};
}
export default async function Page({
  params,
}: {
  params: Promise<{ league: string }>;
}) {
  const { league } = await params;
  const name = leagues.find((name) => leagueSlug(name) === league);
  if (!name) notFound();
  return <LeagueReference name={name} />;
}
