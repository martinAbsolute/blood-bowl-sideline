import { redirect } from "next/navigation";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const params = await searchParams;
  const { draft, ...rest } = params;
  const query = new URLSearchParams(rest).toString();
  redirect(
    `${draft ? `/teams/${draft}` : "/rosters"}${query ? `?${query}` : ""}`,
  );
}
