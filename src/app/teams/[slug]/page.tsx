import { notFound } from "next/navigation";
import { z } from "zod";
import { TeamPage } from "@/components/team-page";
export const metadata = {
  title: "Team",
  robots: { index: false, follow: false },
};
export default async function Page({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  if (!z.uuid().safeParse(slug).success) notFound();
  return <TeamPage uuid={slug} />;
}
