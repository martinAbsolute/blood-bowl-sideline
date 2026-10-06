"use client";
import { useRouter } from "next/navigation";
import { useTranslations } from "gt-next";
import { rulesets } from "@/domain/catalog";
import type { RulesetId } from "@/domain/types";
import { EditorSelect } from "./editor-select";

export function RosterRulesetPicker({ rulesetId }: { rulesetId: RulesetId }) {
  const t = useTranslations();
  const router = useRouter();
  return (
    <label className="flex w-full flex-col gap-1 text-xs sm:max-w-80">
      <span className="font-medium text-muted-foreground">{t("ruleset")}</span>
      <EditorSelect
        value={rulesetId}
        onChange={(event) => {
          const url = new URL(window.location.href);
          if (event.target.value === "bb2025-default")
            url.searchParams.delete("ruleset");
          else url.searchParams.set("ruleset", event.target.value);
          router.replace(`${url.pathname}${url.search}${url.hash}`, {
            scroll: false,
          });
        }}
        className="h-11 sm:h-9"
      >
        {rulesets.map((rules) => (
          <option key={rules.id} value={rules.id}>
            {rules.name}
          </option>
        ))}
      </EditorSelect>
    </label>
  );
}
