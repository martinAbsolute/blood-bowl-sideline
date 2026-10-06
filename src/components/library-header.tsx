import type { ReactNode } from "react";
import { BrandPeriod } from "./brand-period";

export function LibraryHeader({
  title,
  description,
  action,
}: {
  title: ReactNode;
  description: ReactNode;
  action: ReactNode;
}) {
  return (
    <header className="mb-7 flex flex-wrap items-start justify-between gap-5">
      <div>
        <h1 className="page-heading">
          {title}
          <BrandPeriod />
        </h1>
        <p className="mt-2 max-w-xl text-sm text-muted-foreground">
          {description}
        </p>
      </div>
      {action}
    </header>
  );
}
