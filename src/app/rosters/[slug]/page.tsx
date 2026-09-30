import { notFound } from "next/navigation";
import { getRoster } from "@/domain/catalog";
import { TeamReference } from "@/components/team-reference";
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const roster = getRoster((await params).slug);
  return roster
    ? {
        title: `${roster.name} · BB2025`,
        alternates: { canonical: `/rosters/${roster.id}` },
      }
    : {};
}
export default async function Page({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const roster = getRoster((await params).slug);
  if (!roster) notFound();
  return <TeamReference roster={roster} />;
}
