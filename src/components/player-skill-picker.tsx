"use client";

import { useDeferredValue, useState } from "react";
import { useTranslations } from "gt-next";
import { ArrowDown, ArrowUp, Plus, Search, X } from "lucide-react";
import { getRuleset, getSkill, skills, skillName } from "@/domain/catalog";
import {
  playerSkillCost,
  skillAccess,
  summarize,
  teamSaveIssues,
} from "@/domain/rules";
import type { Position, Team } from "@/domain/types";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { SkillBox } from "./skill-box";

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
  const [access, setAccess] = useState("all");
  const deferredSearch = useDeferredValue(search).trim().toLowerCase();
  const rules = getRuleset(team.rulesetId);
  const totals = summarize(team);
  const unit =
    rules.skillCurrency === "spp"
      ? t("spp")
      : rules.skillCurrency === "sp"
        ? t("sp")
        : "GP";
  const formatCost = (cost: number) =>
    rules.skillCurrency ? `${cost} ${unit}` : `${cost / 1000}k GP`;
  const cost = playerSkillCost(team, position, selected);
  const full = selected.length >= max;
  const baseIssues = teamSaveIssues(team);
  function nextTeam(next: string[]) {
    return {
      ...team,
      players: team.players.map((player) =>
        player.id === playerId ? { ...player, skills: next } : player,
      ),
    };
  }
  function blocked(next: string[]) {
    return teamSaveIssues(nextTeam(next)).find(
      (issue) =>
        !baseIssues.some(
          (existing) => JSON.stringify(existing) === JSON.stringify(issue),
        ),
    );
  }
  const available = skills.filter(
    (skill) =>
      skillAccess(position, skill.id) &&
      !position.skills.some((id) => id.split(":")[0] === skill.id) &&
      !selected.includes(skill.id) &&
      !(captain && skill.id === "pro") &&
      (access === "all" || skillAccess(position, skill.id) === access) &&
      skill.name.toLowerCase().includes(deferredSearch),
  );
  function move(index: number, direction: number) {
    const next = [...selected];
    [next[index], next[index + direction]] = [
      next[index + direction],
      next[index],
    ];
    onChange(next);
  }
  return (
    <section className="space-y-4" aria-label={t("addedSkills")}>
      <div className="rounded-xl border bg-secondary/40 p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold">{t("addedSkills")}</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              {t("advancementPlan")}
            </p>
          </div>
          <div className="shrink-0 text-right">
            <p className="font-mono text-sm font-semibold" aria-live="polite">
              {formatCost(cost)}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {selected.length} / {max}
            </p>
          </div>
        </div>
        <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
          {t("skillPickerHint")}
        </p>
        {rules.skillCurrency && (
          <p className="mt-2 text-xs font-medium" aria-live="polite">
            {t("teamSkillRemaining", {
              amount: formatCost(totals.budget.skillGold - totals.skills),
            })}
          </p>
        )}
      </div>
      {baseIssues.length > 0 && (
        <p
          role="status"
          className="rounded-lg border border-orange-500/25 bg-orange-500/5 p-3 text-xs text-muted-foreground"
        >
          {baseIssues
            .map((issue) => t(`issues.${issue.code}`, issue.values))
            .join(" ")}
        </p>
      )}
      <ol className="space-y-2" aria-label={t("advancementOrder")}>
        {selected.map((id, index) => {
          const incremental =
            playerSkillCost(team, position, selected.slice(0, index + 1)) -
            playerSkillCost(team, position, selected.slice(0, index));
          return (
            <li
              key={id}
              className="flex items-center gap-2 rounded-lg border bg-card p-2"
            >
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                {index + 1}
              </span>
              <div className="min-w-0 flex-1">
                <SkillBox id={id} added />
                <p className="mt-1 text-xs text-muted-foreground">
                  {t(skillAccess(position, id) ?? "primary")} ·{" "}
                  {formatCost(incremental)}
                  {getSkill(id)?.isElite ? ` · ${t("elite")}` : ""}
                </p>
              </div>
              <div className="flex shrink-0 flex-col sm:flex-row">
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-11"
                  disabled={index === 0}
                  onClick={() => move(index, -1)}
                  aria-label={`${t("moveSkillEarlier")} · ${skillName(id)}`}
                >
                  <ArrowUp className="size-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-11"
                  disabled={index === selected.length - 1}
                  onClick={() => move(index, 1)}
                  aria-label={`${t("moveSkillLater")} · ${skillName(id)}`}
                >
                  <ArrowDown className="size-4" />
                </Button>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="size-11 shrink-0"
                onClick={() =>
                  onChange(selected.filter((skill) => skill !== id))
                }
                aria-label={`${t("removeSkill")} · ${skillName(id)}`}
              >
                <X className="size-4" />
              </Button>
            </li>
          );
        })}
        {!selected.length && (
          <li className="rounded-lg border border-dashed px-4 py-5 text-center text-sm text-muted-foreground">
            {t("chooseFirstSkill")}
          </li>
        )}
      </ol>
      <div className="space-y-3 border-t pt-4">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold">{t("availableSkills")}</h3>
          <span className="text-xs text-muted-foreground" role="status">
            {full
              ? t("skillLimitReached")
              : t("nextAdvancement", { number: selected.length + 1 })}
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
        <div
          className="flex gap-2"
          role="group"
          aria-label={t("skillAccessFilter")}
        >
          {["all", "primary", "secondary"].map((value) => (
            <Button
              key={value}
              size="sm"
              className="h-11 flex-1"
              variant={access === value ? "default" : "outline"}
              aria-pressed={access === value}
              onClick={() => setAccess(value)}
            >
              {t(value === "all" ? "allSkills" : value)}
            </Button>
          ))}
        </div>
        <div
          className="grid gap-2 sm:grid-cols-2"
          aria-busy={search.trim().toLowerCase() !== deferredSearch}
        >
          {available.map((skill) => {
            const next = [...selected, skill.id];
            const issue = full ? undefined : blocked(next);
            const incremental = playerSkillCost(team, position, next) - cost;
            return (
              <div
                key={skill.id}
                className="flex items-start gap-2 rounded-lg border bg-card p-3"
              >
                <div className="min-w-0 flex-1">
                  <SkillBox id={skill.id} />
                  <p className="mt-2 text-xs text-muted-foreground">
                    {t(skillAccess(position, skill.id)!)}
                    {skill.isElite ? ` · ${t("elite")}` : ""}
                  </p>
                  <p className="mt-1 font-mono text-xs">
                    +{formatCost(incremental)}
                  </p>
                  {issue && (
                    <p className="mt-2 text-xs text-muted-foreground">
                      {t(`issues.${issue.code}`, issue.values)}
                    </p>
                  )}
                </div>
                <Button
                  variant="outline"
                  size="icon"
                  className="size-11 shrink-0"
                  disabled={full || !!issue}
                  onClick={() => {
                    if (!full && !blocked(next)) onChange(next);
                  }}
                  aria-label={`${t("addSkill")} · ${skillName(skill.id)}`}
                >
                  <Plus className="size-4" />
                </Button>
              </div>
            );
          })}
          {!available.length && (
            <p className="py-5 text-center text-sm text-muted-foreground sm:col-span-2">
              {t("noMatchingSkills")}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
