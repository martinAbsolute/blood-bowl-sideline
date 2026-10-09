import { fetchQuery } from "convex/nextjs";
import { z } from "zod";
import { api } from "../../../../../convex/_generated/api";
import { teamReaderHtml } from "@/lib/team-reader-html";
import { teamStructuredData } from "@/lib/team-structured-data";
import { prefersTeamJsonLd } from "@/lib/team-representation";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const headers = {
    "Content-Type": "text/plain; charset=utf-8",
    "Cache-Control": "no-store",
    Vary: "Accept, User-Agent",
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
  if (prefersTeamJsonLd(request.headers.get("accept") ?? "")) {
    return Response.json(teamStructuredData(data), {
      headers: {
        ...headers,
        "Content-Type": "application/ld+json; charset=utf-8",
      },
    });
  }
  return new Response(teamReaderHtml(data), {
    headers: { ...headers, "Content-Type": "text/html; charset=utf-8" },
  });
}
