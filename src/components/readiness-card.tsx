import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "./ui/card";

export function ReadinessCard({ ready, children }: { ready: boolean; children: ReactNode }) {
  return (
    <div aria-live="polite">
      <Card size="sm" className={cn("rounded-lg", ready && "bg-emerald-50 ring-emerald-200")}>
        <CardContent>{children}</CardContent>
      </Card>
    </div>
  );
}
