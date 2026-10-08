import { notFound } from "next/navigation";
import { getRoster, rosters } from "@/domain/catalog";
import { TeamReference } from "@/components/team-reference";
import { pageMetadata } from "@/lib/site-metadata";
import { rosterRuleset } from "@/lib/roster-ruleset";
export function generateStaticParams() {
  return rosters.map(({ id }) => ({ slug: id }));
}
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const roster = getRoster((await params).slug);
  return roster
    ? pageMetadata(
        `${roster.name} Roster · BB2025`,
        `/rosters/${roster.id}`,
        `Build your ${roster.name} Blood Bowl team. Browse BB2025 player stats, skills, costs, eligible star players and special rules.`,
      )
    : {};
}
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ ruleset?: string | string[] }>;
}) {
  const [route, query] = await Promise.all([params, searchParams]);
  const roster = getRoster(route.slug);
  if (!roster) notFound();
  return (
    <TeamReference roster={roster} rulesetId={rosterRuleset(query.ruleset)} />
  );
}
