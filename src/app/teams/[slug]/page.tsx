import { notFound } from "next/navigation";
import { z } from "zod";
import { TeamPage } from "@/components/team-page";
import { Suspense } from "react";
import { WorkspaceLoading } from "@/components/workspace-loading";
export const metadata = {
  title: "Team",
  robots: { index: false, follow: false },
};
export default function Page(props: { params: Promise<{ slug: string }> }) {
  return (
    <Suspense fallback={<WorkspaceLoading />}>
      <UuidPage {...props} />
    </Suspense>
  );
}
async function UuidPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!z.uuid().safeParse(slug).success) notFound();
  return <TeamPage uuid={slug} />;
}
