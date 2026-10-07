import type { ReactNode } from "react";
import { BrandPeriod } from "./brand-period";

/** Shared page identity for seasons, official teams and match reports. */
export function LeaguePageHeader({
  title,
  eyebrow,
  description,
  icon,
  status,
  action,
  children,
}: {
  title: ReactNode;
  eyebrow?: ReactNode;
  description?: ReactNode;
  icon?: ReactNode;
  status?: ReactNode;
  action?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <header className="overflow-hidden rounded-lg border bg-card">
      <div className="relative flex flex-wrap items-start justify-between gap-4 overflow-hidden bg-primary p-4 text-primary-foreground sm:p-5">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-8 -top-12 size-48 rounded-full border-[24px] border-white/5"
        />
        <div className="flex min-w-0 flex-1 basis-60 items-start gap-3">
          {icon && (
            <div className="flex size-12 shrink-0 items-center justify-center rounded-lg bg-white/90 text-primary">
              {icon}
            </div>
          )}
          <div className="min-w-0 flex-1">
            {eyebrow && <p className="mb-1 text-xs text-white/70">{eyebrow}</p>}
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
              <h1 className="page-heading min-w-0 max-w-full break-words">
                {title}
                <BrandPeriod />
              </h1>
              {status && <span className="rounded-md bg-card">{status}</span>}
            </div>
            {description && (
              <div className="mt-2 text-sm text-white/75 [&_a]:text-white [&_.text-foreground]:text-white/90">
                {description}
              </div>
            )}
          </div>
        </div>
        {action && (
          <div className="relative flex flex-wrap items-center gap-2 text-foreground">
            {action}
          </div>
        )}
      </div>
      {children && (
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t bg-secondary/30 px-4 py-3 text-xs text-muted-foreground sm:px-5">
          {children}
        </div>
      )}
    </header>
  );
}

export function LeagueEmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-lg border bg-card px-5 py-10 text-center sm:py-14">
      <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-lg border bg-secondary/50 text-primary">
        {icon}
      </div>
      <h2 className="text-base font-semibold">{title}</h2>
      {description && (
        <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
          {description}
        </p>
      )}
      {action && (
        <div className="mt-5 flex flex-wrap justify-center gap-2">{action}</div>
      )}
    </div>
  );
}
