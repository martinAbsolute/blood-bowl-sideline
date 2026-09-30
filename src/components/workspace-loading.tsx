"use client";
import { useTranslations } from "gt-next";
import { LoadingLayout, type LoadingVariant } from "./loading-layouts";
import { usePathname } from "next/navigation";
import { useSyncExternalStore } from "react";
import {
  draftSnapshot,
  parseDrafts,
  subscribeDrafts,
  draftAccount,
} from "@/lib/drafts";
import { useDraftSync } from "./draft-sync-provider";

export function WorkspaceLoading({
  variant = "library",
}: {
  variant?: LoadingVariant;
}) {
  const t = useTranslations();
  const pathname = usePathname();
  const sync = useDraftSync();
  const raw = useSyncExternalStore(subscribeDrafts, draftSnapshot, () => "[]");
  const team =
    variant === "editor"
      ? parseDrafts(raw).find((draft) => {
          const account = draftAccount(draft.uuid);
          return (
            pathname === `/teams/${draft.uuid}` &&
            (!account || account === sync.account)
          );
        })
      : undefined;
  return <LoadingLayout variant={variant} label={t("loading")} team={team} />;
}
