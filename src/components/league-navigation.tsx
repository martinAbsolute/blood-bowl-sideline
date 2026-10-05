"use client";

import type { ComponentType } from "react";
import { LeagueSelect } from "./league-field";

/** Every destination stays reachable without a horizontally clipped tab bar. */
export function LeagueNavigation<T extends string>({
  label,
  value,
  onChange,
  items,
}: {
  label: string;
  value: T;
  onChange: (value: T) => void;
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
        wrapperClassName="md:hidden"
        className="h-12 bg-card font-semibold"
      >
        {items.map((item) => (
          <option key={item.value} value={item.value}>
            {item.label}
            {item.badge ? ` (${item.badge})` : ""}
          </option>
        ))}
      </LeagueSelect>
      <div className="hidden flex-wrap gap-1 rounded-xl border bg-card p-1 md:flex">
        {items.map(({ value: key, label: text, icon: Icon, badge }) => (
          <button
            key={key}
            type="button"
            aria-current={value === key ? "page" : undefined}
            onClick={() => onChange(key)}
            className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-3 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-ring ${value === key ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary hover:text-foreground"}`}
          >
            {Icon && <Icon className="size-4" />}
            {text}
            {!!badge && (
              <span className="rounded bg-current/10 px-1.5 text-xs tabular-nums">
                {badge}
              </span>
            )}
          </button>
        ))}
      </div>
    </nav>
  );
}
