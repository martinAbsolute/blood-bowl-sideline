"use client";
import { useQuery } from "convex/react";
import { useTranslations } from "gt-next";
import { api } from "../../convex/_generated/api";
import type { Team } from "@/domain/types";
import { useState } from "react";
import { TeamEditor } from "./team-editor";
import { Button } from "./ui/button";
import { Pencil } from "lucide-react";
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
    live = useQuery(api.teams.getByUuid, { uuid: initial.team.uuid }),
    [editing, setEditing] = useState(false);
  if (live === null)
    return (
      <div className="page-width py-16">
        <h1 className="section-title">{t("notFound")}</h1>
        <p className="mt-3 text-muted-foreground">{t("notFoundHint")}</p>
      </div>
    );
  const data = live ?? initial;
  return (
    <>
      {data.canEdit && !editing && (
        <div className="page-width pt-7">
          <Button variant="outline" onClick={() => setEditing(true)}>
            <Pencil className="size-4" />
            {t("editTeam")}
          </Button>
        </div>
      )}
      <TeamEditor
        key={editing ? `edit-${data.team.uuid}` : `view-${data.revision}`}
        initial={data.team}
        revision={data.revision}
        readOnly={!editing}
      />
    </>
  );
}
