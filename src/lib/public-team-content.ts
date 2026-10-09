import { cache } from "react";
import { fetchQuery } from "convex/nextjs";
import { connection } from "next/server";
import { api } from "../../convex/_generated/api";

// Share metadata and structured data use one anonymous snapshot per request.
// Never pass an auth token or reuse this result for editor permissions.
export const publicTeamContent = cache(async (uuid: string) => {
  await connection();
  try {
    return await fetchQuery(api.teams.getByUuid, { uuid });
  } catch {
    // Keep device-only drafts and the client retry path available during outages.
    return null;
  }
});
