import { Card } from "./ui/card";
import { Skeleton } from "./ui/skeleton";

export function HistoryLoading({ label }: { label: string }) {
  return (
    <div role="status" aria-label={label} className="space-y-4">
      <span className="sr-only">{label}</span>
      {[0, 1, 2].map((index) => (
        <div
          key={index}
          aria-hidden="true"
          className="space-y-2 border-b pb-4 last:border-0"
        >
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-3 w-40 max-w-full" />
        </div>
      ))}
    </div>
  );
}

export function LeagueCardsLoading({ label }: { label: string }) {
  return (
    <div role="status" className="grid gap-4 xl:grid-cols-2">
      <span className="sr-only">{label}</span>
      {[0, 1, 2].map((index) => (
        <Card
          key={index}
          aria-hidden="true"
          className="gap-0 overflow-hidden rounded-lg py-0 shadow-none"
        >
          <div className="flex items-start gap-3 bg-primary p-4 [&_[data-slot=skeleton]]:bg-white/15">
            <Skeleton className="size-10 shrink-0 rounded-lg" />
            <div className="min-w-0 flex-1 space-y-2">
              <Skeleton className="h-5 w-48 max-w-full" />
              <Skeleton className="h-3 w-28" />
              <Skeleton className="h-5 w-24" />
            </div>
            <Skeleton className="size-4" />
          </div>
          <div className="flex flex-wrap gap-x-5 gap-y-2 border-t bg-secondary/25 px-4 py-2.5">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-4 w-40" />
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
