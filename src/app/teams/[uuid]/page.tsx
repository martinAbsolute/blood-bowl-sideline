import { fetchQuery } from "convex/nextjs";
import { cache } from "react";
import { notFound } from "next/navigation";
import { api } from "../../../../convex/_generated/api";
import { SharedTeam } from "@/components/shared-team";
import { z } from "zod";
export const dynamic = "force-dynamic";
const getTeam = cache(async (uuid: string) =>
  z.uuid().safeParse(uuid).success
    ? fetchQuery(api.teams.getByUuid, { uuid })
    : null,
);
export async function generateMetadata({
  params,
}: {
  params: Promise<{ uuid: string }>;
}) {
  const data = await getTeam((await params).uuid);
  return {
    title: data
      ? `${data.team.name} · Blood Bowl Sideline`
      : "Team not found · Blood Bowl Sideline",
    description: data
      ? `A ${data.team.rosterId} roster on Blood Bowl Sideline.`
      : undefined,
    robots: { index: false, follow: false },
  };
}
export default async function Page({
  params,
}: {
  params: Promise<{ uuid: string }>;
}) {
  const data = await getTeam((await params).uuid);
  if (!data) notFound();
  return <SharedTeam initial={data} />;
}
