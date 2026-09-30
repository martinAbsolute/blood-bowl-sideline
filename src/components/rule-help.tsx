"use client";

import { useId, useRef, useState, type ReactNode } from "react";
import { useTranslations } from "gt-next";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from "./ui/dialog";
import { Button } from "./ui/button";
import { CircleHelp } from "lucide-react";

/** Hover/focus for a quick explanation; click, tap or Enter for a persistent one. */
export function RuleHelp({
  title,
  description,
  meta,
  children,
  className,
  label,
  href,
  fullDescription = false,
}: {
  title: string;
  description: string;
  meta?: string;
  children: ReactNode;
  className?: string;
  label?: string;
  href?: string;
  fullDescription?: boolean;
}) {
  const t = useTranslations();
  const [open, setOpen] = useState(false);
  const [hovered, setHovered] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const descriptionId = useId();
  return (
    <>
      <Tooltip open={hovered && !open} onOpenChange={setHovered}>
        <TooltipTrigger
          delay={250}
          render={
            <button
              ref={trigger}
              type="button"
              aria-label={label ?? title}
              aria-haspopup="dialog"
              className={cn(
                "rule-help rounded-sm text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                className,
              )}
              onClick={() => {
                setHovered(false);
                setOpen(true);
              }}
            />
          }
        >
          {children}
        </TooltipTrigger>
        <TooltipContent
          sideOffset={6}
          className="w-80 max-w-[calc(100vw-2rem)] space-y-1.5 overflow-hidden px-3 py-2.5 text-sm leading-relaxed"
        >
          <p className="font-semibold">{title}</p>
          {meta && <p className="text-xs opacity-80">{meta}</p>}
          <p
            className={cn(
              "whitespace-pre-wrap",
              !fullDescription && "line-clamp-10",
            )}
          >
            {description}
          </p>
        </TooltipContent>
      </Tooltip>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          aria-describedby={meta ? descriptionId : undefined}
          className="max-h-[85dvh] overflow-y-auto sm:max-w-md"
          finalFocus={() => {
            setHovered(false);
            return trigger.current;
          }}
        >
          <DialogHeader className="pr-6">
            <DialogTitle>{title}</DialogTitle>
            {meta && (
              <DialogDescription id={descriptionId}>{meta}</DialogDescription>
            )}
          </DialogHeader>
          <p className="whitespace-pre-wrap text-base leading-relaxed">
            {description}
          </p>
          {href && (
            <a
              href={href}
              target="_blank"
              rel="noreferrer"
              className="text-sm text-primary underline underline-offset-4"
            >
              {t("fullRule")}
            </a>
          )}
          <DialogClose render={<Button variant="outline" className="mt-2" />}>
            {t("ok")}
          </DialogClose>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function RuleInfo({
  className,
  ...props
}: Omit<React.ComponentProps<typeof RuleHelp>, "children">) {
  return (
    <RuleHelp
      {...props}
      className={cn(
        "inline-flex size-8 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-secondary hover:text-primary",
        className,
      )}
    >
      <CircleHelp className="size-4" aria-hidden="true" />
    </RuleHelp>
  );
}
