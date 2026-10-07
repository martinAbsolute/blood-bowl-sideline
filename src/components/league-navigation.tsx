"use client";

import type { ComponentType } from "react";
import { LeagueSelect } from "./league-field";

/** Every destination stays reachable without a horizontally clipped tab bar. */
export function LeagueNavigation<T extends string>({
  label,
  value,
  onChange,
  items,
  vertical = false,
}: {
  label: string;
  value: T;
  onChange: (value: T) => void;
  vertical?: boolean;
  items: {
    value: T;
    label: string;
    icon?: ComponentType<{ className?: string }>;
    badge?: number;
  }[];
}) {
  return (
    <nav aria-label={label} className="min-w-0">
      <LeagueSelect
        aria-label={label}
        value={value}
        onChange={(event) => onChange(event.target.value as T)}
        wrapperClassName={vertical ? "lg:hidden" : "md:hidden"}
        className="h-11 bg-card font-medium"
      >
        {items.map((item) => (
          <option key={item.value} value={item.value}>
            {item.label}
            {item.badge ? ` (${item.badge})` : ""}
          </option>
        ))}
      </LeagueSelect>
      <div
        className={
          vertical
            ? "hidden flex-col gap-1 lg:flex"
            : "hidden flex-wrap gap-1 border-b pb-2 md:flex"
        }
      >
        {items.map(({ value: key, label: text, icon: Icon, badge }) => (
          <button
            key={key}
            type="button"
            aria-current={value === key ? "page" : undefined}
            onClick={() => onChange(key)}
            className={`inline-flex min-h-11 items-center gap-2 rounded-md border px-3 py-2 text-left text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-ring ${value === key ? "border-border bg-secondary text-primary" : "border-transparent text-muted-foreground hover:bg-secondary/50 hover:text-foreground"}`}
          >
            {Icon && <Icon className="size-4 shrink-0" />}
            <span className="min-w-0 flex-1">{text}</span>
            {!!badge && (
              <span className="rounded border border-current/10 bg-card px-1.5 text-xs tabular-nums">
                {badge}
              </span>
            )}
          </button>
        ))}
      </div>
    </nav>
  );
}
