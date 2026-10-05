import { Skeleton } from "./ui/skeleton";
import { ChevronsUpDown } from "lucide-react";

export function AccountLoading({ compact = false }: { compact?: boolean }) {
  return (
    <div
      aria-hidden="true"
      data-collapsed={compact}
      className="sidebar-menu-button sidebar-account-button flex h-12 w-full items-center"
    >
      <Skeleton className="size-8 shrink-0 rounded-full" />
      <div className="sidebar-button-label min-w-0 flex-1">
        <Skeleton className="h-5 w-24 max-w-full" />
        <Skeleton className="h-4 w-32 max-w-full" />
      </div>
      <span className="sidebar-button-badge text-muted-foreground">
        <ChevronsUpDown className="size-4" />
      </span>
    </div>
  );
}
