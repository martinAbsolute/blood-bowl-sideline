"use client";

import { useTranslations } from "gt-next";
import { Minus, Plus } from "lucide-react";
import { Button } from "./ui/button";

export function QuantityStepper({
  label,
  value,
  max,
  onDecrease,
  onIncrease,
  disabled = false,
  increaseDisabled = false,
}: {
  label: string;
  value: number;
  max: number;
  onDecrease: () => void;
  onIncrease: () => void;
  disabled?: boolean;
  increaseDisabled?: boolean;
}) {
  const t = useTranslations();
  return (
    <div
      role="group"
      aria-label={label}
      className="quantity-stepper flex items-center justify-end gap-1"
    >
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="size-8 shrink-0 bg-card"
        disabled={disabled || value <= 0}
        aria-label={t("decreaseQuantity", { name: label })}
        onClick={onDecrease}
      >
        <Minus className="size-4" />
      </Button>
      <output
        aria-label={`${label}: ${value}/${max}`}
        className="min-w-10 text-center font-mono text-sm tabular-nums"
      >
        <span className="font-semibold">{value}</span>
        <span className="text-xs text-muted-foreground">/{max}</span>
      </output>
      <Button
        type="button"
        variant="default"
        size="icon"
        className="size-8 shrink-0"
        disabled={disabled || increaseDisabled || value >= max}
        aria-label={t("increaseQuantity", { name: label })}
        onClick={onIncrease}
      >
        <Plus className="size-4" />
      </Button>
    </div>
  );
}
