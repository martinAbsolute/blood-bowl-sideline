"use client";

import type { ComponentProps, ReactNode } from "react";
import {
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "./dialog";
import { cn } from "@/lib/utils";

export function LeagueDialogContent({
  className,
  ...props
}: ComponentProps<typeof DialogContent>) {
  return (
    <DialogContent
      {...props}
      className={cn(
        "flex max-h-[90dvh] flex-col gap-0 overflow-hidden rounded-xl bg-card p-0 sm:max-w-xl",
        className,
      )}
    />
  );
}

export function LeagueDialogHeader({
  title,
  description,
  icon,
  destructive = false,
}: {
  title: ReactNode;
  description?: ReactNode;
  icon: ReactNode;
  destructive?: boolean;
}) {
  return (
    <DialogHeader className="shrink-0 border-b bg-secondary/35 p-5 pr-12">
      <div className="flex items-start gap-3">
        <span
          className={cn(
            "flex size-10 shrink-0 items-center justify-center rounded-lg border bg-card text-primary",
            destructive && "border-destructive/20 text-destructive",
          )}
        >
          {icon}
        </span>
        <div className="min-w-0">
          <DialogTitle className="display-font break-words text-xl leading-tight">
            {title}
          </DialogTitle>
          {description && (
            <DialogDescription className="mt-2 text-xs leading-relaxed">
              {description}
            </DialogDescription>
          )}
        </div>
      </div>
    </DialogHeader>
  );
}

export function LeagueDialogBody({
  className,
  ...props
}: ComponentProps<"div">) {
  return (
    <div
      {...props}
      className={cn(
        "min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain p-5",
        className,
      )}
    />
  );
}

export function LeagueDialogFooter({
  className,
  ...props
}: ComponentProps<"div">) {
  return (
    <div
      {...props}
      className={cn(
        "flex shrink-0 flex-wrap items-center justify-end gap-2 border-t bg-secondary/20 px-5 py-4 [&_button]:min-h-11 sm:[&_button]:min-h-9",
        className,
      )}
    />
  );
}

export function LeagueFormSection({
  title,
  children,
  className,
}: {
  title: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("space-y-3", className)}>
      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
      </h3>
      {children}
    </section>
  );
}
