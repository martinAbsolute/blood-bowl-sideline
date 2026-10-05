"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation } from "convex/react";
import { useTranslations } from "gt-next";
import { ArrowRight, Trophy } from "lucide-react";
import type { Doc } from "../../convex/_generated/dataModel";
import { api } from "../../convex/_generated/api";
import type { Team } from "@/domain/types";
import { canEnrollTeam } from "@/lib/league-team-eligibility";
import { DEFAULT_LEAGUE_TREASURY } from "@/domain/league-rules";
import { Button } from "./ui/button";
import { LeagueTeamIssues } from "./league-team-issues";
import { LeagueError, useLeagueAction } from "./league-ui";

export function LeagueEnrollment({
  league,
  team,
  pending,
  experienced,
  canRegister,
}: {
  league: Doc<"leagues">;
  team: Team;
  pending: boolean;
  experienced?: boolean;
  canRegister: boolean;
}) {
  const t = useTranslations();
  const router = useRouter();
  const register = useMutation(api.leagues.register);
  const action = useLeagueAction();
  const ready = canEnrollTeam(
    { team, leagueExperienced: experienced },
    league.startingTreasury,
  );
  const base = `/leagues/manage/${league._id}`;
  return (
    <section className="no-print mb-5 space-y-3 rounded-xl border border-primary/25 bg-primary/5 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <Trophy className="size-5 shrink-0 text-primary" />
          <div>
            <Link href={base} className="font-semibold hover:underline">
              {league.name}
            </Link>
            <p className="mt-1 text-xs text-muted-foreground">
              {t("leagueUx.pickerHint", {
                amount: (
                  league.startingTreasury ?? DEFAULT_LEAGUE_TREASURY
                ).toLocaleString("uk-UA"),
              })}
            </p>
          </div>
        </div>
        {canRegister ? (
          <Button
            disabled={!ready || pending || action.busy}
            onClick={() =>
              void action.run(async () => {
                await register({ leagueId: league._id, teamUuid: team.uuid });
                router.push(base);
              })
            }
          >
            {t(pending ? "saving" : "leagueUx.joinLeague")}
            <ArrowRight className="size-4" />
          </Button>
        ) : (
          <Button
            nativeButton={false}
            render={<Link href={base} />}
            variant="outline"
          >
            {t("leagueUx.openLeague")}
          </Button>
        )}
      </div>
      {canRegister && !ready && (
        <LeagueTeamIssues
          team={team}
          leagueExperienced={experienced}
          startingTreasury={league.startingTreasury}
        />
      )}
      <LeagueError message={action.error} />
    </section>
  );
}
