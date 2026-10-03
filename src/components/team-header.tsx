"use client";
import type { ReactNode } from "react";

export function TeamHeader({
  back,
  status,
  actions,
  title,
  children,
}: {
  back: ReactNode;
  status?: ReactNode;
  actions: ReactNode;
  title: ReactNode;
  children: ReactNode;
}) {
  return (
    <header className="mb-5 space-y-3">
      <div className="flex min-h-11 flex-wrap items-center justify-between gap-x-4 gap-y-1">
        {back}
        {status}
      </div>
      <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start lg:gap-6">
        <div className="min-w-0 space-y-2">
          {title}
          {children}
        </div>
        <div
          className="no-print flex min-w-0 items-center gap-2 lg:pt-1"
          data-title-actions
        >
          {actions}
        </div>
      </div>
    </header>
  );
}
