"use client";

import { useSyncExternalStore } from "react";
import { useQuery } from "convex/react";
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
import { SharedTeam } from "./shared-team";
import { WorkspaceLoading } from "./workspace-loading";

export function TeamPage({ uuid }: { uuid: string }) {
  const t = useTranslations();
  const sync = useDraftSync();
  const raw = useSyncExternalStore(subscribeDrafts, draftSnapshot, () => "[]");
  const local = parseDrafts(raw).find((team) => {
    const account = draftAccount(team.uuid);
    return team.uuid === uuid && (!account || account === sync.account);
  });
  const live = useQuery(
    api.teams.getByUuid,
    sync.ready && !local ? { uuid } : "skip",
  );
  if (sync.ready && local) return <TeamEditor key={uuid} initial={local} />;
  if (live) return <SharedTeam initial={live} />;
  if (!sync.ready || live === undefined) return <WorkspaceLoading />;
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
