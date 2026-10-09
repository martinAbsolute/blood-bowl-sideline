"use client";

import { useSearchParams } from "next/navigation";
import type { Id } from "../../convex/_generated/dataModel";
import type { FunctionReturnType } from "convex/server";
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
import { PageStatus } from "./page-status";

export function TeamPage({
  uuid,
  initial,
}: {
  uuid: string;
  initial?: FunctionReturnType<typeof api.teams.getByUuid>;
}) {
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
  ) {
    // Render the public roster into the initial HTML for text-only readers.
    // Wait for auth, local recovery and live permissions before enabling edits.
    // An explicit null from the live query must invalidate the server snapshot.
    if (initial && initial.team.uuid === uuid && live !== null) {
      const preview = live ?? initial;
      return (
        <TeamEditor
          key={`preview-${uuid}:${preview.revision}`}
          initial={preview.team}
          revision={preview.revision}
          readOnly
          server={preview}
          recovered={false}
          leagueNotice={
            <TeamLeagueLinks
              uuid={uuid}
              locked={preview.leagueLocked}
              experienced={preview.leagueExperienced}
            />
          }
        />
      );
    }
    return <WorkspaceLoading variant="editor" />;
  }
  const editable = live ? isAuthenticated && live.canEdit : !!local;
  if (sync.ready && (local || live))
    return (
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
        leagueNotice={
          <TeamLeagueLinks
            uuid={uuid}
            locked={!!live?.leagueLocked}
            experienced={!!live?.leagueExperienced}
          />
        }
      />
    );
  return (
    <PageStatus
      code="404"
      title={t("notFound")}
      description={t("notFoundHint")}
    />
  );
}
