import type { ConvexReactClient } from "convex/react";
import type { Id } from "../../convex/_generated/dataModel";
import { api } from "../../convex/_generated/api";

const lifetime = 15_000;

// Use the same client as useQuery so prefetched results stay reactive and
// authentication changes are handled by Convex, rather than a separate cache.
export function createNavigationPrewarmer(client: ConvexReactClient) {
  const warmed = new Map<string, number>();
  return (url: URL, authenticated: boolean) => {
    const path = url.pathname;
    const now = Date.now();
    const key = `${authenticated}:${path}`;
    if (now - (warmed.get(key) ?? -Infinity) < lifetime) return;
    const team = path.match(/^\/teams\/([\da-f-]{36})\/?$/i);
    const league = path.match(
      /^\/leagues\/manage\/([^/]+)(?:\/(teams|matches)\/([^/]+))?\/?$/,
    );
    if (!team && (!league || !authenticated)) return;
    warmed.set(key, now);
    for (const [key, time] of warmed)
      if (now - time >= lifetime || warmed.size > 32) warmed.delete(key);
    if (team) {
      client.prewarmQuery({
        query: api.teams.getByUuid,
        args: { uuid: team[1] },
        extendSubscriptionFor: lifetime,
      });
    } else if (league?.[2] === "teams") {
      client.prewarmQuery({
        query: api.leagues.getCareer,
        args: { entryId: league[3] as Id<"leagueTeams"> },
        extendSubscriptionFor: lifetime,
      });
    } else if (league?.[2] === "matches") {
      client.prewarmQuery({
        query: api.leagues.getMatch,
        args: { matchId: league[3] as Id<"leagueMatches"> },
        extendSubscriptionFor: lifetime,
      });
    } else if (league) {
      client.prewarmQuery({
        query: api.leagues.get,
        args: { leagueId: league[1] as Id<"leagues"> },
        extendSubscriptionFor: lifetime,
      });
    }
  };
}
