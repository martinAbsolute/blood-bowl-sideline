import { notFound } from "next/navigation";
import { z } from "zod";
import { TeamPage } from "@/components/team-page";
import { pageMetadata } from "@/lib/site-metadata";
import { publicTeamContent } from "@/lib/public-team-content";
import { serializeTeamStructuredData } from "@/lib/team-structured-data";
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  if (!z.uuid().safeParse(slug).success) notFound();
  const data = await publicTeamContent(slug);
  const metadata = pageMetadata(
    data?.team.name.trim() || "Shared Blood Bowl Team",
    `/teams/${slug}`,
    "View a shared Blood Bowl roster, player advancements and team costs on Blood Bowl Sideline.",
  );
  return {
    ...metadata,
    alternates: {
      ...metadata.alternates,
      types: { "text/html": `/teams/${slug}/roster` },
    },
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
  const data = await publicTeamContent(slug);
  return (
    <>
      {data && (
        <script
          id="team-structured-data"
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: serializeTeamStructuredData(data),
          }}
        />
      )}
      <TeamPage uuid={slug} initial={data} />
    </>
  );
}
