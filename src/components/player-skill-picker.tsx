"use client";

import { useDeferredValue, useState } from "react";
import { useTranslations } from "gt-next";
import { Check, Search, X } from "lucide-react";
import { getRuleset, skills, skillName, sortSkillIds } from "@/domain/catalog";
import { playerSkillCost, skillAccess, teamSaveIssues } from "@/domain/rules";
import type { Position, Team } from "@/domain/types";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { SkillBox } from "./skill-box";

const orderedSkills = sortSkillIds(skills.map((skill) => skill.id));
const skillsById = new Map(skills.map((skill) => [skill.id, skill]));

export function PlayerSkillPicker({
  team,
  playerId,
  position,
  selected,
  max,
  captain,
  onChange,
}: {
  team: Team;
  playerId: string;
  position: Position;
  selected: string[];
  max: number;
  captain: boolean;
  onChange: (skills: string[]) => void;
}) {
  const t = useTranslations();
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search).trim().toLowerCase();
  const rules = getRuleset(team.rulesetId);
  const unit = rules.skillCurrency ? t(rules.skillCurrency) : "GP";
  const formatCost = (cost: number) =>
    rules.skillCurrency ? `${cost} ${unit}` : `${cost / 1000}k GP`;
  const cost = playerSkillCost(team, position, selected);
  const full = selected.length >= max;
  const baseIssues = teamSaveIssues(team);
  function blocked(next: string[]) {
    return teamSaveIssues({
      ...team,
      players: team.players.map((player) =>
        player.id === playerId ? { ...player, skills: next } : player,
      ),
    }).find(
      (issue) =>
        !baseIssues.some(
          (existing) => JSON.stringify(existing) === JSON.stringify(issue),
        ),
    );
  }
  const available = orderedSkills.filter(
    (id) =>
      skillAccess(position, id) &&
      !position.skills.some((base) => base.split(":")[0] === id) &&
      !(captain && id === "pro") &&
      skillName(id).toLowerCase().includes(deferredSearch),
  );

  return (
    <section className="space-y-3" aria-label={t("addedSkills")}>
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold">{t("addedSkills")}</h3>
        <span className="text-xs text-muted-foreground" role="status">
          {full ? t("skillLimitReached") : `${selected.length} / ${max}`}
        </span>
      </div>
      <div className="relative">
        <Search
          aria-hidden="true"
          className="pointer-events-none absolute left-3 top-3.5 size-4 text-muted-foreground"
        />
        <Input
          className="h-11 pl-9"
          maxLength={80}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder={t("searchSkills")}
          aria-label={t("searchSkills")}
        />
      </div>
      <ul
        className="divide-y rounded-lg border"
        aria-busy={search.trim().toLowerCase() !== deferredSearch}
      >
        {available.map((id) => {
          const skill = skillsById.get(id)!;
          const chosen = selected.includes(id);
          const next = sortSkillIds(
            chosen
              ? selected.filter((value) => value !== id)
              : [...selected, id],
          );
          const issue = chosen || full ? undefined : blocked(next);
          const delta = playerSkillCost(team, position, next) - cost;
          return (
            <li key={id} className="flex items-center gap-3 px-3 py-2">
              <div className="min-w-0 flex-1">
                <SkillBox id={id} added={chosen} />
                <p className="mt-1 text-xs text-muted-foreground">
                  {t(skillAccess(position, id)!)}
                  {skill.isElite ? ` · ${t("elite")}` : ""}
                  {` · ${formatCost(Math.abs(delta))}`}
                </p>
                {issue && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    {t(`issues.${issue.code}`, issue.values)}
                  </p>
                )}
              </div>
              <Button
                variant={chosen ? "default" : "outline"}
                size="icon"
                className="group size-11 shrink-0"
                disabled={!chosen && (full || !!issue)}
                aria-pressed={chosen}
                aria-label={`${t(chosen ? "removeSkill" : "addSkill")} · ${skillName(id)}`}
                onClick={() => {
                  if (chosen || (!full && !blocked(next))) onChange(next);
                }}
              >
                {chosen ? (
                  <>
                    <Check className="size-4 group-hover:hidden" />
                    <X className="hidden size-4 group-hover:block" />
                  </>
                ) : (
                  <span
                    aria-hidden="true"
                    className="size-4 rounded-sm border border-current"
                  />
                )}
              </Button>
            </li>
          );
        })}
        {!available.length && (
          <li className="px-3 py-5 text-center text-sm text-muted-foreground">
            {t("noMatchingSkills")}
          </li>
        )}
      </ul>
    </section>
  );
}
