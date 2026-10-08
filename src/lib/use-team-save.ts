"use client";

import { useCallback } from "react";
import type { Id } from "../../convex/_generated/dataModel";
import { useMutation } from "convex/react";
import type { OptimisticLocalStore } from "convex/browser";
import { api } from "../../convex/_generated/api";
import { validateTeam } from "@/domain/rules";
import type { Team } from "@/domain/types";

export function optimisticallySaveTeam(
  store: OptimisticLocalStore,
  { team }: { team: Team },
) {
  const args = { uuid: team.uuid };
  const current = store.getQuery(api.teams.getByUuid, args);
  if (current?.canEdit) {
    // Keep the server's revision and ownership; only preview editable content.
    store.setQuery(api.teams.getByUuid, args, {
      ...current,
      team,
      legal: validateTeam(team).valid,
    });
  }
}

export function useTeamSave(leagueId?: string) {
  const save = useMutation(api.teams.save).withOptimisticUpdate(
    optimisticallySaveTeam,
  );
  return useCallback(
    (args: { team: Team; expectedRevision: number; favorite?: boolean }) =>
      save(leagueId ? { ...args, leagueId: leagueId as Id<"leagues"> } : args),
    [save, leagueId],
  );
}
