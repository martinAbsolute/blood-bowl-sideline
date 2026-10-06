"use client";
import { useConvexAuth, useQuery } from "convex/react";
import { useTranslations } from "gt-next";
import { api } from "../../convex/_generated/api";
import type { Team } from "@/domain/types";
import { TeamEditor } from "./team-editor";
import { PageStatus } from "./page-status";
export function SharedTeam({
  initial,
}: {
  initial: {
    team: Team;
    revision: number;
    legal: boolean;
    updatedAt: number;
    canEdit: boolean;
  };
}) {
  const t = useTranslations(),
    live = useQuery(api.teams.getByUuid, { uuid: initial.team.uuid });
  const { isAuthenticated } = useConvexAuth();
  if (live === null)
    return (
      <PageStatus
        code="404"
        title={t("notFound")}
        description={t("notFoundHint")}
      />
    );
  const data = live ?? initial;
  const canEdit = isAuthenticated && data.canEdit;
  return (
    <TeamEditor
      key={canEdit ? `edit-${data.team.uuid}` : `view-${data.revision}`}
      initial={data.team}
      revision={data.revision}
      readOnly={!canEdit}
      server={data}
    />
  );
}
