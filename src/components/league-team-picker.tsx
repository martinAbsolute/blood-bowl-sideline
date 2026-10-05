"use client";

import { useState } from "react";
import Link from "next/link";
import { useTranslations } from "gt-next";
import { Check, ChevronDown, Search } from "lucide-react";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "./dialog";

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
    <Dialog open={open} onOpenChange={setOpen}>
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
      <DialogContent className="max-h-[90svh] gap-4 overflow-y-auto p-5 sm:max-w-xl sm:p-6">
        <DialogHeader>
          <DialogTitle>{t("leagueUi.chooseTeam")}</DialogTitle>
          <DialogDescription>
            {t("leagueUx.pickerHint", {
              amount: startingTreasury.toLocaleString("uk-UA"),
            })}
          </DialogDescription>
        </DialogHeader>
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
                  className={`overflow-hidden rounded-xl border ${value === team.uuid && ready ? "border-primary bg-primary/5" : "bg-card"}`}
                >
                  <button
                    type="button"
                    aria-label={team.name}
                    aria-pressed={ready && value === team.uuid}
                    disabled={!ready || disabled}
                    onClick={() => {
                      onChange(team.uuid);
                      setOpen(false);
                    }}
                    className="flex w-full items-center gap-3 p-4 text-left transition-colors enabled:hover:bg-secondary/50 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <RosterIcon
                      rosterId={team.rosterId}
                      className="size-10 shrink-0"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block break-words font-semibold">
                        {team.name}
                      </span>
                      <span className="mt-1 block text-xs text-muted-foreground">
                        {getRoster(team.rosterId)?.name} · {team.players.length}{" "}
                        {t("players")} ·{" "}
                        {(summarize(team).teamGold / 1000).toLocaleString(
                          "uk-UA",
                        )}
                        k
                      </span>
                    </span>
                    {ready && (
                      <span
                        className={`flex size-6 shrink-0 items-center justify-center rounded-full border ${value === team.uuid ? "border-primary bg-primary text-primary-foreground" : "text-muted-foreground"}`}
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
        {leagueId && (
          <div className="space-y-3 border-t pt-4">
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
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
