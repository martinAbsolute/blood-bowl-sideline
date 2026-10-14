"use client";
import { useState } from "react";
import { useFormatter, useLocale, useTranslations } from "next-intl";
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
  const format = useFormatter();
  const t = useTranslations();
  const [open, setOpen] = useState(false);
  return (
    <div className="min-w-0 space-y-2">
      <span
        id="league-start-label"
        className="block text-xs font-medium text-muted-foreground"
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
            {format.dateTime(
              new Date(
                Date.UTC(
                  value.getFullYear(),
                  value.getMonth(),
                  value.getDate(),
                ),
              ),
              "short",
              { timeZone: "UTC" },
            )}
          </span>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          className="w-auto max-w-[calc(100vw-2rem)] p-2"
        >
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
