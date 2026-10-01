"use client";

import { useTranslations } from "gt-next";
import { Check, CloudCheck, CloudOff, LoaderCircle } from "lucide-react";
import type { useTeamAutosave } from "@/lib/use-team-autosave";

type SaveState = ReturnType<typeof useTeamAutosave>;

export function TeamSaveStatus({
  state,
  isAuthenticated,
}: {
  state: SaveState;
  isAuthenticated: boolean;
}) {
  const t = useTranslations();
  const {
    team,
    revision,
    saving,
    dirty,
    syncError,
    localSave,
    cloudPending,
    localPending,
    cloudInvalid,
    saveTeam,
  } = state;
  const saveStatus =
    syncError || cloudInvalid
      ? "saveStatusError"
      : localSave?.failed
        ? "saveStatusLocalError"
        : cloudPending || localPending
          ? "saving"
          : revision > 0 && !dirty
            ? "savedCloud"
            : "savedInDrafts";
  const SaveIcon =
    syncError || cloudInvalid || localSave?.failed
      ? CloudOff
      : cloudPending || localPending
        ? LoaderCircle
        : revision > 0 && !dirty
          ? CloudCheck
          : Check;
  return (
    <div
      role="status"
      aria-live="polite"
      className="no-print -ml-[18px] mb-[9px] flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground"
      title={
        syncError
          ? t(syncError.conflict ? "conflict" : "saveFailed")
          : cloudInvalid
            ? t("invalidTeamSave")
            : localSave?.failed
              ? t("storageError")
              : isAuthenticated && !team.name.trim()
                ? t("teamNameRequired")
                : !isAuthenticated
                  ? t("guestText")
                  : undefined
      }
    >
      <SaveIcon
        aria-hidden="true"
        className={`size-3.5 shrink-0 ${saveStatus === "saving" ? "animate-spin" : ""}`}
      />
      <span>{t(saveStatus)}</span>
      {syncError && !syncError.conflict && (
        <button
          type="button"
          className="underline underline-offset-4"
          disabled={saving || !team.name.trim()}
          onClick={() => void saveTeam()}
        >
          {t("retry")}
        </button>
      )}
    </div>
  );
}
