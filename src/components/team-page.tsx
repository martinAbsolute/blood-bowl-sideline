"use client";

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

export function TeamPage({ uuid }: { uuid: string }) {
  const t = useTranslations();
  const sync = useDraftSync();
  const { isAuthenticated } = useConvexAuth();
  const raw = useSyncExternalStore(subscribeDrafts, draftSnapshot, () => "[]");
  const local = parseDrafts(raw).find((team) => {
    const account = draftAccount(team.uuid);
    return team.uuid === uuid && (!account || account === sync.account);
  });
  const live = useQuery(api.teams.getByUuid, sync.ready ? { uuid } : "skip");
  const editable = !!local || (isAuthenticated && !!live?.canEdit);
  if (sync.ready && (local || live))
    return (
      <TeamEditor
        key={`${uuid}:${sync.account ?? "guest"}:${editable ? "edit" : `view-${live?.revision}`}`}
        initial={local ?? live!.team}
        revision={local ? 0 : live!.revision}
        readOnly={!editable}
      />
    );
  if (!sync.ready || live === undefined)
    return <WorkspaceLoading variant="editor" />;
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
