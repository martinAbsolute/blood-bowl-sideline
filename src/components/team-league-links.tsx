"use client";

import Link from "next/link";
import { useQuery } from "convex/react";
import { useTranslations } from "gt-next";
import { Flag, ArrowUpRight } from "lucide-react";
import { api } from "../../convex/_generated/api";

export function TeamLeagueLinks({ uuid }: { uuid: string }) {
  const t = useTranslations();
  const careers = useQuery(api.leagues.listTeamCareers, { teamUuid: uuid });
  if (!careers?.length) return null;
  return (
    <aside
      aria-label={t("leagueOfficialRosters")}
      className="page-width pt-6 print:hidden"
    >
      <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
        <p className="flex items-center gap-2 text-sm font-semibold">
          <Flag className="size-4" />
          {t("leagueOfficialRosters")}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          {t("leagueBuilderSeparate")}
        </p>
        <div className="mt-3 flex flex-wrap gap-3">
          {careers.map((career) => (
            <Link
              key={career.entryId}
              className="inline-flex items-center gap-1 text-sm font-medium underline underline-offset-4"
              href={`/leagues/manage/${career.leagueId}/teams/${career.entryId}`}
            >
              {career.leagueName}
              <ArrowUpRight className="size-3.5" />
            </Link>
          ))}
        </div>
      </div>
    </aside>
  );
}
