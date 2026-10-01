import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";
import { EditorSelect } from "./editor-select";

/** Match the team editor's labels and let the field own control spacing. */
export function LeagueField({ className, ...props }: ComponentProps<"label">) {
  return (
    <label
      {...props}
      className={cn(
        "grid min-w-0 gap-1 text-xs font-medium text-muted-foreground [&_input]:mt-0 [&_input]:font-normal [&_input]:text-foreground [&_textarea]:mt-0 [&_textarea]:font-normal [&_textarea]:text-foreground",
        className,
      )}
    />
  );
}

export function LeagueSelect({
  className,
  wrapperClassName,
  ...props
}: ComponentProps<typeof EditorSelect>) {
  return (
    <EditorSelect
      {...props}
      wrapperClassName={cn("mt-0 shrink-0", wrapperClassName)}
      className={cn("h-10 rounded-lg bg-transparent font-normal", className)}
    />
  );
}
