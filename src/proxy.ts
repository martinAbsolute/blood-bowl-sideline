import { fetchQuery } from "convex/nextjs";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { api } from "../convex/_generated/api";
import {
  prefersTeamJsonLd,
  teamReaderUserAgent,
} from "@/lib/team-representation";

// Resolve archived UUIDs before Next streams the shared team page. Device-only
// UUIDs continue to the client editor because a missing cloud team isn't archived.
export async function proxy(request: NextRequest) {
  const uuid = request.nextUrl.pathname.split("/")[2];
  const validUuid = z.uuid().safeParse(uuid).success;
  // Text-only clients cannot reveal React's streamed Suspense containers.
  // Keep browser navigation/RSC requests on the interactive page, and serve
  // the same public roster as a complete semantic document to web readers.
  const rosterUrl = new URL(`/teams/${uuid}/roster`, request.url);
  // Next.js can replace Vary with its RSC fields on page responses. Keep every
  // representation non-cacheable so browser HTML cannot be reused for a reader.
  const headers = validUuid
    ? {
        Vary: "Accept, User-Agent",
        "Cache-Control": "no-store",
        Link: `<${rosterUrl.href}>; rel="alternate"; type="text/html"; title="Complete saved roster", <${rosterUrl.href}>; rel="alternate"; type="application/ld+json"`,
      }
    : undefined;
  if (
    validUuid &&
    ["GET", "HEAD"].includes(request.method) &&
    !request.headers.has("rsc") &&
    !request.headers.has("next-router-prefetch") &&
    (prefersTeamJsonLd(request.headers.get("accept") ?? "") ||
      teamReaderUserAgent.test(request.headers.get("user-agent") ?? ""))
  ) {
    return NextResponse.rewrite(rosterUrl, { headers });
  }
  if (validUuid && (await fetchQuery(api.teams.isArchived, { uuid }))) {
    return NextResponse.rewrite(new URL("/404", request.url), {
      status: 404,
      headers,
    });
  }
  return NextResponse.next({ headers });
}

export const config = { matcher: "/teams/:slug" };
