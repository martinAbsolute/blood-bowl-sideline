import { Skeleton } from "./ui/skeleton";
import { BrandLogo } from "./brand";
import { version } from "../../package.json";

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

function TableLoading({ rows }: { rows: number }) {
  return (
    <div className="overflow-hidden rounded-lg border bg-card">
      <div className="flex h-14 items-center border-b bg-secondary/40 px-4">
        <Skeleton className="h-5 w-36" />
      </div>
      <div className="flex h-[34px] items-center gap-5 border-b px-4">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="ml-auto h-3 w-1/3" />
      </div>
      {Array.from({ length: rows }, (_, index) => (
        <div
          key={index}
          className="flex h-11 items-center gap-3 border-b px-4 last:border-0"
        >
          <Skeleton className="size-7 shrink-0" />
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="ml-auto h-4 w-1/4" />
        </div>
      ))}
    </div>
  );
}

export function LoadingLayout({
  variant = "library",
  label,
}: {
  variant?: LoadingVariant;
  label: string;
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
            <div className="flex flex-wrap items-start justify-between gap-3">
              <Skeleton className="h-9 w-60 max-w-full" />
              <div className="flex gap-2">
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
            <div className="space-y-3">
              <TableLoading rows={4} />
              <TableLoading rows={2} />
              <TableLoading rows={3} />
            </div>
            <aside className="budget-side space-y-3">
              <section className="grid gap-3 rounded-lg border bg-card p-3">
                <Skeleton className="h-14 w-full" />
                <Skeleton className="h-14 w-full" />
                <Skeleton className="h-12 w-full" />
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
          <div className="mb-5 flex h-9 items-center justify-between">
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
                <TableLoading key={index} rows={4} />
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
            <Skeleton className="h-8 w-8 rounded-full md:w-40" />
          </div>
        </div>
      </header>
      <main className="min-h-[calc(100vh-245px)]">
        <LoadingLayout label="Loading…" />
      </main>
      <footer className="no-print border-t border-border py-4">
        <div className="page-width flex flex-col justify-between gap-5 md:flex-row">
          <div aria-hidden="true">
            <Skeleton className="h-5 w-72 max-w-full" />
            <Skeleton className="mt-2 h-8 w-[32rem] max-w-full" />
            <Skeleton className="mt-2 h-4 w-64 max-w-full" />
          </div>
          <div className="text-xs text-muted-foreground">
            <Skeleton className="h-4 w-28" />
            <p className="mt-3 font-mono tabular-nums">v{version}</p>
          </div>
        </div>
      </footer>
    </>
  );
}
