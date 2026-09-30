import { permanentRedirect, notFound } from "next/navigation";
import { getRoster } from "@/domain/catalog";
export default async function Page({
  params,
}: {
  params: Promise<{ "team-name": string }>;
}) {
  const roster = getRoster((await params)["team-name"]);
  if (!roster) notFound();
  permanentRedirect(`/rosters/${roster.id}`);
}
