import { Skeleton } from "./ui/skeleton";

export function LeagueCardsLoading({ label }: { label: string }) {
  return (
    <div role="status" className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      <span className="sr-only">{label}</span>
      {[0, 1, 2].map((index) => (
        <div
          key={index}
          aria-hidden="true"
          className={`flex min-w-0 flex-col gap-4 rounded-xl border bg-card p-5 ${index === 1 ? "hidden md:flex" : index === 2 ? "hidden xl:flex" : ""}`}
        >
          <div className="flex items-center gap-3">
            <Skeleton className="size-11 shrink-0 rounded-lg" />
            <div className="min-w-0 flex-1">
              <Skeleton className="h-6 w-3/4" />
              <Skeleton className="mt-1 h-4 w-full" />
            </div>
          </div>
          <div className="flex items-center justify-between gap-2 border-t pt-4">
            <Skeleton className="h-6 w-24 rounded-full" />
            <Skeleton className="h-4 w-20" />
          </div>
          <Skeleton className="h-5 w-28" />
        </div>
      ))}
    </div>
  );
}

export function UsersLoading({ label }: { label: string }) {
  return (
    <div
      role="status"
      className="divide-y overflow-hidden rounded-xl border bg-card"
    >
      <span className="sr-only">{label}</span>
      {[0, 1, 2].map((index) => (
        <div key={index} aria-hidden="true" className="p-4 sm:px-5">
          <div className="flex items-center gap-3">
            <Skeleton className="size-12 shrink-0 rounded-full" />
            <div className="min-w-0 flex-1">
              <Skeleton className="h-6 w-36 max-w-full" />
              <Skeleton className="h-4 w-48 max-w-full" />
              <Skeleton className="mt-1 h-4 w-16" />
            </div>
          </div>
          <Skeleton className="ml-15 mt-1 h-4 w-32 max-w-[calc(100%-3.75rem)]" />
        </div>
      ))}
    </div>
  );
}
