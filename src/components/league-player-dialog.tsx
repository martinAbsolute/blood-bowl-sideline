"use client";

import { Dialog } from "@base-ui/react/dialog";
import { useTranslations } from "gt-next";
import { X } from "lucide-react";
import type { ReactNode } from "react";

/** Keep player drafts mounted when inspecting another player. */
export function LeaguePlayerDialog({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}) {
  const t = useTranslations();
  return (
    <Dialog.Root
      open={open}
      onOpenChange={(value) => {
        if (!value) onClose();
      }}
    >
      <Dialog.Portal keepMounted>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/20 backdrop-blur-xs data-closed:hidden" />
        <Dialog.Popup
          className="fixed left-1/2 top-1/2 z-50 max-h-[90dvh] w-[calc(100%-2rem)] max-w-2xl -translate-x-1/2 -translate-y-1/2 overflow-y-auto overscroll-contain rounded-xl border bg-card shadow-lg outline-none data-closed:hidden"
          onClick={(event) => event.stopPropagation()}
        >
          <Dialog.Title className="sr-only">{title}</Dialog.Title>
          <Dialog.Description className="sr-only">
            {t("leagueDesk.playerHint")}
          </Dialog.Description>
          <Dialog.Close
            aria-label={t("close")}
            className="absolute right-2 top-2 z-10 flex size-8 items-center justify-center rounded-md bg-card text-muted-foreground hover:bg-secondary focus-visible:ring-2 focus-visible:ring-ring"
          >
            <X className="size-4" />
          </Dialog.Close>
          {children}
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
