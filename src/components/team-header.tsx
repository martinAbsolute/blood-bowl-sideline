"use client";
import type { ReactNode } from "react";

export function TeamHeader({
  back,
  actions,
  title,
  children,
}: {
  back: ReactNode;
  actions: ReactNode;
  title: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="mb-4 space-y-3">
      <div className="flex min-h-8 items-center">{back}</div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex min-w-0 max-w-full flex-wrap items-end gap-x-0 gap-y-2">
          {title}
        </div>
        <div
          className="no-print mb-1 flex shrink-0 flex-wrap gap-2"
          data-title-actions
        >
          {actions}
        </div>
      </div>
      {children}
    </div>
  );
}
