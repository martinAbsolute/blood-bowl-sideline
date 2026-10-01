import { Skeleton } from "./ui/skeleton";
import { BrandLogo } from "./brand";
import { SiteFooter } from "./site-footer";
import en from "@/i18n/en.json";
import { getRoster } from "@/domain/catalog";
import type { Team } from "@/domain/types";

export type LoadingVariant = "library" | "editor" | "catalog";

export function LibraryCardsLoading({ label }: { label: string }) {
  return (
    <div
      role="status"
      aria-label={label}
      className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3"
    >
      <span className="sr-only">{label}</span>
      {[0, 1, 2].map((index) => (
        <div
          key={index}
          aria-hidden="true"
          className={`overflow-hidden rounded-2xl border bg-card ${index === 1 ? "hidden sm:block" : index === 2 ? "hidden xl:block" : ""}`}
        >
          <div className="bg-primary/10 px-5 pb-5 pt-4">
            <div className="mb-4 flex h-6 justify-between">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-6 w-14 rounded-full" />
            </div>
            <div className="flex h-20 items-center gap-4">
              <Skeleton className="size-16 shrink-0 rounded-2xl" />
              <div className="flex-1 space-y-3">
                <Skeleton className="h-7 w-4/5" />
                <Skeleton className="h-4 w-1/2" />
              </div>
            </div>
          </div>
          <div className="space-y-4 p-5">
            <div className="h-8">
              <Skeleton className="h-4 w-3/4" />
            </div>
            <Skeleton className="h-16 w-full rounded-lg" />
            <Skeleton className="h-4 w-24" />
          </div>
          <div className="flex min-h-14 items-center border-t bg-secondary/15 px-5">
            <Skeleton className="h-4 w-28" />
          </div>
        </div>
      ))}
    </div>
  );
}

function TableLoading({
  rows,
  empty = false,
  compact = false,
  footer = false,
  title = true,
  framed = true,
}: {
  rows: number;
  empty?: boolean;
  compact?: boolean;
  footer?: boolean;
  title?: boolean;
  framed?: boolean;
}) {
  return (
    <div
      className={`overflow-hidden bg-card ${framed ? "rounded-lg border" : ""}`}
    >
      {title && (
        <div
          className={`flex items-center justify-between border-b bg-secondary/40 px-4 ${compact ? "h-[44px]" : "h-[54px]"}`}
        >
          <Skeleton className="h-5 w-36" />
          <Skeleton className="h-3 w-10" />
        </div>
      )}
      <div className="flex h-[34px] items-center gap-5 border-b px-4">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="ml-auto h-3 w-1/3" />
      </div>
      {Array.from({ length: rows }, (_, index) => (
        <div
          key={index}
          className={`flex items-center gap-3 border-b px-4 last:border-0 ${empty ? "h-[30px] justify-center" : "h-12"}`}
        >
          {empty ? (
            <Skeleton className="h-3 w-2/3" />
          ) : (
            <>
              <Skeleton className="size-8 shrink-0" />
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="ml-auto h-4 w-1/4" />
            </>
          )}
        </div>
      ))}
      {footer && (
        <div className="flex h-[53px] items-center justify-between border-t px-5">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-7 w-32" />
        </div>
      )}
    </div>
  );
}

