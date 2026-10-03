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
    <header className="team-header mb-4">
      <div className="team-header-back">{back}</div>
      <div className="team-header-identity">
        <div className="team-header-title-row">
          <div className="team-header-title">{title}</div>
          {status && <div className="team-header-status">{status}</div>}
        </div>
        <div className="team-header-tags">{children}</div>
      </div>
      <div
        className="team-header-actions no-print flex min-w-0 items-center gap-2"
        data-title-actions
      >
        {actions}
      </div>
    </header>
  );
}
