"use client";

import { LibraryCardsLoading } from "./loading-layouts";

import { useState } from "react";
import Link from "next/link";
import { useTranslations } from "gt-next";
import { Check, Search } from "lucide-react";
import type { Team } from "@/domain/types";
import { canEnrollTeam } from "@/lib/league-team-eligibility";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { TeamCard } from "./team-card";
import { LeagueTeamIssues } from "./league-team-issues";
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
}: {
  teams: { team: Team; leagueExperienced?: boolean }[];
  value: string;
  onChange: (uuid: string) => void;
  status: string;
  loadMore: () => void;
  excludeUuid?: string;
  disabled?: boolean;
}) {
  const t = useTranslations();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const candidates = teams.filter(({ team }) => team.uuid !== excludeUuid);
  const selected = candidates.find(({ team }) => team.uuid === value);
  const eligible = selected && canEnrollTeam(selected);
  const visible = candidates.filter(({ team }) =>
    team.name.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()),
  );
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button
            variant="outline"
            className="h-11 min-w-0 justify-between gap-3"
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
          <Search className="size-4 shrink-0" />
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[90svh] overflow-y-auto p-5 sm:max-w-5xl">
        <DialogHeader>
          <DialogTitle>{t("leagueUi.chooseTeam")}</DialogTitle>
          <DialogDescription>
            {t("leagueUi.teamSelectionHint")}
          </DialogDescription>
        </DialogHeader>
        <Input
          aria-label={t("searchMyTeams")}
          placeholder={t("searchMyTeams")}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className="h-10"
        />
        {status === "LoadingFirstPage" ? (
          <LibraryCardsLoading
            label={t("loading")}
            text={(key) => t(key)}
            actionLabel={t("leagueUi.chooseTeam")}
          />
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {visible.map((row) => {
              const { team, leagueExperienced } = row;
              const disabled = !canEnrollTeam(row);
              return (
                <TeamCard
                  key={team.uuid}
                  team={team}
                  selection={{
                    disabled,
                    selected: !disabled && value === team.uuid,
                    onSelect: () => {
                      onChange(team.uuid);
                      setOpen(false);
                    },
                  }}
                  footer={
                    <div className="space-y-3">
                      <LeagueTeamIssues
                        team={team}
                        leagueExperienced={leagueExperienced}
                      />
                      <Link
                        href={`/teams/${team.uuid}`}
                        className="text-xs font-medium text-primary hover:underline"
                      >
                        {t("openTeam")}
                      </Link>
                    </div>
                  }
                />
              );
            })}
          </div>
        )}
        {status !== "LoadingFirstPage" && !visible.length && (
          <p className="text-sm text-muted-foreground">
            {t(search ? "noMatchingTeams" : "noTeams")}
          </p>
        )}
        {!search &&
          candidates.length > 0 &&
          !candidates.some(canEnrollTeam) && (
            <p className="text-sm text-muted-foreground">
              {t("leagueUi.noEligibleTeams")}
            </p>
          )}
        {status === "CanLoadMore" && (
          <Button variant="outline" onClick={loadMore}>
            {t("loadMore")}
          </Button>
        )}
        {status === "LoadingMore" && <p role="status">{t("loading")}</p>}
      </DialogContent>
    </Dialog>
  );
}
