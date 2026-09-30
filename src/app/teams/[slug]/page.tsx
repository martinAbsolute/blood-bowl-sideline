import { notFound } from "next/navigation";
import { z } from "zod";
import { TeamPage } from "@/components/team-page";
import { Suspense } from "react";
import { WorkspaceLoading } from "@/components/workspace-loading";
import { pageMetadata } from "@/lib/site-metadata";
export const metadata = {
  ...pageMetadata(
    "Shared Blood Bowl Team",
    undefined,
    "View a shared Blood Bowl roster, player advancements and team costs on Blood Bowl Sideline.",
  ),
  robots: { index: false, follow: false },
};
export default function Page(props: { params: Promise<{ slug: string }> }) {
  return (
    <Suspense fallback={<WorkspaceLoading variant="editor" />}>
      <UuidPage {...props} />
    </Suspense>
  );
}
async function UuidPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!z.uuid().safeParse(slug).success) notFound();
  return <TeamPage uuid={slug} />;
}
