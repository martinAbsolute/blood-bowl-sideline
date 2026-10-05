"use client";

import { useTranslations } from "gt-next";
import {
  Check,
  ChevronDown,
  CloudCheck,
  CloudOff,
  LoaderCircle,
} from "lucide-react";
import type { useTeamAutosave } from "@/lib/use-team-autosave";
import { useConvexConnectionState } from "convex/react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";

type SaveState = ReturnType<typeof useTeamAutosave>;

// Lucide paths leave different amounts of space below their strokes.
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
  const connection = useConvexConnectionState();
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
    discardChanges,
    hasServer,
  } = state;
  const reconnecting =
    isAuthenticated && !connection.isWebSocketConnected && (dirty || saving);
  const { label, Icon } = reconnecting
    ? { label: "saveReconnecting", Icon: CloudOff }
    : syncError || cloudInvalid
      ? { label: "saveStatusError", Icon: CloudOff }
      : localSave?.failed
        ? { label: "saveStatusLocalError", Icon: CloudOff }
        : cloudPending || localPending
          ? { label: "saving", Icon: LoaderCircle }
          : revision > 0 && !dirty
            ? { label: "savedCloud", Icon: CloudCheck }
            : { label: "savedInDrafts", Icon: Check };
  const detail = syncError
    ? syncError.message
    : reconnecting
      ? "saveWaitingConnection"
      : cloudInvalid
        ? "invalidTeamSave"
        : localSave?.failed
          ? "storageError"
          : isAuthenticated && !team.name.trim()
            ? "teamNameRequired"
            : !isAuthenticated
              ? "guestText"
              : undefined;
  const indicator = (
    <>
      <Icon
        aria-hidden="true"
        className={`size-3.5 shrink-0 ${label === "saving" ? "animate-spin" : ""}`}
        style={{ translate: `0 ${iconBaselineOffset.get(Icon) ?? 0.5}px` }}
      />
      <span>{t(label)}</span>
    </>
  );
  return (
    <div className="no-print shrink-0 text-[11px] text-muted-foreground sm:text-xs">
      <span role="status" aria-live="polite" className="sr-only">
        {t(label)}
      </span>
      {detail ? (
        <Popover>
          <PopoverTrigger className="inline-flex cursor-pointer items-baseline gap-1.5 whitespace-nowrap rounded-sm py-1 hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring">
            {indicator}
            <ChevronDown
              aria-hidden="true"
              className="size-3 self-center opacity-60"
            />
          </PopoverTrigger>
          <PopoverContent
            align="start"
            sideOffset={8}
            className="w-80 max-w-[calc(100vw-2rem)] gap-3 p-4"
          >
            <PopoverTitle className="text-sm">{t(label)}</PopoverTitle>
            <PopoverDescription className="text-xs leading-relaxed">
              {t(detail)}
            </PopoverDescription>
            {syncError && (
              <div className="flex flex-col items-stretch gap-2">
                {!syncError.conflict && (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={saving || !team.name.trim()}
                    onClick={() => void saveTeam()}
                  >
                    {t("retry")}
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  className="h-auto min-h-9 whitespace-normal py-2 text-xs"
                  disabled={saving}
                  onClick={discardChanges}
                >
                  {t(hasServer ? "useSavedTeam" : "discardDraft")}
                </Button>
              </div>
            )}
          </PopoverContent>
        </Popover>
      ) : (
        <span className="inline-flex items-baseline gap-1.5 whitespace-nowrap py-1">
          {indicator}
        </span>
      )}
    </div>
  );
}
