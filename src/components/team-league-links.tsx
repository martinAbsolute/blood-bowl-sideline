"use client";

import Link from "next/link";
import { useQuery } from "convex/react";
import { useTranslations } from "gt-next";
import { Flag, ArrowUpRight } from "lucide-react";
import { api } from "../../convex/_generated/api";

export function TeamLeagueLinks({
  uuid,
  locked,
  experienced,
}: {
  uuid: string;
  locked: boolean;
  experienced: boolean;
}) {
  const t = useTranslations();
  const careers = useQuery(api.leagues.listTeamCareers, { teamUuid: uuid });
  if (careers === undefined || (!careers.length && !experienced)) return null;
  const hint = locked
    ? careers?.some((career) => career.isOwner)
      ? "leagueUi.builderLockedOwnerHint"
      : "leagueUi.builderLockedViewerHint"
    : "leagueUi.experiencedTeamHint";
  return (
    <aside
      aria-label={t(
        careers.length ? "leagueOfficialRosters" : "leagueUi.experiencedTeam",
      )}
      className="mt-2 mb-2 print:hidden"
    >
      <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
        <p className="flex items-center gap-2 text-sm font-semibold">
          <Flag aria-hidden="true" className="size-4 shrink-0" />
          {t(
            careers.length
              ? "leagueOfficialRosters"
              : "leagueUi.experiencedTeam",
          )}
        </p>
        <p className="mt-1 text-sm text-muted-foreground">{t(hint)}</p>
        {!!careers?.length && (
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
            {careers.map((career) => (
              <Link
                key={career.entryId}
                className="inline-flex min-h-11 max-w-full items-center gap-1 rounded-sm text-sm font-medium underline underline-offset-4 hover:text-primary focus-visible:outline-2 focus-visible:outline-ring sm:min-h-8"
                href={`/leagues/manage/${career.leagueId}/teams/${career.entryId}`}
              >
                <span className="min-w-0 break-words">{career.leagueName}</span>
                <ArrowUpRight
                  aria-hidden="true"
                  className="size-3.5 shrink-0"
                />
              </Link>
            ))}
          </div>
        )}
      </div>
    </aside>
  );
}
