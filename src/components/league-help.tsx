"use client";

import { useTranslations } from "next-intl";
import { RuleHelp } from "./rule-help";

export function LeagueHelp({
  stat,
  profile = false,
  label: shortLabel,
}: {
  stat: string;
  profile?: boolean;
  label?: string;
}) {
  const t = useTranslations();
  const label =
    shortLabel ?? (profile ? stat.toUpperCase() : t(`leagueUi.stats.${stat}`));
  return (
    <RuleHelp
      title={label}
      description={t(
        profile
          ? `leagueUx.profileHelp.${stat}`
          : `leagueUi.statDescriptions.${stat}`,
      )}
      className="inline-flex min-h-8 items-center justify-center border-b border-dotted border-muted-foreground/40 font-mono text-xs font-medium"
    >
      {label}
    </RuleHelp>
  );
}
