"use client";

import { useTranslations } from "gt-next";
import { Check, CloudCheck, CloudOff, LoaderCircle } from "lucide-react";
import type { useTeamAutosave } from "@/lib/use-team-autosave";

type SaveState = ReturnType<typeof useTeamAutosave>;

// Lucide paths leave different amounts of space below their strokes in the
// 24-unit viewBox. At 14px, these optical offsets put the ink on the baseline.
const iconBaselineOffset = new Map([
  [CloudCheck, 1.5],
  [Check, 3],
]);

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
  const { label: saveStatus, Icon } =
    syncError || cloudInvalid
      ? { label: "saveStatusError", Icon: CloudOff }
      : localSave?.failed
        ? { label: "saveStatusLocalError", Icon: CloudOff }
        : cloudPending || localPending
          ? { label: "saving", Icon: LoaderCircle }
          : revision > 0 && !dirty
            ? { label: "savedCloud", Icon: CloudCheck }
            : { label: "savedInDrafts", Icon: Check };
  return (
    <div
      role="status"
      aria-live="polite"
      className="no-print flex flex-wrap items-baseline gap-1.5 text-[11px] text-muted-foreground sm:text-xs"
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
      <Icon
        aria-hidden="true"
        className={`size-3.5 shrink-0 ${saveStatus === "saving" ? "animate-spin" : ""}`}
        style={{ translate: `0 ${iconBaselineOffset.get(Icon) ?? 0.5}px` }}
      />
      <span>{t(saveStatus)}</span>
      {syncError && !syncError.conflict && (
        <button
          type="button"
          className="min-h-11 px-2 underline underline-offset-4"
          disabled={saving || !team.name.trim()}
          onClick={() => void saveTeam()}
        >
          {t("retry")}
        </button>
      )}
    </div>
  );
}
