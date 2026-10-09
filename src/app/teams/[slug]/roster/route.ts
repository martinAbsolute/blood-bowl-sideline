import { fetchQuery } from "convex/nextjs";
import { z } from "zod";
import { api } from "../../../../../convex/_generated/api";
import { teamReaderHtml } from "@/lib/team-reader-html";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const headers = {
    "Content-Type": "text/html; charset=utf-8",
    "Cache-Control": "no-store",
    Vary: "User-Agent",
    "X-Robots-Tag": "noindex, nofollow",
  };
  if (!z.uuid().safeParse(slug).success)
    return new Response("Team not found", { status: 404, headers });
  let data;
  try {
    // The reader representation always uses the anonymous public query.
    data = await fetchQuery(api.teams.getByUuid, { uuid: slug });
  } catch {
    return new Response("Team temporarily unavailable. Please try again.", {
      status: 503,
      headers,
    });
  }
  if (!data) return new Response("Team not found", { status: 404, headers });
  return new Response(teamReaderHtml(data), { headers });
}
