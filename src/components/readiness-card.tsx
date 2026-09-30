"use client";

import type { ReactNode } from "react";
import { MagicCard } from "./magic-ui/magic-card";

export function ReadinessCard({
  ready,
  children,
}: {
  ready: boolean;
  children: ReactNode;
}) {
  return (
    <section aria-live="polite" className="rounded-lg">
      {ready ? (
        <MagicCard
          className="rounded-lg [&>div.bg-background]:bg-emerald-50"
          gradientColor="#bbf7d0"
          gradientOpacity={0.22}
          gradientFrom="#16a34a"
          gradientTo="#a3e635"
        >
          <div className="p-3">{children}</div>
        </MagicCard>
      ) : (
        <div className="rounded-lg border bg-card p-3">{children}</div>
      )}
    </section>
  );
}
