"use client";

import { useDeferredValue, useId, useRef, useState } from "react";
import { useTranslations } from "gt-next";
import { Check, Plus, Search, X } from "lucide-react";
import {
  categories,
  getRuleset,
  skills,
  skillName,
  sortSkillIds,
} from "@/domain/catalog";
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
  const [category, setCategory] = useState("all");
  const listRef = useRef<HTMLUListElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const statusId = useId();
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
      (category === "all" || skillsById.get(id)?.category === category) &&
      skillName(id).toLowerCase().includes(deferredSearch),
  );
  const availableCategories = Object.entries(categories).filter(
    ([, code]) =>
      position.primarySkills.includes(code) ||
      position.secondarySkills.includes(code),
  );

  return (
    <section
      className="player-skill-browser"
      aria-label={t("playerModal.browseSkills")}
    >
      <div className="player-skill-toolbar">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h3 className="text-sm font-semibold">
            {t("playerModal.browseSkills")}
          </h3>
          <span className="font-mono text-xs text-muted-foreground">
            {available.length}
          </span>
        </div>
        <div className="relative">
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            ref={searchRef}
            className="h-11 bg-card pl-9 pr-11 sm:h-8 sm:pr-8"
            maxLength={80}
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              if (listRef.current) listRef.current.scrollTop = 0;
            }}
            placeholder={t("searchSkills")}
            aria-label={t("searchSkills")}
          />
          {search && (
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-0 top-0 size-11 sm:size-8"
              aria-label={t("playerModal.clearSearch")}
              onClick={() => {
                setSearch("");
                searchRef.current?.focus();
              }}
            >
              <X className="size-4" />
            </Button>
          )}
        </div>
        <div
          className="mt-3 flex flex-wrap gap-1.5"
          role="group"
          aria-label={t("playerModal.filterCategory")}
        >
          {[["all", ""], ...availableCategories].map(([id]) => (
            <button
              key={id}
              type="button"
              aria-pressed={category === id}
              className={`player-skill-filter ${id !== "all" ? `skill-${id}` : ""}`}
              onClick={() => {
                setCategory(id);
                if (listRef.current) listRef.current.scrollTop = 0;
              }}
            >
              {id !== "all" && (
                <span className="player-skill-dot" aria-hidden="true" />
              )}
              {t(
                id === "all"
                  ? "playerModal.allSkills"
                  : `skillCategories.${id}`,
              )}
            </button>
          ))}
        </div>
        <p
          id={statusId}
          data-limit-reached={full ? "" : undefined}
          role="status"
          className="mt-3 text-xs leading-relaxed text-muted-foreground"
        >
          {t(full ? "skillLimitReached" : "playerModal.skillHint")}
        </p>
      </div>
      <ul
        ref={listRef}
        className="player-skill-results divide-y"
        aria-label={t("playerModal.browseSkills")}
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
            <li
              key={id}
              className={`flex items-center gap-3 px-4 py-2.5 sm:py-1.5 ${chosen ? "bg-primary/5" : ""}`}
            >
              <div className="min-w-0 flex-1">
                <SkillBox id={id} added={chosen} />
                <p className="mt-1 text-xs text-muted-foreground">
                  {t(skillAccess(position, id)!)}
                  {skill.isElite ? ` · ${t("elite")}` : ""}
                </p>
                {issue && (
                  <p
                    id={`${statusId}-${id}`}
                    className="mt-1 text-xs text-muted-foreground"
                  >
                    {t(`issues.${issue.code}`, issue.values)}
                  </p>
                )}
              </div>
              <span className="shrink-0 font-mono text-xs text-muted-foreground">
                {chosen ? "−" : "+"}
                {formatCost(Math.abs(delta))}
              </span>
              <Button
                variant={chosen ? "default" : "outline"}
                size="icon"
                className="group size-11 shrink-0 sm:size-8"
                disabled={!chosen && (full || !!issue)}
                aria-pressed={chosen}
                aria-describedby={
                  !chosen
                    ? issue
                      ? `${statusId}-${id}`
                      : full
                        ? statusId
                        : undefined
                    : undefined
                }
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
                  <Plus className="size-4" />
                )}
              </Button>
            </li>
          );
        })}
        {!available.length && (
          <li className="space-y-3 px-4 py-8 text-center text-sm text-muted-foreground">
            <Search className="mx-auto size-5" aria-hidden="true" />
            {t("noMatchingSkills")}
            <div>
              <Button
                variant="outline"
                onClick={() => {
                  setSearch("");
                  setCategory("all");
                  searchRef.current?.focus();
                }}
              >
                {t("playerModal.resetFilters")}
              </Button>
            </div>
          </li>
        )}
      </ul>
    </section>
  );
}