export function LoadingLayout({
  variant = "library",
  label,
  team,
}: {
  variant?: LoadingVariant;
  label: string;
  team?: Team;
}) {
  if (variant === "editor")
    return (
      <div
        className="page-width team-builder py-5"
        role="status"
        aria-label={label}
      >
        <span className="sr-only">{label}</span>
        <div aria-hidden="true">
          <div className="mb-4 space-y-3">
            <div className="flex min-h-8 items-center">
              <Skeleton className="h-4 w-20" />
            </div>
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div className="flex max-w-full items-end gap-2">
                <Skeleton className="h-10 w-60 max-w-full sm:h-12" />
                <Skeleton className="mb-[9px] h-3 w-24" />
              </div>
              <div className="mb-1 flex gap-2">
                <Skeleton className="h-8 w-28" />
                <Skeleton className="h-8 w-24" />
              </div>
            </div>
            <div className="flex h-6 gap-2">
              <Skeleton className="h-6 w-20" />
              <Skeleton className="h-6 w-28" />
              <Skeleton className="h-6 w-20" />
            </div>
          </div>
          <div className="budget-grid">
            <div className="@container space-y-5">
              <TableLoading
                rows={getRoster(team?.rosterId ?? "human")!.players.length}
              />
              <TableLoading
                rows={
                  (team?.players.length ?? 0) + (team?.stars.length ?? 0) || 1
                }
                empty={!team?.players.length && !team?.stars.length}
                compact
                footer
              />
              <div className="grid items-start gap-6 @min-[780px]:grid-cols-2">
                {[5, 6].map((count) => (
                  <section key={count}>
                    <div className="mb-3 flex h-6 items-center justify-between px-1">
                      <Skeleton className="h-5 w-36" />
                      <Skeleton className="h-3 w-12" />
                    </div>
                    <div className="space-y-2">
                      {Array.from({ length: count }, (_, index) => (
                        <div
                          key={index}
                          className="flex h-20 items-center justify-between gap-3 rounded-xl border bg-card px-3 sm:px-4"
                        >
                          <div className="flex-1 space-y-3">
                            <Skeleton className="h-4 w-3/4" />
                            <Skeleton className="h-3 w-2/3" />
                          </div>
                          <Skeleton className="size-11" />
                          <Skeleton className="h-4 w-5" />
                          <Skeleton className="size-11" />
                        </div>
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            </div>
            <aside className="budget-side space-y-3">
              <section className="rounded-lg border bg-card p-3">
                <div className="grid gap-3">
                  {[0, 1, 2].map((index) => (
                    <div
                      key={index}
                      className={`space-y-1 ${index === 2 ? "max-[900px]:col-start-2" : ""}`}
                    >
                      <Skeleton className="h-4 w-16" />
                      <Skeleton className="h-9 w-full" />
                    </div>
                  ))}
                </div>
                <div className="mt-4 space-y-2 border-t pt-4">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-3/4" />
                </div>
              </section>
              <section className="space-y-5 rounded-lg border bg-card p-4">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-8 w-32" />
                <Skeleton className="h-2 w-full" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-10 w-full" />
              </section>
              <section className="space-y-3 rounded-lg border bg-card p-4">
                <Skeleton className="h-6 w-40" />
                <Skeleton className="h-4 w-full" />
              </section>
            </aside>
          </div>
        </div>
      </div>
    );
  if (variant === "catalog")
    return (
      <div
        className="page-width py-8 sm:py-10"
        role="status"
        aria-label={label}
      >
        <span className="sr-only">{label}</span>
        <div aria-hidden="true">
          <div className="mb-5 flex h-[30px] items-center justify-between sm:h-[37.5px]">
            <Skeleton className="h-8 w-36" />
            <Skeleton className="h-4 w-20" />
          </div>
          <div className="catalog-layout">
            <aside className="catalog-index">
              <Skeleton className="h-9 w-full" />
              <div className="mt-3 hidden space-y-2 lg:block">
                {Array.from({ length: 12 }, (_, index) => (
                  <Skeleton key={index} className="h-7 w-3/4" />
                ))}
              </div>
              <Skeleton className="mt-3 h-7 w-full lg:hidden" />
            </aside>
            <div className="min-w-0 space-y-5">
              {[0, 1, 2].map((index) => (
                <div
                  key={index}
                  className="overflow-hidden rounded-lg border bg-card"
                >
                  <div className="flex h-[46px] items-center justify-between bg-secondary/40 px-3 md:h-[49px]">
                    <Skeleton className="h-6 w-36" />
                    <Skeleton className="h-7 w-32" />
                  </div>
                  <div className="hidden md:block">
                    <TableLoading rows={4} title={false} framed={false} />
                    <div className="space-y-3 border-t p-4">
                      <Skeleton className="h-4 w-2/3" />
                      <Skeleton className="h-4 w-1/2" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  return (
    <div className="page-width py-8 sm:py-10">
      <div aria-hidden="true">
        <header className="mb-7 flex flex-wrap items-start justify-between gap-5">
          <div className="max-w-full">
            <Skeleton className="h-9 w-40" />
            <Skeleton className="mt-2 h-5 w-80 max-w-full" />
          </div>
          <Skeleton className="h-8 w-32" />
        </header>
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-xl border bg-secondary/30 px-5 py-4">
          <Skeleton className="h-5 w-80 max-w-full" />
          <Skeleton className="h-8 w-44" />
        </div>
        <div className="mb-7 grid grid-cols-2 gap-3 lg:grid-cols-[minmax(200px,1fr)_180px_210px]">
          <Skeleton className="col-span-2 h-10 lg:col-span-1" />
          <Skeleton className="h-10" />
          <Skeleton className="h-10" />
        </div>
      </div>
      <div className="min-h-[400px]">
        <LibraryCardsLoading label={label} />
      </div>
    </div>
  );
}

/** The initial locale/provider boundary preserves the same shell geometry. */
export function ShellLoading() {
  return (
    <>
      <header className="site-header no-print" aria-hidden="true">
        <div className="page-width flex min-h-14 flex-wrap items-center justify-between gap-3 py-2">
          <BrandLogo />
          <div className="flex gap-2">
            <Skeleton className="h-8 w-20 rounded-full" />
            <Skeleton className="h-8 w-10 rounded-full md:w-[180px]" />
          </div>
        </div>
      </header>
      <main className="min-h-[calc(100vh-245px)]">
        <LoadingLayout label="Loading…" />
      </main>
      <SiteFooter community={en.community} />
    </>
  );
}
