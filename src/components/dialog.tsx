"use client";

import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { X } from "lucide-react";
import { useTranslations } from "gt-next";
import { cn } from "@/lib/utils";
import { Button } from "./ui/button";
import { DialogClose, DialogOverlay, DialogPortal } from "./ui/dialog";

export {
  Dialog,
  DialogClose,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "./ui/dialog";

/** Keep nested dialogs shielded and portal events out of their owning UI. */
export function DialogContent({
  className,
  children,
  showCloseButton = true,
  onClick,
  onPointerDown,
  ...props
}: DialogPrimitive.Popup.Props & { showCloseButton?: boolean }) {
  const t = useTranslations();
  return (
    <DialogPortal>
      <DialogOverlay forceRender onClick={(event) => event.stopPropagation()} />
      <DialogPrimitive.Popup
        {...props}
        data-slot="dialog-content"
        className={cn(
          "fixed top-1/2 left-1/2 z-50 grid w-full max-w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 gap-4 rounded-xl bg-popover p-4 text-sm text-popover-foreground ring-1 ring-foreground/10 duration-100 outline-none sm:max-w-sm data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
          className,
        )}
        onClick={(event) => {
          event.stopPropagation();
          onClick?.(event);
        }}
        onPointerDown={(event) => {
          event.stopPropagation();
          onPointerDown?.(event);
        }}
      >
        {children}
        {showCloseButton && (
          <DialogClose
            render={
              <Button
                variant="ghost"
                className="absolute right-2 top-2"
                size="icon-sm"
              />
            }
          >
            <X />
            <span className="sr-only">{t("close")}</span>
          </DialogClose>
        )}
      </DialogPrimitive.Popup>
    </DialogPortal>
  );
}
