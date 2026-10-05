"use client";

import { useId, useState } from "react";
import { useTranslations } from "gt-next";
import { Minus, Plus } from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";

/** Keep incomplete typing local; never send an empty string as a zero. */
export function LeagueNumber({
  label,
  value,
  onChange,
  min = 0,
  max = 99,
  disabled = false,
}: {
  label: string;
  value: number | null;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  disabled?: boolean;
}) {
  const t = useTranslations();
  const id = useId();
  const [draft, setDraft] = useState<string | null>(null);
  const valid = (text: string) =>
    /^\d+$/.test(text) && Number(text) >= min && Number(text) <= max;
  const change = (next: number) => {
    setDraft(null);
    onChange(Math.max(min, Math.min(max, next)));
  };
  const current =
    draft !== null && valid(draft) ? Number(draft) : (value ?? min);
  return (
    <div className="min-w-0 space-y-2">
      <label
        htmlFor={id}
        className="block text-xs font-medium text-muted-foreground"
      >
        {label}
      </label>
      <div className="flex h-11 min-w-0 items-center overflow-hidden rounded-lg border bg-card focus-within:ring-2 focus-within:ring-ring">
        <Button
          type="button"
          variant="ghost"
          className="h-11 w-11 shrink-0 rounded-none border-r"
          disabled={disabled || current <= min}
          aria-label={t("decreaseQuantity", { name: label })}
          onClick={() => change(current - 1)}
        >
          <Minus className="size-4" />
        </Button>
        <Input
          id={id}
          type="text"
          inputMode="numeric"
          role="spinbutton"
          aria-valuemin={min}
          aria-valuemax={max}
          aria-valuenow={value ?? undefined}
          aria-invalid={
            (draft !== null && draft !== "" && !valid(draft)) || undefined
          }
          disabled={disabled}
          value={draft ?? value ?? ""}
          className="h-full min-w-0 flex-1 rounded-none border-0 bg-transparent px-1 text-center font-mono text-base font-semibold shadow-none focus-visible:ring-0"
          onChange={(event) => {
            const text = event.target.value;
            setDraft(text);
            if (valid(text)) onChange(Number(text));
          }}
          onBlur={() => setDraft(null)}
          onKeyDown={(event) => {
            if (event.key === "ArrowUp" || event.key === "ArrowDown") {
              event.preventDefault();
              change(current + (event.key === "ArrowUp" ? 1 : -1));
            } else if (event.key === "Enter" || event.key === "Escape") {
              event.preventDefault();
              setDraft(null);
              event.currentTarget.blur();
            }
          }}
        />
        <Button
          type="button"
          variant="ghost"
          className="h-11 w-11 shrink-0 rounded-none border-l text-primary"
          disabled={disabled || current >= max}
          aria-label={t("increaseQuantity", { name: label })}
          onClick={() => change(current + 1)}
        >
          <Plus className="size-4" />
        </Button>
      </div>
    </div>
  );
}
