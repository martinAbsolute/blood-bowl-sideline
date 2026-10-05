"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useConvexAuth } from "convex/react";
import { ConvexError } from "convex/values";
import { useTranslations } from "gt-next";
import { teamSaveIssues } from "@/domain/rules";
import type { Team } from "@/domain/types";
import {
  draftAccount,
  readDraftRevision,
  removeDraft,
  storeDraft,
  storeRevision,
} from "@/lib/drafts";
import { saveCloudDraft } from "@/lib/cloud-save";
import {
  finishDraftSignIn,
  pendingDraftSave,
  prepareDraftSignIn,
} from "@/lib/draft-sign-in";
import { toast } from "@/components/ui/toast";
import { useDraftSync } from "@/components/draft-sync-provider";
import { useDraftSignIn } from "@/components/draft-sign-in-provider";
import { useBeforeUnload } from "./use-before-unload";

type Save = Parameters<typeof saveCloudDraft>[2];
export type SavedTeam = { team: Team; revision: number };

// The editor owns the optimistic snapshot; acknowledgements only advance its
// revision. They must never replace edits made during an earlier request.
export function useTeamAutosave(
  initial: Team,
  initialRevision: number,
  readOnly: boolean,
  save: Save,
  server?: SavedTeam | null,
  recovered = initialRevision === 0,
) {
  const t = useTranslations();
  const { isAuthenticated, isLoading } = useConvexAuth();
  const draftSync = useDraftSync();
  const draftSignIn = useDraftSignIn();
  const [team, setTeam] = useState(initial),
    [revision, setRevision] = useState(() =>
      recovered ? readDraftRevision(initial.uuid) : initialRevision,
    ),
    [saving, setSaving] = useState(false),
    [dirty, setDirty] = useState(recovered);
  const [syncError, setSyncError] = useState<{
    team: Team;
    conflict: boolean;
    message: string;
  } | null>(null);
  const [localSave, setLocalSave] = useState<{
    team: Team;
    failed: boolean;
  } | null>(null);
  const resumedSave = useRef(false);
  const returnedFromSignIn = useRef(pendingDraftSave(initial.uuid) !== null);
  const latestTeam = useRef(team);
  const saveInFlight = useRef(false);
  const saveIssues = teamSaveIssues(team);
  const storageErrorText = t("storageError");
  const reserveEditor = draftSync.editing;
  // Convex subscriptions drive idle editors. Never rebase unsaved edits onto a
  // revision from another tab: the server will reject that stale write.
  useEffect(() => {
    if (!server || dirty || saving || server.revision <= revision) return;
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      latestTeam.current = server.team;
      setTeam(server.team);
      setRevision(server.revision);
      setSyncError(null);
    });
    return () => {
      cancelled = true;
    };
  }, [server, dirty, saving, revision]);
  useEffect(() => {
    if (!readOnly) return reserveEditor(team.uuid);
  }, [reserveEditor, team.uuid, readOnly]);
  useEffect(() => {
    let cancelled = false;
    if (
      !readOnly &&
      (dirty || revision === 0) &&
      (localSave?.team !== team ||
        (draftSync.account && draftAccount(team.uuid) !== draftSync.account))
    ) {
      let failed = false;
      try {
        storeDraft(team, draftSync.account, revision);
      } catch {
        failed = true;
        toast.add({ type: "error", title: storageErrorText });
      }
      queueMicrotask(() => {
        if (!cancelled)
          setLocalSave((current) =>
            current?.team === team && current.failed === failed
              ? current
              : { team, failed },
          );
      });
    }
    return () => {
      cancelled = true;
    };
  }, [
    team,
    readOnly,
    storageErrorText,
    localSave,
    dirty,
    revision,
    draftSync.account,
  ]);
  useEffect(() => {
    if (readOnly || isAuthenticated) return;
    return draftSignIn.register(() => prepareDraftSignIn(team, revision));
  }, [draftSignIn, team, revision, readOnly, isAuthenticated]);
  function change(next: Team) {
    // Persist before navigation can interrupt React's effect commit.
    try {
      storeDraft(
        next,
        draftSync.account,
        next.uuid === team.uuid ? revision : 0,
      );
      if (next.uuid === team.uuid) storeRevision(next.uuid, revision);
      setLocalSave({ team: next, failed: false });
    } catch {
      toast.add({ type: "error", title: storageErrorText });
      setLocalSave({ team: next, failed: true });
    }
    if (next.uuid !== team.uuid) setRevision(0);
    latestTeam.current = next;
    setTeam(next);
    setDirty(true);
  }
  const saveTeam = useCallback(
    async (
      expectedRevision = pendingDraftSave(team.uuid)?.revision ?? revision,
    ) => {
      if (
        saveInFlight.current ||
        readOnly ||
        !isAuthenticated ||
        isLoading ||
        !draftSync.ready
      )
        return;
      if (!team.name.trim()) {
        toast.add({ type: "error", title: t("teamNameRequired") });
        return;
      }
      if (teamSaveIssues(team).length) {
        toast.add({ type: "error", title: t("invalidTeamSave") });
        return;
      }
      saveInFlight.current = true;
      setSaving(true);
      setSyncError(null);
      const pending = pendingDraftSave(team.uuid);
      try {
        const result = await saveCloudDraft(team, expectedRevision, save);
        if (latestTeam.current.uuid !== team.uuid) return;
        setRevision(result.revision);
        finishDraftSignIn(team.uuid);
        const hasNewerEdits = latestTeam.current !== team;
        if (hasNewerEdits) {
          try {
            storeDraft(latestTeam.current, draftSync.account, result.revision);
          } catch {
            setLocalSave({ team: latestTeam.current, failed: true });
          }
        }
        setDirty(hasNewerEdits);
        if (!hasNewerEdits) setLocalSave({ team, failed: false });
        if (pending) toast.add({ type: "success", title: t("saved") });
      } catch (error) {
        if (latestTeam.current.uuid !== team.uuid) return;
        // Another tab may have cleared the shared snapshot while its own save
        // succeeded. Restore this tab's failed edits for explicit recovery.
        try {
          storeDraft(latestTeam.current, draftSync.account, expectedRevision);
          setLocalSave({ team: latestTeam.current, failed: false });
        } catch {
          setLocalSave({ team: latestTeam.current, failed: true });
        }
        const code =
          error instanceof ConvexError
            ? error.data
            : error instanceof Error
              ? error.message
              : "";
        const conflict = typeof code === "string" && code.includes("CONFLICT");
        const message = conflict
          ? "conflict"
          : code === "ARCHIVED"
            ? "saveArchived"
            : code === "FORBIDDEN" || code === "UNAUTHENTICATED"
              ? "saveAccessLost"
              : code === "TEAM_IN_LEAGUE"
                ? "leagueUi.builderLockedHint"
                : code === "INVALID_TEAM"
                  ? "invalidTeamSave"
                  : "saveFailed";
        setSyncError({ team, conflict, message });
      } finally {
        saveInFlight.current = false;
        setSaving(false);
      }
    },
    [
      revision,
      save,
      team,
      t,
      readOnly,
      isAuthenticated,
      isLoading,
      draftSync.ready,
      draftSync.account,
    ],
  );
  function discardChanges() {
    if (saveInFlight.current) return;
    try {
      removeDraft(team.uuid);
    } catch {
      toast.add({ type: "error", title: storageErrorText });
      return;
    }
    finishDraftSignIn(team.uuid);
    if (server) {
      latestTeam.current = server.team;
      setTeam(server.team);
      setRevision(server.revision);
    }
    setDirty(false);
    setSyncError(null);
    setLocalSave(null);
  }
  useEffect(() => {
    if (
      !readOnly &&
      returnedFromSignIn.current &&
      !isLoading &&
      !isAuthenticated
    ) {
      returnedFromSignIn.current = false;
      toast.add({ type: "error", title: t("loginFailed") });
    }
    if (readOnly || !isAuthenticated || !draftSync.ready || resumedSave.current)
      return;
    const pending = pendingDraftSave(team.uuid);
    if (!pending) return;
    resumedSave.current = true;
    // Resume the external save after React finishes committing authentication.
    queueMicrotask(() => void saveTeam(pending.revision));
  }, [
    readOnly,
    isAuthenticated,
    isLoading,
    team.uuid,
    saveTeam,
    t,
    draftSync.ready,
  ]);
  useEffect(() => {
    if (
      readOnly ||
      !isAuthenticated ||
      !draftSync.ready ||
      saving ||
      !dirty ||
      !team.name.trim() ||
      teamSaveIssues(team).length > 0 ||
      syncError?.conflict ||
      syncError?.team === team
    )
      return;
    // Coalesce rapid edits and serialize requests using the returned revision.
    const timer = window.setTimeout(() => void saveTeam(), 400);
    return () => window.clearTimeout(timer);
  }, [
    readOnly,
    isAuthenticated,
    saving,
    dirty,
    team,
    syncError,
    saveTeam,
    draftSync.ready,
  ]);
  const localPending = (dirty || revision === 0) && localSave?.team !== team;
  const cloudPending =
    isAuthenticated &&
    (saving ||
      (dirty && !!team.name.trim() && !syncError && !saveIssues.length));
  const cloudInvalid = isAuthenticated && dirty && saveIssues.length > 0;
  useBeforeUnload(
    !readOnly &&
      (localPending ||
        !!localSave?.failed ||
        (isAuthenticated && (dirty || saving))),
  );
  return {
    team,
    revision,
    saving,
    dirty,
    syncError,
    localSave,
    cloudPending,
    localPending,
    cloudInvalid,
    change,
    saveTeam,
    discardChanges,
    hasServer: !!server,
  };
}
