"use client";

import { useState } from "react";
import Link from "next/link";
import { useTranslations } from "gt-next";
import { Check, ChevronDown, Search, Users } from "lucide-react";
import type { Team } from "@/domain/types";
import { getRoster, rosters } from "@/domain/catalog";
import { DEFAULT_LEAGUE_TREASURY } from "@/domain/league-rules";
import { summarize } from "@/domain/rules";
import { canEnrollTeam } from "@/lib/league-team-eligibility";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Skeleton } from "./ui/skeleton";
import { RosterIcon } from "./player-icon";
import { LeagueTeamIssues } from "./league-team-issues";
import { LeagueSelect } from "./league-field";
import { CreateTeamButton } from "./create-team-button";
import { Dialog, DialogTrigger } from "./dialog";

import {
  LeagueDialogBody,
  LeagueDialogContent,
  LeagueDialogFooter,
  LeagueDialogHeader,
} from "./league-dialog";

export function LeagueTeamPicker({
  teams,
  value,
  onChange,
  status,
  loadMore,
  excludeUuid,
  disabled,
  startingTreasury = DEFAULT_LEAGUE_TREASURY,
  leagueId,
  onOpenChange,
}: {
  teams: { team: Team; leagueExperienced?: boolean }[];
  value: string;
  onChange: (uuid: string) => void;
  status: string;
  loadMore: () => void;
  excludeUuid?: string;
  disabled?: boolean;
  startingTreasury?: number;
  leagueId?: string;
  onOpenChange?: (open: boolean) => void;
}) {
  const t = useTranslations();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(false);
  const [rosterId, setRosterId] = useState("human");
  const candidates = teams.filter(({ team }) => team.uuid !== excludeUuid);
  const selected = candidates.find(({ team }) => team.uuid === value);
  const eligible = selected && canEnrollTeam(selected, startingTreasury);
  const visible = candidates
    .filter(({ team }) =>
      `${team.name} ${getRoster(team.rosterId)?.name}`
        .toLocaleLowerCase()
        .includes(search.trim().toLocaleLowerCase()),
    )
    .sort(
      (a, b) =>
        Number(canEnrollTeam(b, startingTreasury)) -
        Number(canEnrollTeam(a, startingTreasury)),
    );
  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        onOpenChange?.(nextOpen);
      }}
    >
      <DialogTrigger
        render={
          <Button
            variant="outline"
            className="h-11 min-w-0 flex-1 justify-between gap-3 sm:min-w-64"
            disabled={disabled}
          />
        }
      >
        <span className="truncate">
          {eligible ? selected.team.name : t("leagueUi.chooseTeam")}
        </span>
        {eligible ? (
          <Check className="size-4 shrink-0" />
        ) : (
          <ChevronDown className="size-4 shrink-0" />
        )}
      </DialogTrigger>
      <LeagueDialogContent className="h-[min(90dvh,44rem)]">
        <LeagueDialogHeader
          title={t("leagueUi.chooseTeam")}
          description={t("leagueUx.pickerHint", {
            amount: startingTreasury.toLocaleString("uk-UA"),
          })}
          icon={<Users className="size-5" />}
        />
        <div className="shrink-0 px-5 pt-4">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-3 size-4 text-muted-foreground" />
            <Input
              aria-label={t("searchMyTeams")}
              placeholder={t("searchMyTeams")}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="h-10 pl-9"
            />
          </div>
        </div>
        <LeagueDialogBody className="space-y-3 pt-3">
          {status === "LoadingFirstPage" ? (
            <div role="status" aria-label={t("loading")} className="space-y-3">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-20 w-full" />
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              {visible.map((row) => {
                const { team, leagueExperienced } = row;
                const ready = canEnrollTeam(row, startingTreasury);
                return (
                  <div
                    key={team.uuid}
                    className={`overflow-hidden rounded-lg border ${value === team.uuid && ready ? "border-primary ring-2 ring-primary/30" : "border-border"}`}
                  >
                    <button
                      type="button"
                      aria-label={team.name}
                      aria-pressed={ready && value === team.uuid}
                      disabled={!ready || disabled}
                      onClick={() => {
                        onChange(team.uuid);
                        setOpen(false);
                        onOpenChange?.(false);
                      }}
                      className="flex w-full items-center gap-3 bg-primary px-3 py-3 text-left text-primary-foreground transition-colors enabled:hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <span className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-white/90">
                        <RosterIcon
                          rosterId={team.rosterId}
                          className="size-9"
                        />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="display-font block truncate text-lg leading-6">
                          {team.name}
                        </span>
                        <span className="mt-0.5 block truncate text-xs text-primary-foreground/75">
                          {getRoster(team.rosterId)?.name} ·{" "}
                          {team.players.length} {t("players")} ·{" "}
                          {(summarize(team).teamGold / 1000).toLocaleString(
                            "uk-UA",
                          )}
                          k
                        </span>
                      </span>
                      {ready && (
                        <span
                          className={`flex size-6 shrink-0 items-center justify-center rounded-full border ${value === team.uuid ? "border-lime-200 bg-lime-200 text-primary" : "border-white/40 text-white"}`}
                        >
                          <Check className="size-3.5" />
                        </span>
                      )}
                    </button>
                    {!ready && (
                      <div className="space-y-2 border-t bg-secondary/20 px-4 py-3">
                        <LeagueTeamIssues
                          team={team}
                          leagueExperienced={leagueExperienced}
                          startingTreasury={startingTreasury}
                        />
                        <Link
                          href={`/teams/${team.uuid}${leagueId ? `?league=${encodeURIComponent(leagueId)}` : ""}`}
                          className="inline-flex min-h-8 items-center text-xs font-medium text-primary hover:underline"
                        >
                          {t("openTeam")}
                        </Link>
                      </div>
                    )}
                  </div>
                );
              })}
              {!visible.length && (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  {t(search ? "noMatchingTeams" : "noTeams")}
                </p>
              )}
            </div>
          )}
          {(status === "CanLoadMore" || status === "LoadingMore") && (
            <Button
              variant="outline"
              disabled={status === "LoadingMore"}
              onClick={loadMore}
            >
              {t(status === "LoadingMore" ? "loading" : "loadMore")}
            </Button>
          )}
        </LeagueDialogBody>
        {leagueId && (
          <LeagueDialogFooter className="block space-y-3">
            {creating ? (
              <>
                <label
                  className="block text-sm font-medium"
                  htmlFor="league-roster"
                >
                  {t("leagueUx.chooseRoster")}
                </label>
                <div className="flex flex-wrap gap-3">
                  <LeagueSelect
                    id="league-roster"
                    value={rosterId}
                    onChange={(event) => setRosterId(event.target.value)}
                    wrapperClassName="min-w-0 flex-1"
                  >
                    {rosters.map((roster) => (
                      <option key={roster.id} value={roster.id}>
                        {roster.name}
                      </option>
                    ))}
                  </LeagueSelect>
                  <CreateTeamButton rosterId={rosterId} leagueId={leagueId} />
                </div>
                <p className="text-xs text-muted-foreground">
                  {t("leagueUx.buildThenJoin")}
                </p>
              </>
            ) : (
              <Button
                variant="secondary"
                className="h-11 w-full"
                onClick={() => setCreating(true)}
              >
                {t("leagueUx.createForLeague")}
              </Button>
            )}
          </LeagueDialogFooter>
        )}
      </LeagueDialogContent>
    </Dialog>
  );
}
