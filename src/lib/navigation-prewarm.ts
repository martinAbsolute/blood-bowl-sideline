import type { ConvexReactClient } from "convex/react";
import type { Id } from "../../convex/_generated/dataModel";
import { api } from "../../convex/_generated/api";

const lifetime = 60_000;

// Use the same client as useQuery so prefetched results stay reactive and
// authentication changes are handled by Convex, rather than a separate cache.
export function createNavigationPrewarmer(
  client: ConvexReactClient,
  prefetch: (href: string, onInvalidate: () => void) => void,
) {
  const warmed = new Map<string, number>();
  const pending = new Set<() => void>();
  const warm = (url: URL, authenticated: boolean) => {
    const path = url.pathname;
    const now = Date.now();
    const key = `${authenticated}:${path}${url.search}`;
    if (now - (warmed.get(key) ?? -Infinity) < lifetime) return;
    const team = path.match(/^\/teams\/([\da-f-]{36})\/?$/i);
    const league = path.match(
      /^\/leagues\/manage\/([^/]+)(?:\/(teams|matches)\/([^/]+))?\/?$/,
    );
    if (!team && (!league || !authenticated)) return;
    warmed.set(key, now);
    prefetch(`${path}${url.search}`, () => warmed.delete(key));
    for (const [key, time] of warmed)
      if (now - time >= lifetime || warmed.size > 32) warmed.delete(key);
    if (team) {
      client.prewarmQuery({
        query: api.teams.getByUuid,
        args: { uuid: team[1] },
        extendSubscriptionFor: lifetime,
      });
      client.prewarmQuery({
        query: api.leagues.listTeamCareers,
        args: { teamUuid: team[1] },
        extendSubscriptionFor: lifetime,
      });
      if (authenticated) {
        const requestedLeague = url.searchParams.get("league");
        const leagues = new Set<string>();
        const warmLeague = (leagueId: string | undefined) => {
          if (!leagueId || leagues.has(leagueId)) return;
          leagues.add(leagueId);
          client.prewarmQuery({
            query: api.leagues.get,
            args: { leagueId: leagueId as Id<"leagues"> },
            extendSubscriptionFor: lifetime,
          });
        };
        if (requestedLeague) warmLeague(requestedLeague);
        else {
          // Start the dependent query as soon as the team arrives, before
          // TeamPage mounts and gates its editor on the league context.
          const watch = client.watchQuery(api.teams.getByUuid, {
            uuid: team[1],
          });
          const onUpdate = () => {
            try {
              warmLeague(watch.localQueryResult()?.draftLeagueId);
            } catch {
              // Speculative errors are handled by the destination's useQuery.
            }
          };
          const unsubscribe = watch.onUpdate(onUpdate);
          const dispose = () => {
            clearTimeout(timer);
            unsubscribe();
            pending.delete(dispose);
          };
          const timer = setTimeout(dispose, lifetime);
          pending.add(dispose);
          if (pending.size > 32) pending.values().next().value?.();
          onUpdate();
        }
      }
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
      client.prewarmQuery({
        query: api.leagues.getMatchHistory,
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
  warm.dispose = () => {
    for (const dispose of pending) dispose();
    warmed.clear();
  };
  return warm;
}
