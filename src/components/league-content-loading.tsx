import { Skeleton } from "./ui/skeleton";

function BackLoading() {
  return <Skeleton className="mb-3 h-8 w-36" />;
}

function NavigationLoading() {
  return (
    <div>
      <Skeleton className="h-12 w-full md:hidden" />
      <div className="hidden flex-wrap gap-1 rounded-xl border bg-card p-1 md:flex">
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
      className="page-width space-y-4 py-5 sm:py-6"
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
              <div className="flex flex-wrap items-center justify-between gap-3">
                <Skeleton className="h-[30px] w-60 max-w-full sm:h-[37.5px]" />
                <Skeleton className="h-6 w-24" />
              </div>
            </header>
            <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 rounded-lg border bg-card p-3 sm:gap-4 sm:p-4">
              {[0, 1, 2].map((index) =>
                index === 1 ? (
                  <Skeleton key={index} className="h-8 w-20 sm:h-10" />
                ) : (
                  <div
                    key={index}
                    className={`min-w-0 space-y-2 ${index === 2 ? "flex flex-col items-end" : ""}`}
                  >
                    <Skeleton className="size-6" />
                    <Skeleton className="h-5 w-40 max-w-full sm:h-7" />
                    <Skeleton className="h-4 w-32 max-w-full" />
                  </div>
                ),
              )}
            </div>
            <div className="grid grid-cols-3 gap-1 rounded-xl border bg-card p-1">
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
            <header className="rounded-lg border bg-card p-3 sm:p-4">
              <BackLoading />
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
