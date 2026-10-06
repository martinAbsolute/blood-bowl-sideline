"use client";

import { useTranslations } from "gt-next";
import { Share2 } from "lucide-react";
import { shareTeamLink } from "@/lib/share-team";
import { ActionButton } from "./action-button";
import type { ComponentProps } from "react";

export function ShareButton({
  path,
  onShared,
  ...props
}: Omit<
  ComponentProps<typeof ActionButton>,
  "onClick" | "icon" | "successLabel" | "errorLabel" | "children"
> & { path: string; onShared?: () => void }) {
  const t = useTranslations();
  return (
    <ActionButton
      {...props}
      icon={<Share2 className="size-4" />}
      successLabel={t("shareSucceeded")}
      errorLabel={t("copyFailed")}
      onClick={async () => {
        const result = await shareTeamLink(`${window.location.origin}${path}`);
        if (result === "cancelled") return false;
        onShared?.();
      }}
    >
      {t("share")}
    </ActionButton>
  );
}
