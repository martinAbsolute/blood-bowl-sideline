import { Skeleton } from "./ui/skeleton";
import { LeagueCardsLoading } from "./list-loading";

export function LeagueDirectoryLoading({
  label,
  workspace = false,
  reference = false,
}: {
  label: string;
  workspace?: boolean;
  reference?: boolean;
}) {
  const detail = workspace || reference;
  return (
    <div
      className={`page-width space-y-5 ${detail ? "py-6 sm:py-8" : "py-8 sm:py-10"}`}
      role="status"
      aria-label={label}
      data-loading-layout={
        reference ? "league-reference" : workspace ? "league" : "leagues"
      }
    >
      <span className="sr-only">{label}</span>
      <div aria-hidden="true">
        {detail && <BackLoading />}
        <div
          className={
            detail
              ? "rounded-lg border bg-primary p-5 [&_[data-slot=skeleton]]:bg-white/15"
              : "mb-7"
          }
        >
          <div className="flex items-start gap-3">
            {detail && <Skeleton className="size-12 shrink-0" />}
            <div className="min-w-0 flex-1 space-y-2">
              <Skeleton className="h-8 w-60 max-w-full" />
              <Skeleton className="h-4 w-80 max-w-full" />
            </div>
            <Skeleton className="h-9 w-24 shrink-0" />
          </div>
          {detail && <Skeleton className="mt-5 h-4 w-2/3" />}
        </div>
      </div>
      <div className="catalog-layout">
        <aside aria-hidden="true" className="space-y-3">
          <Skeleton className="h-11 w-full" />
          <div className="hidden space-y-2 lg:block">
            {[0, 1, 2, 3].map((index) => (
              <Skeleton key={index} className="h-10 w-full" />
            ))}
          </div>
        </aside>
        <div className="min-w-0 space-y-3">
          <Skeleton aria-hidden="true" className="h-5 w-36" />
          {detail ? (
            <div aria-hidden="true" className="space-y-4">
              {[0, 1].map((index) => (
                <div
                  key={index}
                  className="overflow-hidden rounded-lg border bg-card"
                >
                  <div className="border-b bg-secondary/35 p-4">
                    <Skeleton className="h-5 w-40" />
                  </div>
                  <div className="space-y-3 p-4">
                    <Skeleton className="h-5 w-2/3" />
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-10 w-32" />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <LeagueCardsLoading label={label} />
          )}
        </div>
      </div>
    </div>
  );
}

function BackLoading() {
  return <Skeleton className="mb-5 h-8 w-36" />;
}

function NavigationLoading() {
  return (
    <div>
      <Skeleton className="h-11 w-full md:hidden" />
      <div className="hidden flex-wrap gap-1 border-b pb-2 md:flex">
        {[0, 1, 2].map((index) => (
          <Skeleton key={index} className="h-11 w-28" />
        ))}
      </div>
    </div>
  );
}

/** These boundaries run before authentication and translation providers. */
export function LeagueContentLoading({
  variant,
  label,
}: {
  variant: "league-match" | "league-career";
  label: string;
}) {
  const match = variant === "league-match";
  return (
    <div
      className="page-width space-y-5 py-6 sm:py-8"
      role="status"
      aria-label={label}
      data-loading-layout={variant}
    >
      <span className="sr-only">{label}</span>
      <div aria-hidden="true" className="space-y-4">
        {match ? (
          <>
            <header>
              <BackLoading />
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-primary p-5 [&_[data-slot=skeleton]]:bg-white/15">
                <Skeleton className="h-[30px] w-60 max-w-full sm:h-[37.5px]" />
                <Skeleton className="h-6 w-24" />
              </div>
            </header>
            <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3 rounded-lg border bg-secondary/35 p-4 sm:gap-5 sm:p-6">
              {[0, 1, 2].map((index) =>
                index === 1 ? (
                  <Skeleton key={index} className="h-8 w-20 sm:h-10" />
                ) : (
                  <div
                    key={index}
                    className={`min-w-0 space-y-2 ${index === 2 ? "flex flex-col items-end" : ""}`}
                  >
                    <Skeleton className="size-9 sm:size-11" />
                    <Skeleton className="h-5 w-40 max-w-full sm:h-7" />
                    <Skeleton className="h-4 w-32 max-w-full" />
                  </div>
                ),
              )}
            </div>
            <div className="grid grid-cols-3 gap-1 border-b pb-2">
              {[0, 1, 2].map((index) => (
                <Skeleton key={index} className="h-10 w-full" />
              ))}
            </div>
            <div className="py-1">
              <div className="grid gap-4 sm:grid-cols-2">
                {[0, 1].map((index) => (
                  <section
                    key={index}
                    className="min-w-0 space-y-5 rounded-lg border bg-card p-4 sm:p-5"
                  >
                    <Skeleton className="h-5 w-36 max-w-full" />
                    <div className="grid grid-cols-[auto_auto_minmax(0,1fr)] items-end gap-3">
                      <Skeleton className="h-11 w-12" />
                      <Skeleton className="h-11 w-12" />
                      <Skeleton className="h-11 w-full" />
                    </div>
                    <Skeleton className="h-11 w-full" />
                    <Skeleton className="h-4 w-3/4" />
                  </section>
                ))}
              </div>
              <section className="mt-4 space-y-3 rounded-lg border bg-card p-4">
                <Skeleton className="h-5 w-32" />
                <Skeleton className="h-11 w-full" />
              </section>
            </div>
          </>
        ) : (
          <>
            <BackLoading />
            <header className="rounded-lg border bg-primary p-4 sm:p-5 [&_[data-slot=skeleton]]:bg-white/15">
              <div className="flex items-start gap-4">
                <Skeleton className="size-11 shrink-0" />
                <div className="min-w-0 flex-1">
                  <Skeleton className="h-[30px] w-64 max-w-full sm:h-[37.5px]" />
                  <Skeleton className="mt-2 h-5 w-48 max-w-full" />
                  <div className="mt-2 flex flex-wrap gap-4">
                    <Skeleton className="h-4 w-28" />
                    <Skeleton className="h-4 w-20" />
                  </div>
                </div>
              </div>
            </header>
            <NavigationLoading />
            <div className="grid grid-cols-3 divide-x overflow-hidden rounded-lg border bg-card">
              {[0, 1, 2].map((index) => (
                <div key={index} className="min-w-0 space-y-1 px-3 py-2">
                  <Skeleton className="h-4 w-24 max-w-full" />
                  <Skeleton className="h-6 w-16 max-w-full" />
                </div>
              ))}
            </div>
            <section className="min-w-0 rounded-lg border bg-card p-3 sm:p-4">
              <Skeleton className="mb-3 h-5 w-32" />
              <Skeleton className="mb-3 h-9 w-full sm:max-w-sm" />
              <div className="divide-y overflow-hidden rounded-lg border md:hidden">
                {[0, 1, 2].map((index) => (
                  <div
                    key={index}
                    className="flex h-16 items-center gap-2 px-3 py-2"
                  >
                    <Skeleton className="size-8 shrink-0" />
                    <div className="min-w-0 flex-1 space-y-1">
                      <Skeleton className="h-5 w-36 max-w-full" />
                      <Skeleton className="h-4 w-28 max-w-full" />
                    </div>
                    <Skeleton className="h-9 w-7" />
                  </div>
                ))}
              </div>
              <div className="hidden overflow-hidden rounded-lg border md:block">
                <Skeleton className="h-9 w-full rounded-none" />
                {[0, 1, 2, 3].map((index) => (
                  <div
                    key={index}
                    className="flex h-14 items-center gap-3 border-t px-3"
                  >
                    <Skeleton className="size-8" />
                    <Skeleton className="h-4 w-1/3" />
                    <Skeleton className="ml-auto h-4 w-1/4" />
                  </div>
                ))}
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  );
}
