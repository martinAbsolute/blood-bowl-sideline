import { Card } from "./ui/card";
import { Skeleton } from "./ui/skeleton";

export function LeagueCardsLoading({ label }: { label: string }) {
  return (
    <div role="status" className="grid gap-5">
      <span className="sr-only">{label}</span>
      {[0, 1, 2].map((index) => (
        <Card
          key={index}
          aria-hidden="true"
          className="grid gap-5 rounded-2xl p-5 shadow-sm sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:p-6"
        >
          <div className="flex items-center gap-4">
            <Skeleton className="size-14 shrink-0 rounded-2xl" />
            <div className="min-w-0 flex-1 space-y-2">
              <Skeleton className="h-6 w-48 max-w-full" />
              <Skeleton className="h-4 w-28" />
            </div>
          </div>
          <div className="flex items-center justify-between gap-4">
            <Skeleton className="h-6 w-24 rounded-full" />
            <Skeleton className="size-4" />
          </div>
          <div className="flex flex-wrap gap-x-8 gap-y-3 border-t pt-4 sm:col-span-2">
            <Skeleton className="h-5 w-28" />
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-5 w-40" />
          </div>
        </Card>
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
