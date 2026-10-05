"use client";
import { useState } from "react";
import { useLocale, useTranslations } from "gt-next";
import { enGB, uk } from "react-day-picker/locale";
import { CalendarDays } from "lucide-react";
import { Calendar } from "./ui/calendar";
import { Button } from "./ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";

export function LeagueDatePicker({
  value,
  onChange,
  disabled,
}: {
  value: Date;
  onChange: (date: Date) => void;
  disabled?: boolean;
}) {
  const locale = useLocale();
  const t = useTranslations();
  const [open, setOpen] = useState(false);
  return (
    <div className="space-y-2">
      <span
        id="league-start-label"
        className="text-xs font-medium text-muted-foreground"
      >
        {t("leagueUx.plannedStart")}
      </span>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          render={
            <Button
              type="button"
              variant="outline"
              disabled={disabled}
              aria-labelledby="league-start-label league-start-value"
              className="h-11 w-full justify-start font-normal"
            />
          }
        >
          <CalendarDays className="size-4 text-muted-foreground" />
          <span id="league-start-value">
            {value
              .toLocaleDateString(locale === "uk" ? "uk-UA" : "en-GB", {
                day: "2-digit",
                month: "2-digit",
                year: "numeric",
              })
              .replaceAll("/", ".")}
          </span>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-auto p-2">
          <Calendar
            mode="single"
            required
            selected={value}
            defaultMonth={value}
            locale={locale === "uk" ? uk : enGB}
            weekStartsOn={1}
            onSelect={(date) => {
              onChange(date);
              setOpen(false);
            }}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}
