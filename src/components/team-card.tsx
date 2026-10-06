"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { useTranslations } from "gt-next";
import {
  ArrowUpRight,
  Check,
  CloudCheck,
  CloudOff,
  FileText,
  LoaderCircle,
} from "lucide-react";
import { getRoster, getRuleset } from "@/domain/catalog";
import { summarize, validateTeam } from "@/domain/rules";
import type { Team } from "@/domain/types";
import { cn } from "@/lib/utils";
import { Card } from "./ui/card";
import { RosterIcon } from "./player-icon";
import { TeamLineup } from "./team-lineup";

export function TeamCard({
  team,
  href,
  action,
  archived,
  saveState,
  selection,
  footer,
  leagueLocked,
  leagueExperienced,
}: {
  team: Team;
  href?: string;
  action?: ReactNode;
  archived?: boolean;
  saveState?: "cloud" | "device" | "pending" | "error";
  selection?: { disabled: boolean; selected: boolean; onSelect: () => void };
  footer?: ReactNode;
  leagueLocked?: boolean;
  leagueExperienced?: boolean;
}) {
  const t = useTranslations(),
    totals = summarize(team),
    legal = selection ? !selection.disabled : validateTeam(team).valid;
  const content = (
    <>
      <div className="relative overflow-hidden bg-primary px-5 pb-4 pt-4 text-primary-foreground">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-6 -top-6 size-40 rounded-full border-[24px] border-white/5"
        />
        <div className="relative mb-4 flex items-center justify-between gap-3">
          <span className="text-xs font-medium text-white/75">
            {getRoster(team.rosterId)?.name}
          </span>
          <div className="flex shrink-0 items-center gap-3">
            <span
              className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${legal && !archived ? "bg-lime-200 text-primary" : "bg-white/15 text-white"}`}
            >
              {t(
                leagueLocked
                  ? "leagueUi.teamLocked"
                  : leagueExperienced
                    ? "leagueUi.experiencedTeam"
                    : archived
                      ? "archived"
                      : selection?.disabled
                        ? "leagueUi.ineligibleTeam"
                        : legal
                          ? "ready"
                          : "draft",
              )}
            </span>
            {href && !selection && (
              <ArrowUpRight
                aria-hidden="true"
                className="size-4 shrink-0 text-white transition-transform motion-safe:group-hover:translate-x-0.5 motion-safe:group-hover:-translate-y-0.5"
              />
            )}
          </div>
        </div>
        <div className="relative flex items-start gap-4">
          <span className="flex size-16 shrink-0 items-center justify-center rounded-2xl bg-white/15 shadow-sm">
            <RosterIcon rosterId={team.rosterId} className="size-12" />
          </span>
          <div className="min-w-0 flex-1">
            <h2
              className="display-font line-clamp-2 break-words text-2xl leading-7"
              title={team.name}
            >
              {team.name || t("untitled")}
            </h2>
            {saveState && <TeamLineup team={team} />}
          </div>
        </div>
      </div>
      <div className="space-y-3 px-5 py-4">
        <p className="text-xs font-medium text-muted-foreground">
          {getRuleset(team.rulesetId).name}
        </p>
        <dl className="grid grid-cols-3 divide-x rounded-lg border bg-secondary/25 py-3 text-center">
          <div>
            <dt className="text-[10px] text-muted-foreground">
              {t("players")}
            </dt>
            <dd className="mt-1 font-mono text-base font-semibold">
              {totals.playerCount}
              <span className="text-xs font-normal text-muted-foreground">
                {" "}
                / 16
              </span>
            </dd>
          </div>
          <div>
            <dt className="text-[10px] text-muted-foreground">
              {t("teamValue")}
            </dt>
            <dd className="mt-1 font-mono text-base font-semibold">
              {totals.teamGold / 1000}k
            </dd>
          </div>
          <div>
            <dt className="text-[10px] text-muted-foreground">
              {t("remaining")}
            </dt>
            <dd
              className={`mt-1 font-mono text-base font-semibold ${totals.remaining < 0 ? "text-destructive" : "text-primary"}`}
            >
              {totals.remaining / 1000}k
            </dd>
          </div>
        </dl>
        {selection && (
          <div className="flex items-center justify-between text-xs font-semibold text-primary">
            <span>
              {t(
                selection.selected
                  ? "leagueUi.selectedTeam"
                  : "leagueUi.chooseTeam",
              )}
            </span>
            {selection.selected && <Check className="size-4" />}
          </div>
        )}
      </div>
    </>
  );
  const SaveIcon =
    saveState === "cloud"
      ? CloudCheck
      : saveState === "device"
        ? FileText
        : saveState === "pending"
          ? LoaderCircle
          : CloudOff;
  return (
    <article className="min-w-0">
      <Card
        className={cn(
          "group min-w-0 gap-0 rounded-2xl py-0 shadow-sm transition-shadow",
          selection?.disabled ? "grayscale" : "hover:shadow-lg",
          selection?.selected && "ring-2 ring-primary",
        )}
      >
        {selection ? (
          <button
            type="button"
            disabled={selection.disabled}
            aria-pressed={selection.selected}
            aria-label={team.name || t("untitled")}
            onClick={selection.onSelect}
            className="block w-full flex-1 text-left outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-55"
          >
            {content}
          </button>
        ) : href ? (
          <Link
            href={href}
            prefetch
            className="block flex-1 outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
          >
            {content}
          </Link>
        ) : (
          <div className="flex-1 opacity-75">{content}</div>
        )}
        {footer ? (
          <footer className="border-t bg-secondary/15 px-5 py-3">
            {footer}
          </footer>
        ) : saveState ? (
          <footer className="flex min-h-14 items-center border-t bg-secondary/15 px-5 py-2 [&>div]:w-full [&>div>button]:ml-auto">
            <div className="flex items-center gap-2">
              <span
                role="status"
                className="inline-flex items-center gap-1.5 text-xs text-muted-foreground"
              >
                <SaveIcon
                  className={`size-3.5 ${saveState === "pending" ? "animate-spin" : ""}`}
                />
                {t(
                  saveState === "cloud"
                    ? "savedCloud"
                    : saveState === "device"
                      ? "savedInDrafts"
                      : saveState === "pending"
                        ? "saving"
                        : "saveStatusError",
                )}
              </span>
              {action}
            </div>
          </footer>
        ) : null}
      </Card>
    </article>
  );
}
