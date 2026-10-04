"use client";

import { useDeferredValue, useRef, useState } from "react";
import { useTranslations } from "gt-next";
import { Check, LockKeyhole, Plus, Search, X } from "lucide-react";
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
import { RuleHelp } from "./rule-help";

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
        <p role="status" className="sr-only">
          {full ? t("skillLimitReached") : ""}
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
          const canReplace =
            issue?.code === "starSkills" &&
            selected.length === 1 &&
            skillAccess(position, id) === "primary" &&
            !blocked([id]);
          const restriction = chosen
            ? undefined
            : full
              ? `${t("skillLimitReached")} ${t("playerModal.makeRoom")}`
              : canReplace
                ? t("playerModal.replaceSkillHint", {
                    current: skillName(selected[0]),
                    next: skillName(id),
                  })
                : issue?.code === "starSkills" &&
                    skillAccess(position, id) === "secondary"
                  ? t("playerModal.starSecondaryHint", { skill: skillName(id) })
                  : issue
                    ? t(`issues.${issue.code}`, issue.values)
                    : undefined;
          const delta = playerSkillCost(team, position, next) - cost;
          return (
            <li
              key={id}
              data-skill-row={id}
              tabIndex={-1}
              className={`flex items-center gap-3 px-4 py-2.5 outline-none sm:py-1.5 ${chosen ? "bg-primary/5" : ""}`}
            >
              <div className="min-w-0 flex-1">
                <SkillBox id={id} added={chosen} />
                <p className="mt-1 text-xs text-muted-foreground">
                  {t(skillAccess(position, id)!)}
                  {skill.isElite ? ` · ${t("elite")}` : ""}
                </p>
              </div>
              <span className="shrink-0 font-mono text-xs text-muted-foreground">
                {chosen ? "−" : "+"}
                {formatCost(Math.abs(delta))}
              </span>
              {restriction ? (
                <RuleHelp
                  title={skillName(id)}
                  meta={t("playerModal.unavailable")}
                  description={restriction}
                  action={
                    canReplace
                      ? {
                          label: t("playerModal.replaceSkill", {
                            skill: skillName(id),
                          }),
                          onClick: () => {
                            if (!blocked([id])) onChange([id]);
                          },
                          finalFocus: () =>
                            listRef.current?.querySelector<HTMLElement>(
                              `[data-skill-row="${id}"]`,
                            ) ?? null,
                        }
                      : undefined
                  }
                  label={`${t("playerModal.unavailable")} · ${skillName(id)}`}
                  className="flex size-11 shrink-0 items-center justify-center rounded-md border border-dashed text-muted-foreground hover:bg-secondary hover:text-foreground sm:size-8"
                >
                  <LockKeyhole aria-hidden="true" className="size-4" />
                </RuleHelp>
              ) : (
                <Button
                  variant={chosen ? "default" : "outline"}
                  size="icon"
                  className="group size-11 shrink-0 sm:size-8"
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
                    <Plus className="size-4" />
                  )}
                </Button>
              )}
            </li>
          );
        })}
        {!available.length && (
          <li className="flex flex-col items-center gap-4 px-4 py-8 text-center text-sm text-muted-foreground">
            <div className="space-y-2">
              <Search className="mx-auto size-5" aria-hidden="true" />
              <p>{t("noMatchingSkills")}</p>
            </div>
            <Button
              variant="outline"
              className="h-11 sm:h-8"
              onClick={() => {
                setSearch("");
                setCategory("all");
                searchRef.current?.focus();
              }}
            >
              {t("playerModal.showAllSkills")}
            </Button>
          </li>
        )}
      </ul>
    </section>
  );
}
