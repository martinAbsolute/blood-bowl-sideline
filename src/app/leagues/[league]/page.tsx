import { notFound } from "next/navigation";
import { LeagueReference } from "@/components/league-reference";
import { leagues, leagueSlug } from "@/domain/team-reference";

export function generateStaticParams() {
  return leagues.map((name) => ({ league: leagueSlug(name) }));
}
export async function generateMetadata({
  params,
}: {
  params: Promise<{ league: string }>;
}) {
  const { league } = await params;
  return {
    title: leagues.find((name) => leagueSlug(name) === league) ?? "League",
  };
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
