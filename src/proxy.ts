import { fetchQuery } from "convex/nextjs";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { api } from "../convex/_generated/api";

// Resolve archived UUIDs before Next streams the shared team page. Device-only
// UUIDs continue to the client editor because a missing cloud team isn't archived.
export async function proxy(request: NextRequest) {
  const uuid = request.nextUrl.pathname.split("/")[2];
  if (
    z.uuid().safeParse(uuid).success &&
    (await fetchQuery(api.teams.isArchived, { uuid }))
  ) {
    const response = NextResponse.rewrite(new URL("/404", request.url), {
      status: 404,
    });
    response.headers.set("Cache-Control", "no-store");
    return response;
  }
  return NextResponse.next();
}

export const config = { matcher: "/teams/:slug" };
