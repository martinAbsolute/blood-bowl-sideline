import type { ReactNode } from "react";
import { BrandPeriod } from "./brand-period";

export function PageStatus({
  code,
  title,
  description,
  action,
  accent = true,
}: {
  code?: string;
  title: ReactNode;
  description: ReactNode;
  action?: ReactNode;
  accent?: boolean;
}) {
  return (
    <section className="page-width flex min-h-[60svh] items-center py-16 sm:py-24">
      <div
        className={`w-full max-w-2xl ${accent ? "border-l-4 border-orange-500 pl-6 sm:pl-10" : ""}`}
      >
        {code ? (
          <p className="display-font mb-5 text-7xl leading-none tracking-tight text-muted-foreground/30 sm:text-8xl">
            {code}
            <BrandPeriod />
          </p>
        ) : null}
        <h1 className="display-font text-balance text-3xl leading-tight sm:text-4xl">
          {title}
          {code ? null : <BrandPeriod />}
        </h1>
        <p className="mt-4 max-w-md text-pretty text-muted-foreground">
          {description}
        </p>
        {action ? <div className="mt-8">{action}</div> : null}
      </div>
    </section>
  );
}
