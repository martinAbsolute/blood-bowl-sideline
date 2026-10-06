import { fetchQuery } from "convex/nextjs";
import { connection } from "next/server";
import type { FunctionArgs, FunctionReference } from "convex/server";
import { pageMetadata } from "./site-metadata";

// Sharing metadata uses only the query's public, anonymous view. Never cache
// viewer permissions or reuse this response for the authenticated editor.
export async function contentMetadata<Query extends FunctionReference<"query">>(
  query: Query,
  args: FunctionArgs<Query>,
  path: string,
  fallback: string,
  description: string,
  title: (data: Query["_returnType"]) => string | undefined,
) {
  // Convex's transport uses request-specific randomness; keep it out of
  // prerendering and let Next's request boundary propagate instead of catching it.
  await connection();
  let name: string | undefined;
  try {
    name = title(await fetchQuery(query, args));
  } catch {
    // Missing content, invalid IDs, or an unavailable backend still get useful
    // metadata, and do not prevent the client from loading/retrying the page.
  }
  return pageMetadata(name?.trim() || fallback, path, description);
}
