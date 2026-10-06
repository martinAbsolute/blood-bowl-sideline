import type { ReactNode } from "react";
import { cn } from "cn";

export function IconTransition({ show, children }: { show: boolean; children: ReactNode }) {
  return (
    <span aria-hidden={!show} className={cn(
      "absolute inset-0 flex items-center justify-center transition-all duration-200 ease-out motion-reduce:transition-none",
      show ? "scale-100 opacity-100 rotate-0" : "scale-50 opacity-0 -rotate-45",
    )}>
      {children}
    </span>
  );
}
