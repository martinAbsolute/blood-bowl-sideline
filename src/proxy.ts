import { fetchQuery } from "convex/nextjs";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { api } from "../convex/_generated/api";

// Resolve archived UUIDs before Next streams the shared team page. Device-only
// UUIDs continue to the client editor because a missing cloud team isn't archived.
export async function proxy(request: NextRequest) {
  const uuid = request.nextUrl.pathname.split("/")[2];
  const validUuid = z.uuid().safeParse(uuid).success;
  // Text-only clients cannot reveal React's streamed Suspense containers.
  // Keep browser navigation/RSC requests on the interactive page, and serve
  // the same public roster as a complete semantic document to web readers.
  const reader =
    /bot\b|crawler|spider|ChatGPT-User|Claude-User|Perplexity-User|curl\/|Wget\/|python-requests\/|^node$/i;
  if (
    validUuid &&
    ["GET", "HEAD"].includes(request.method) &&
    !request.headers.has("rsc") &&
    !request.headers.has("next-router-prefetch") &&
    reader.test(request.headers.get("user-agent") ?? "")
  ) {
    const response = NextResponse.rewrite(
      new URL(`/teams/${uuid}/roster`, request.url),
    );
    response.headers.set("Cache-Control", "no-store");
    response.headers.set("Vary", "User-Agent");
    return response;
  }
  if (validUuid && (await fetchQuery(api.teams.isArchived, { uuid }))) {
    const response = NextResponse.rewrite(new URL("/404", request.url), {
      status: 404,
    });
    response.headers.set("Cache-Control", "no-store");
    return response;
  }
  return NextResponse.next();
}

export const config = { matcher: "/teams/:slug" };
