"use client";

import {
  CloudRain,
  CloudSun,
  Snowflake,
  Sun,
  ThermometerSun,
} from "lucide-react";
import { useTranslations } from "gt-next";
import { WEATHER_RESULTS, weatherResult } from "@/domain/match-pregame";

const icons = [ThermometerSun, Sun, CloudSun, CloudRain, Snowflake];

export function MatchWeather({
  value,
  onChange,
}: {
  value?: number | null;
  onChange: (roll: number) => void;
}) {
  const t = useTranslations();
  const selected = weatherResult(value);
  return (
    <fieldset className="min-w-0 rounded-lg border bg-card">
      <legend className="sr-only">{t("leagueUx.reportWeather")}</legend>
      <div className="flex flex-wrap items-baseline justify-between gap-2 px-4 pt-4 sm:px-5">
        <h2 className="text-base font-semibold">
          {t("leagueUx.reportWeather")}{" "}
          <span className="ml-1 font-mono text-sm text-muted-foreground">
            2D6
          </span>
        </h2>
        <p className="text-xs text-muted-foreground">
          {t("leagueUx.reportWeatherRoll")}
        </p>
      </div>
      <div className="grid gap-1 p-3 sm:grid-cols-5 sm:p-4">
        {WEATHER_RESULTS.map((result, index) => {
          const Icon = icons[index];
          return (
            <label
              key={result.value}
              className={`relative flex min-w-0 cursor-pointer items-center gap-3 rounded-md px-3 py-3 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-primary sm:flex-col sm:gap-2 sm:text-center ${selected === result.value ? "bg-primary text-primary-foreground" : "hover:bg-secondary has-[:disabled]:cursor-default"}`}
            >
              <input
                type="radio"
                name="match-weather"
                value={result.value}
                checked={selected === result.value}
                onChange={() => onChange(result.value)}
                className="sr-only"
              />
              <span className="w-12 shrink-0 font-mono text-lg font-semibold tabular-nums sm:w-auto">
                {result.range}
              </span>
              <Icon aria-hidden="true" className="size-5 shrink-0" />
              <span className="text-sm font-medium">
                {t(`leagueUx.reportWeather${result.value}`)}
              </span>
            </label>
          );
        })}
      </div>
      <div className="border-t px-4 py-3 sm:px-5" aria-live="polite">
        <p className="text-sm leading-relaxed text-muted-foreground">
          {selected === null
            ? t("leagueUx.reportWeatherSelect")
            : t(`leagueUx.reportWeatherEffect${selected}`)}
        </p>
        <a
          href="https://bb-rules-g2p.pages.dev/en/rules/two-halves"
          target="_blank"
          rel="noreferrer"
          className="mt-2 inline-block text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground"
        >
          {t("leagueUx.reportWeatherRules")}
        </a>
      </div>
    </fieldset>
  );
}
