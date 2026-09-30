import { notFound } from "next/navigation";
import { getRoster, rosters } from "@/domain/catalog";
import { TeamReference } from "@/components/team-reference";
export function generateStaticParams() {
  return rosters.map((roster) => ({ "team-name": roster.id }));
}
export async function generateMetadata({
  params,
}: {
  params: Promise<{ "team-name": string }>;
}) {
  const roster = getRoster((await params)["team-name"]);
  return { title: roster ? `${roster.name} · BB2025` : "Team not found" };
}
export default async function Page({
  params,
}: {
  params: Promise<{ "team-name": string }>;
}) {
  const roster = getRoster((await params)["team-name"]);
  if (!roster) notFound();
  return <TeamReference roster={roster} />;
}
