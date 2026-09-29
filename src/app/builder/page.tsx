import { BuilderStart } from "@/components/builder-start";
export const metadata = { title: "Team builder" };
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ roster?: string; draft?: string; new?: string }>;
}) {
  const params = await searchParams;
  return (
    <BuilderStart
      roster={params.roster}
      draft={params.draft}
      fresh={params.new === "1"}
    />
  );
}
