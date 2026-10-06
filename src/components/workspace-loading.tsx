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
  if (variant === "editor") return <EditorLoading />;
  return (
    <LoadingLayout
      variant={variant}
      label={t("loading")}
      text={(key) => t(key)}
    />
  );
}

function EditorLoading() {
  const t = useTranslations();
  const pathname = usePathname();
  const sync = useDraftSync();
  const raw = useSyncExternalStore(subscribeDrafts, draftSnapshot, () => "[]");
  const team = parseDrafts(raw).find((draft) => {
    const account = draftAccount(draft.uuid);
    return (
      pathname === `/teams/${draft.uuid}` &&
      (!account || account === sync.account)
    );
  });
  return (
    <LoadingLayout
      variant="editor"
      label={t("loading")}
      team={team}
      text={(key) => t(key)}
    />
  );
}
