"use client";

import { useSearchParams } from "next/navigation";
import type { Id } from "../../convex/_generated/dataModel";
import { useSyncExternalStore } from "react";
import { useConvexAuth, useQuery } from "convex/react";
import { useTranslations } from "gt-next";
import { api } from "../../convex/_generated/api";
import {
  draftAccount,
  draftSnapshot,
  parseDrafts,
  subscribeDrafts,
} from "@/lib/drafts";
import { useDraftSync } from "./draft-sync-provider";
import { TeamEditor } from "./team-editor";
import { WorkspaceLoading } from "./workspace-loading";
import { TeamLeagueLinks } from "./team-league-links";

export function TeamPage({ uuid }: { uuid: string }) {
  const t = useTranslations();
  const requestedLeagueId = useSearchParams().get("league");
  const sync = useDraftSync();
  const { isAuthenticated, isLoading } = useConvexAuth();
  const raw = useSyncExternalStore(subscribeDrafts, draftSnapshot, () => "[]");
  const local = parseDrafts(raw).find((team) => {
    const account = draftAccount(team.uuid);
    return team.uuid === uuid && (!account || account === sync.account);
  });
  const live = useQuery(api.teams.getByUuid, sync.ready ? { uuid } : "skip");
  const leagueId = requestedLeagueId ?? live?.draftLeagueId;
  const leagueContext = useQuery(
    api.leagues.get,
    isAuthenticated && leagueId
      ? { leagueId: leagueId as Id<"leagues"> }
      : "skip",
  );
  if (
    isLoading ||
    !sync.ready ||
    live === undefined ||
    (isAuthenticated && leagueId && leagueContext === undefined)
  )
    return <WorkspaceLoading variant="editor" />;
  const editable = live ? isAuthenticated && live.canEdit : !!local;
  if (sync.ready && (local || live))
    return (
      <>
        {live?.leagueExperienced && (
          <div className="page-width pt-6 print:hidden">
            <p
              role="status"
              className="rounded-lg border border-primary/20 bg-primary/5 p-4 text-sm"
            >
              {t(
                live.leagueLocked
                  ? "leagueUi.builderLockedHint"
                  : "leagueUi.experiencedTeamHint",
              )}
            </p>
          </div>
        )}
        <TeamLeagueLinks uuid={uuid} />
        <TeamEditor
          key={`${uuid}:${sync.account ?? "guest"}:${editable ? "edit" : `view-${live?.revision}`}`}
          leagueContext={leagueId ? leagueContext : undefined}
          initial={live?.leagueLocked ? live.team : (local ?? live!.team)}
          revision={
            live?.leagueLocked ? live.revision : local ? 0 : live!.revision
          }
          readOnly={!editable}
          server={live}
          recovered={!!local && !live?.leagueLocked}
        />
      </>
    );
  return (
    <div className="page-width py-16">
      <h1 className="section-title">
        {t(!sync.ready || live === undefined ? "loading" : "notFound")}
      </h1>
      {live === null && (
        <p className="mt-3 text-muted-foreground">{t("notFoundHint")}</p>
      )}
    </div>
  );
}
