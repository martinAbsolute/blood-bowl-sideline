import { notFound } from "next/navigation";
import { z } from "zod";
import { TeamPage } from "@/components/team-page";
import { contentMetadata } from "@/lib/content-metadata";
import { api } from "../../../../convex/_generated/api";
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  if (!z.uuid().safeParse(slug).success) notFound();
  const metadata = await contentMetadata(
    api.teams.getByUuid,
    { uuid: slug },
    `/teams/${slug}`,
    "Shared Blood Bowl Team",
    "View a shared Blood Bowl roster, player advancements and team costs on Blood Bowl Sideline.",
    (data) => data?.team.name,
  );
  return {
    ...metadata,
    robots: { index: false, follow: false },
  };
}
export default async function Page({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  if (!z.uuid().safeParse(slug).success) notFound();
  return <TeamPage uuid={slug} />;
}
