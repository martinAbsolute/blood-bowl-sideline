import type { ComponentProps } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export function EditorSelect({
  className,
  wrapperClassName,
  children,
  ...props
}: ComponentProps<"select"> & { wrapperClassName?: string }) {
  return (
    <span className={cn("relative mt-1 block min-w-0", wrapperClassName)}>
      <select
        {...props}
        className={cn(
          "peer h-9 w-full appearance-none rounded-md border border-input bg-card pl-2.5 pr-8 text-sm font-normal text-foreground outline-none focus:ring-2 focus:ring-ring",
          className,
        )}
      >
        {children}
      </select>
      <ChevronDown
        aria-hidden="true"
        className="pointer-events-none absolute right-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground transition-transform duration-150 peer-[:open]:rotate-180 motion-reduce:transition-none"
      />
    </span>
  );
}
