"use client";

import { useState, type CSSProperties, type ReactNode } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import {
  Archive,
  Check,
  CloudCheck,
  CloudOff,
  FileText,
  LoaderCircle,
  HeartPulse,
  HandCoins,
  Megaphone,
  PencilLine,
  RotateCcw,
  Star,
  Users,
  LockKeyhole,
  Trophy,
  CircleAlert,
} from "lucide-react";
import { getRoster, getRuleset, inducements } from "@/domain/catalog";
import { summarize, validateTeam } from "@/domain/rules";
import type { Team } from "@/domain/types";
import { rosterColors } from "@/lib/roster-colors";
import { lineupPhoto } from "@/lib/lineup-photo";
import { TeamLineup } from "./team-lineup";
import { PlayerIcon, RosterIcon } from "./player-icon";
import { Tooltip, TooltipTrigger, TooltipContent } from "./ui/tooltip";
import styles from "./team-card.module.css";

const emptyPhoto = lineupPhoto(5);

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
  const t = useTranslations();
  const roster = getRoster(team.rosterId);
  const totals = summarize(team);
  const ready = selection ? !selection.disabled : validateTeam(team).valid;
  const StatusIcon = leagueLocked
    ? LockKeyhole
    : leagueExperienced
      ? Trophy
      : selection?.disabled
        ? CircleAlert
        : ready
          ? Check
          : PencilLine;
  const SaveIcon = archived
    ? Archive
    : saveState === "cloud"
      ? CloudCheck
      : saveState === "device"
        ? FileText
        : saveState === "pending"
          ? LoaderCircle
          : CloudOff;
  const statusLabel = t(
    leagueLocked
      ? "leagueUi.teamLocked"
      : leagueExperienced
        ? "leagueUi.experiencedTeam"
        : selection?.disabled
          ? "leagueUi.ineligibleTeam"
          : ready
            ? "teamCard.ready"
            : "draft",
  );
  const sidelineStaff = team.staff.assistantCoaches + team.staff.cheerleaders + team.staff.dedicatedFans;
  const inducementCount = Object.values(team.inducements).reduce((sum, count) => sum + count, 0);
  const staffBreakdown = [
    `${t("assistantCoaches")}: ${team.staff.assistantCoaches}`,
    `${t("cheerleaders")}: ${team.staff.cheerleaders}`,
    `${t("dedicatedFans")}: ${team.staff.dedicatedFans}`,
  ].join("\n");
  const inducementBreakdown = Object.entries(team.inducements)
    .filter(([, count]) => count > 0)
    .map(([id, count]) => `${inducements.find((item) => item.id === id)?.name ?? id}: ${count}`)
    .join("\n");
  const staffTooltip = sidelineStaff ? `${t("staff")}\n${staffBreakdown}` : `${t("staff")}: ${t("teamCard.none")}`;
  const inducementTooltip = inducementCount
    ? `${t("inducements")}\n${inducementBreakdown}`
    : `${t("inducements")}: ${t("teamCard.none")}`;
  return (
    <article
      className={styles.card}
      data-disabled={selection?.disabled || undefined}
      data-selected={selection?.selected || undefined}
      style={{ "--roster": rosterColors[team.rosterId] ?? "#52676b" } as CSSProperties}
    >
      <div className={styles.cardLink}>
        <div className={styles.identity}>
          <span className={styles.status} data-team-status>
            <StatusIcon size={12} aria-hidden="true" />
            <span>{statusLabel}</span>
          </span>
        </div>
        <div className={styles.crest}>
          <RosterIcon rosterId={team.rosterId} className="size-12" />
        </div>
        <div className={styles.heading}>
          <h2 className="display-font">
            {selection ? (
              <button
                type="button"
                className={styles.teamLink}
                disabled={selection.disabled}
                aria-pressed={selection.selected}
                aria-label={team.name || t("untitled")}
                onClick={selection.onSelect}
              >
                {team.name || t("untitled")}
              </button>
            ) : href ? (
              <Link href={href} prefetch className={styles.teamLink}>
                {team.name || t("untitled")}
              </Link>
            ) : (
              team.name || t("untitled")
            )}
          </h2>
        </div>
        <p className={styles.ruleset}>
          <span>{getRuleset(team.rulesetId).name}</span>
          <span className={styles.rosterLabel}>
            <i aria-hidden="true" />
            <span className="sr-only"> · </span>
            {roster?.name}
          </span>
        </p>
        <div className={styles.squad}>
          <span className={styles.halfwayLine} aria-hidden="true" />
          {team.players.length + team.stars.length ? (
            <TeamLineup team={team} />
          ) : (
            <div className={styles.emptyLineup} aria-label={t("teamCard.emptyLineup")}>
              <div
                aria-hidden="true"
                style={{ position: "relative", width: emptyPhoto[0].width, maxWidth: "100%", height: 62 }}
              >
                {Array.from({ length: 5 }, (_, index) => (
                  <span
                    key={index}
                    style={{
                      position: "absolute",
                      left: emptyPhoto[index].left,
                      top: emptyPhoto[index].top,
                      zIndex: emptyPhoto[index].zIndex,
                    }}
                  >
                    <PlayerIcon
                      positionId={roster?.players[index % roster.players.length]?.id ?? ""}
                      className="size-9"
                    />
                  </span>
                ))}
              </div>
              <span>{t("teamCard.buildLineup")}</span>
            </div>
          )}
          <span className={styles.squadCaption} aria-label={`${t("players")}: ${totals.playerCount}`}>
            <Users size={13} aria-hidden="true" />
            {totals.playerCount}
            {team.stars.length ? (
              <span title={t("starPlayers")}>
                <Star size={11} />
                {team.stars.length}
              </span>
            ) : null}
          </span>
        </div>
        <div className={styles.support} role="group" aria-label={t("teamCard.support")}>
          <SupportMetric
            label={`${t("rerolls")}: ${team.staff.rerolls}`}
            icon={<RotateCcw size={16} />}
            value={team.staff.rerolls}
          />
          <SupportMetric
            label={`${t("apothecary")}: ${t(team.staff.apothecary ? "yes" : "no")}`}
            icon={<HeartPulse size={16} />}
            value={t(team.staff.apothecary ? "yes" : "no")}
          />
          <SupportMetric label={staffTooltip} icon={<Megaphone size={16} />} value={sidelineStaff} />
          <SupportMetric label={inducementTooltip} icon={<HandCoins size={16} />} value={inducementCount} />
        </div>
        <div className={styles.economy}>
          <span>
            {t("teamCard.teamValue")} <strong>{(totals.teamGold / 1000).toLocaleString("en")}k</strong>
          </span>
          <span
            data-zero={totals.remaining === 0}
            data-negative={totals.remaining < 0}
            data-positive={totals.remaining > 0}
          >
            {t("remaining")} <strong>{(totals.remaining / 1000).toLocaleString("en")}k</strong>
          </span>
        </div>
        {footer ? (
          <footer className={styles.customFooter}>{footer}</footer>
        ) : saveState || selection || action ? (
          <footer className={styles.cardFooter}>
            {saveState && (
              <span role="status" className={styles.saveStatus}>
                <SaveIcon
                  size={13}
                  aria-hidden="true"
                  className={saveState === "pending" ? "animate-spin" : undefined}
                />
                <span>
                  {t(
                    archived
                      ? "archived"
                      : saveState === "cloud"
                        ? "savedCloud"
                        : saveState === "device"
                          ? "teamCard.localDraft"
                          : saveState === "pending"
                            ? "saving"
                            : "saveStatusError",
                  )}
                </span>
              </span>
            )}
            {selection && (
              <span className={styles.selectionStatus}>
                <span>{t(selection.selected ? "leagueUi.selectedTeam" : "leagueUi.chooseTeam")}</span>
                {selection.selected && <Check size={14} aria-hidden="true" />}
              </span>
            )}
            {action && <div className={styles.actions}>{action}</div>}
          </footer>
        ) : null}
      </div>
    </article>
  );
}

function SupportMetric({ label, icon, value }: { label: string; icon: ReactNode; value: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <Tooltip open={open} onOpenChange={setOpen}>
      <TooltipTrigger className={styles.metric} aria-label={label} onClick={() => setOpen(!open)}>
        <span aria-hidden="true">{icon}</span>
        <strong aria-hidden="true">{value}</strong>
      </TooltipTrigger>
      <TooltipContent className="whitespace-pre-line leading-5">{label}</TooltipContent>
    </Tooltip>
  );
}
