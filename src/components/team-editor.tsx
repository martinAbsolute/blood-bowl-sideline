"use client";
import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "gt-next";
import { useConvexAuth } from "convex/react";
import {
  getRoster,
  getRuleset,
  rosters,
  rulesets,
  stars,
  starPairs,
  starChoices,
} from "@/domain/catalog";
import {
  isLineman,
  isSevens,
  playerMovement,
  playerSkillCost,
  starEligible,
  summarize,
} from "@/domain/rules";
import type { Team } from "@/domain/types";
import { storeDraft } from "@/lib/drafts";
import { saveCloudDraft } from "@/lib/cloud-save";
import { duplicateTeam } from "@/lib/duplicate-team";
import { useDraftSync } from "./draft-sync-provider";
import { TeamName } from "./team-name";
import { TeamSaveStatus } from "./team-save-status";
import { TeamHeader } from "./team-header";
import { EditorSelect } from "./editor-select";
import { TeamReadiness } from "./team-readiness";
import { Button } from "./ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "./ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "./ui/dropdown-menu";
import { Input } from "./ui/input";
import { Badge } from "./ui/badge";
import { RosterIcon } from "./player-icon";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "./dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "./ui/table";
import { PlayerRecruitment } from "./player-recruitment";
import { TableSkills } from "./skill-box";
import { TeamAffiliations, SpecialRules } from "./team-affiliations";
import { Checkbox } from "./ui/checkbox";
import { PlayerDialog } from "./player-dialog";
import { positionLabel } from "./position-name";
import { TeamSupport } from "./team-support";
import { RuleInfo } from "./rule-help";
import type { api } from "../../convex/_generated/api";
import type { FunctionReturnType } from "convex/server";
import { LeagueEnrollment } from "./league-enrollment";
import { TeamBudget } from "./team-budget";
import { ShareButton } from "./share-button";
import { hasTeamProgress, resetTeamRoster } from "@/lib/builder";
import {
  ArrowLeft,
  ChevronRight,
  Copy,
  Ellipsis,
  ChevronDown,
  Plus,
  Printer,
  RectangleVertical,
  RectangleHorizontal,
  Star,
  X,
} from "lucide-react";
import { toast } from "@/components/ui/toast";
import Link from "next/link";
import { PlayerIcon, StarPlayerIcon } from "./player-icon";
import { useTeamAutosave, type SavedTeam } from "@/lib/use-team-autosave";
import { useTeamSave } from "@/lib/use-team-save";
import { useContentTitle } from "@/lib/use-content-title";
const gold = (n: number) => `${(n / 1000).toLocaleString("en")}k`;
export function TeamEditor({
  initial,
  revision: initialRevision = 0,
  readOnly = false,
  server,
  recovered,
  leagueContext,
  leagueNotice,
}: {
  initial: Team;
  revision?: number;
  readOnly?: boolean;
  server?: (SavedTeam & { leagueExperienced?: boolean }) | null;
  recovered?: boolean;
  leagueContext?: FunctionReturnType<typeof api.leagues.get>;
  leagueNotice?: ReactNode;
}) {
  const t = useTranslations(),
    router = useRouter(),
    { isAuthenticated, isLoading } = useConvexAuth(),
    save = useTeamSave(leagueContext?.league._id);
  const draftSync = useDraftSync();
  const locale = useLocale();
  const [duplicating, setDuplicating] = useState(false);
  const [copyConfirmationOpen, setCopyConfirmationOpen] = useState(false);
  const autosave = useTeamAutosave(
    initial,
    initialRevision,
    readOnly,
    save,
    server,
    recovered,
    leagueContext?.league.startingTreasury,
  );
  const { team, revision, change } = autosave;
  useContentTitle(team.name.trim() || t("untitled"));
  const [dialog, setDialog] = useState<"stars" | null>(null),
    [selected, setSelected] = useState<string | null>(null),
    [search, setSearch] = useState("");
  const [pendingRoster, setPendingRoster] = useState<string | null>(null);
  const [switchingRoster, setSwitchingRoster] = useState(false);
  const roster = getRoster(team.rosterId)!,
    rules = getRuleset(team.rulesetId),
    totals = summarize(team, leagueContext?.league.startingTreasury);
  const requiresCaptain = roster.specialRules.includes("Team Captain");
  async function switchRoster(rosterId: string) {
    if (switchingRoster) return;
    const next = resetTeamRoster(
      team,
      rosterId,
      revision > 0 ? crypto.randomUUID() : team.uuid,
    );
    // A saved team keeps its identity; switching creates a separate team.
    if (revision > 0) {
      setSwitchingRoster(true);
      try {
        if (isAuthenticated) await saveCloudDraft(next, 0, save);
        else storeDraft(next, draftSync.account, 0);
        router.replace(`/teams/${next.uuid}`, { scroll: false });
        setPendingRoster(null);
      } catch {
        toast.add({
          type: "error",
          title: t(isAuthenticated ? "saveFailed" : "storageError"),
        });
      } finally {
        setSwitchingRoster(false);
      }
      return;
    }
    change(next);
    setSelected(null);
    setPendingRoster(null);
  }
  async function copy() {
    if (duplicating) return;
    setDuplicating(true);
    const duplicate = duplicateTeam(team, t("copySuffix"));
    const release = draftSync.editing(duplicate.uuid);
    try {
      if (isAuthenticated) await saveCloudDraft(duplicate, 0, save);
      else storeDraft(duplicate, null, 0);
      router.push(`/teams/${duplicate.uuid}`);
    } catch {
      toast.add({
        type: "error",
        title: t(isAuthenticated ? "saveFailed" : "storageError"),
      });
      if (isAuthenticated) {
        try {
          storeDraft(duplicate, draftSync.account, 0);
          router.push(`/teams/${duplicate.uuid}`);
        } catch {
          toast.add({ type: "error", title: t("storageError") });
        }
      }
    } finally {
      release();
      setDuplicating(false);
    }
  }
  async function print(orientation: "portrait" | "landscape") {
    try {
      const { printTeam } = await import("./team-print");
      await printTeam(team, orientation, t, locale);
    } catch {
      toast.add({ type: "error", title: t("printFailed") });
    }
  }
  function hireStar(id: string) {
    const pairs = starPairs;
    const pair = pairs.find((p) => p.includes(id)) ?? [id],
      add = pair.filter((s) => !team.stars.includes(s));
    if (
      starChoices([...team.stars, ...add]).length > 2 ||
      totals.playerCount + add.length > 16
    )
      return;
    change({ ...team, stars: [...team.stars, ...add] });
    setDialog(null);
  }
  const allowedStars = stars.filter(
    (s) =>
      (!starPairs.some((p) => p.includes(s.id)) ||
        starPairs.find((p) => p.includes(s.id))?.[0] === s.id) &&
      starEligible(team, s) &&
      !team.stars.includes(s.id) &&
      s.name.toLowerCase().includes(search.toLowerCase()),
  );
  return (
    <div className="page-width team-builder py-3">
      <TeamHeader
        back={
          <>
            <Link
              href="/teams"
              className="no-print inline-flex min-h-8 items-center gap-1.5 rounded-sm text-sm text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
            >
              <ArrowLeft className="size-3.5" />
              {t("myTeams")}
            </Link>
            {leagueNotice}
          </>
        }
        status={
          !readOnly && (
            <TeamSaveStatus
              state={autosave}
              isAuthenticated={isAuthenticated}
            />
          )
        }
        actions={
          <>
            <Button
              variant="outline"
              size="sm"
              className="hidden h-9 sm:inline-flex"
              disabled={duplicating || isLoading || !draftSync.ready}
              onClick={() => setCopyConfirmationOpen(true)}
            >
              <Copy className="size-4" />
              {t("duplicate")}
            </Button>
            {!readOnly && isAuthenticated && revision > 0 && (
              <ShareButton
                variant="outline"
                size="sm"
                className="h-11 flex-1 sm:h-9 sm:flex-none"
                path={`/teams/${team.uuid}`}
              />
            )}
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button
                    size="sm"
                    className="h-11 flex-1 sm:h-9 sm:flex-none"
                  />
                }
              >
                <Printer className="size-4" />
                {t("print")}
                <ChevronDown className="size-4" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-44">
                <DropdownMenuItem
                  className="min-h-11 sm:min-h-8"
                  onClick={() => void print("portrait")}
                >
                  <RectangleVertical aria-hidden="true" className="size-4" />
                  {t("verticalPdf")}
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="min-h-11 sm:min-h-8"
                  onClick={() => void print("landscape")}
                >
                  <RectangleHorizontal aria-hidden="true" className="size-4" />
                  {t("horizontalPdf")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-11 flex-1 sm:hidden"
                  />
                }
              >
                <Ellipsis className="size-4" />
                {t("teamActions")}
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-44">
                <DropdownMenuItem
                  className="min-h-11"
                  disabled={duplicating || isLoading || !draftSync.ready}
                  onClick={() => setCopyConfirmationOpen(true)}
                >
                  <Copy className="size-4" />
                  {t("duplicate")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        }
        title={
          <h1
            className="page-heading team-heading min-w-0 truncate"
            title={team.name || t("untitled")}
          >
            {readOnly ? (
              team.name || t("untitled")
            ) : (
              <TeamName
                label={t("teamName")}
                value={team.name}
                placeholder={t("untitled")}
                onChange={(name) => change({ ...team, name })}
              />
            )}
          </h1>
        }
      >
        <div className="flex flex-wrap gap-2">
          <Badge
            variant="outline"
            className="h-auto min-h-6 max-w-full whitespace-normal text-left"
            render={
              <Link href={`/rosters/${roster.id}?ruleset=${team.rulesetId}`} />
            }
          >
            <RosterIcon rosterId={roster.id} className="size-4" />
            {roster.name}
          </Badge>
          <Badge
            variant="outline"
            className="h-auto min-h-6 max-w-full whitespace-normal text-left"
          >
            {rules.name}
          </Badge>
          {readOnly && <Badge variant="outline">{t("viewOnly")}</Badge>}
        </div>
      </TeamHeader>
      {!readOnly && leagueContext && (
        <LeagueEnrollment
          league={leagueContext.league}
          canRegister={leagueContext.canRegister}
          team={team}
          pending={
            autosave.cloudPending ||
            autosave.dirty ||
            autosave.saving ||
            revision === 0
          }
          experienced={server?.leagueExperienced}
        />
      )}
      <div className="budget-grid">
        <div className="@container space-y-5">
          {!readOnly && (
            <PlayerRecruitment
              key={`${team.uuid}:${team.rosterId}`}
              team={team}
              onChange={change}
            />
          )}
          <section aria-labelledby="players-title" className="min-w-0">
            <div className="mb-2 flex items-center justify-between gap-3 px-1">
              <h2 id="players-title" className="section-title">
                {t("players")}
              </h2>
              <span className="font-mono text-xs text-muted-foreground">
                {totals.playerCount}/{isSevens(team) ? 11 : 16}
              </span>
            </div>
            <div className="overflow-hidden rounded-lg border bg-card">
              {!team.players.length && !team.stars.length ? (
                <p className="px-4 py-6 text-center text-xs leading-relaxed text-muted-foreground">
                  {t("emptyRosterHint")}
                </p>
              ) : (
                <Table
                  aria-label={t("players")}
                  className="player-table min-w-[740px] table-auto md:table-fixed"
                >
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10 pl-3">#</TableHead>
                      <TableHead className="w-48">{t("player")}</TableHead>
                      {["MA", "ST", "AG", "PA", "AV"].map((x) => (
                        <TableHead
                          key={x}
                          className="w-8 text-center font-mono text-xs"
                        >
                          {x}
                        </TableHead>
                      ))}
                      <TableHead>{t("skills")}</TableHead>
                      {requiresCaptain && (
                        <TableHead className="w-16 text-center">
                          {t("teamCaptain")}
                        </TableHead>
                      )}
                      {isSevens(team) && (
                        <TableHead className="w-20 text-center">
                          <span className="inline-flex items-center gap-0.5">
                            <RuleInfo
                              className="size-5"
                              title={t("sevensVeteran")}
                              description={t("sevensVeteranHelp")}
                              label={t("explainRule", {
                                name: t("sevensVeteran"),
                              })}
                            />
                            <span>{t("sevensVeteran")}</span>
                          </span>
                        </TableHead>
                      )}
                      <TableHead className="w-16 pr-3 text-right">
                        {t("cost")}
                      </TableHead>
                      <TableHead className="w-8">
                        <span className="sr-only">{t("managePlayer")}</span>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {team.players.map((p, index) => {
                      const pos = roster.players.find(
                        (x) => x.id === p.positionId,
                      );
                      if (!pos) return null;
                      return (
                        <TableRow
                          key={p.id}
                          className="group cursor-pointer focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-[-2px]"
                          tabIndex={0}
                          aria-label={`${t("managePlayer")} · ${p.name || positionLabel(pos.position)}`}
                          onClick={(event) => {
                            if (
                              (event.target as HTMLElement).closest(
                                "button, a, input, [role=checkbox]",
                              )
                            )
                              return;
                            setSelected(p.id);
                          }}
                          onKeyDown={(event) => {
                            if (
                              event.target === event.currentTarget &&
                              ["Enter", " "].includes(event.key)
                            ) {
                              event.preventDefault();
                              setSelected(p.id);
                            }
                          }}
                        >
                          <TableCell className="pl-5 font-mono text-xs text-muted-foreground">
                            {String(index + 1).padStart(2, "0")}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <PlayerIcon
                                positionId={pos.id}
                                variant={index}
                                className="size-8"
                              />
                              <div>
                                {readOnly ? (
                                  <strong className="text-sm">
                                    {p.name || positionLabel(pos.position)}
                                  </strong>
                                ) : (
                                  <>
                                    <strong className="hidden text-sm print:block">
                                      {p.name || positionLabel(pos.position)}
                                    </strong>
                                    <button
                                      className="no-print inline-flex items-center gap-2 text-left text-sm font-semibold text-primary hover:underline"
                                      onClick={() => {
                                        setSelected(p.id);
                                        setSearch("");
                                      }}
                                    >
                                      {p.name || positionLabel(pos.position)}
                                    </button>
                                  </>
                                )}
                                {p.name && (
                                  <p className="mt-0.5 text-xs text-muted-foreground">
                                    {positionLabel(pos.position)}
                                  </p>
                                )}
                              </div>
                            </div>
                          </TableCell>
                          {[
                            playerMovement(team, p.id, pos),
                            pos.st,
                            pos.ag,
                            pos.pa,
                            pos.av,
                          ].map((x, i) => (
                            <TableCell
                              key={i}
                              className="text-center font-mono text-xs"
                            >
                              {x}
                            </TableCell>
                          ))}
                          <TableCell>
                            <TableSkills
                              ids={pos.skills}
                              additionalIds={p.skills}
                              captain={team.captainId === p.id}
                              veteran={
                                isSevens(team) && team.veteranId === p.id
                              }
                              label={t("skills")}
                            />
                          </TableCell>
                          {requiresCaptain && (
                            <TableCell className="text-center">
                              {!pos.position.includes("Big Guy") &&
                                !(
                                  team.rulesetId === "kyiv-seven-sins-sevens" &&
                                  totals.tier === 2 &&
                                  p.skills.length > 0 &&
                                  team.captainId !== p.id
                                ) && (
                                  <label
                                    className="inline-flex size-8 items-center justify-center"
                                    onClick={(event) => event.stopPropagation()}
                                  >
                                    <Checkbox
                                      checked={team.captainId === p.id}
                                      disabled={readOnly}
                                      title={
                                        team.rulesetId ===
                                          "kyiv-seven-sins-sevens" &&
                                        totals.tier === 2 &&
                                        p.skills.length > 0
                                          ? t("sevensCaptainSkillConflict")
                                          : undefined
                                      }
                                      aria-label={`${t("teamCaptain")} · ${p.name || positionLabel(pos.position)}`}
                                      onCheckedChange={(checked) => {
                                        const next = { ...team };
                                        if (checked) {
                                          next.captainId = p.id;
                                          if (!isSevens(team))
                                            next.players = team.players.map(
                                              (player) =>
                                                player.id === p.id
                                                  ? {
                                                      ...player,
                                                      skills:
                                                        player.skills.filter(
                                                          (id) => id !== "pro",
                                                        ),
                                                    }
                                                  : player,
                                            );
                                        } else delete next.captainId;
                                        change(next);
                                      }}
                                    />
                                  </label>
                                )}
                            </TableCell>
                          )}
                          {isSevens(team) && (
                            <TableCell className="text-center">
                              {isLineman(pos) && (
                                <label
                                  className="inline-flex size-8 items-center justify-center"
                                  onClick={(event) => event.stopPropagation()}
                                >
                                  <Checkbox
                                    checked={team.veteranId === p.id}
                                    disabled={readOnly}
                                    aria-label={`${t("sevensVeteran")} · ${p.name || positionLabel(pos.position)}`}
                                    onCheckedChange={(checked) => {
                                      const next = { ...team };
                                      if (checked) next.veteranId = p.id;
                                      else delete next.veteranId;
                                      change(next);
                                    }}
                                  />
                                </label>
                              )}
                            </TableCell>
                          )}
                          <TableCell className="pr-5 text-right font-mono text-xs">
                            {gold(
                              pos.cost +
                                (rules.id === "bb2025-default"
                                  ? playerSkillCost(team, pos, p.skills)
                                  : 0),
                            )}
                          </TableCell>
                          <TableCell className="pr-3">
                            <ChevronRight
                              aria-hidden="true"
                              className="size-4 text-primary opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 [@media(hover:none)]:opacity-100"
                            />
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    {team.stars.map((id) => {
                      const s = stars.find((x) => x.id === id);
                      return (
                        s && (
                          <TableRow
                            key={id}
                            className="group cursor-pointer bg-amber-50/70 focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-[-2px]"
                            tabIndex={0}
                            aria-label={`${t("managePlayer")} · ${s.name}`}
                            onClick={(event) => {
                              if (
                                !(event.target as HTMLElement).closest(
                                  "button, a",
                                )
                              )
                                setSelected(id);
                            }}
                            onKeyDown={(event) => {
                              if (
                                event.target === event.currentTarget &&
                                ["Enter", " "].includes(event.key)
                              ) {
                                event.preventDefault();
                                setSelected(id);
                              }
                            }}
                          >
                            <TableCell className="pl-5 text-amber-700">
                              <Star className="size-3" />
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <StarPlayerIcon
                                  starId={s.id}
                                  className="size-10"
                                />
                                <strong className="hidden text-sm print:block">
                                  {s.name}
                                </strong>
                                <button
                                  className="no-print text-left text-sm font-semibold"
                                  onClick={() => setSelected(id)}
                                >
                                  {s.name}
                                </button>
                                {!readOnly && (
                                  <button
                                    className="ml-2 text-muted-foreground"
                                    aria-label={`${t("remove")} ${s.name}`}
                                    onClick={() => {
                                      const pairs = starPairs;
                                      const pair = pairs.find((p) =>
                                        p.includes(id),
                                      ) ?? [id];
                                      change({
                                        ...team,
                                        stars: team.stars.filter(
                                          (s) => !pair.includes(s),
                                        ),
                                      });
                                    }}
                                  >
                                    <X className="size-3" />
                                  </button>
                                )}
                              </div>
                            </TableCell>
                            {[s.ma, s.st, s.ag, s.pa, s.av].map((x, i) => (
                              <TableCell
                                key={i}
                                className="text-center font-mono text-xs"
                              >
                                {x}
                              </TableCell>
                            ))}
                            <TableCell className="whitespace-normal text-xs text-muted-foreground">
                              <TableSkills ids={s.skills} label={t("skills")} />
                            </TableCell>
                            {requiresCaptain && <TableCell />}
                            {isSevens(team) && <TableCell />}
                            <TableCell className="pr-5 text-right font-mono text-xs">
                              {gold(s.cost)}
                            </TableCell>
                            <TableCell className="pr-3">
                              <ChevronRight
                                aria-hidden="true"
                                className="size-4 text-primary opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 [@media(hover:none)]:opacity-100"
                              />
                            </TableCell>
                          </TableRow>
                        )
                      );
                    })}
                  </TableBody>
                </Table>
              )}
              {!readOnly && !isSevens(team) && (
                <div className="flex justify-end border-t px-3 py-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={
                      starChoices(team.stars).length >= 2 ||
                      totals.playerCount >= 16 ||
                      (rules.id === "world-cup-2027" &&
                        team.players.length < 11)
                    }
                    onClick={() => {
                      setDialog("stars");
                      setSearch("");
                    }}
                  >
                    <Star className="size-4 text-amber-700" />
                    {t("addStar")}
                  </Button>
                </div>
              )}
            </div>
          </section>
          <TeamSupport team={team} onChange={change} readOnly={readOnly} />
        </div>
        <aside className="budget-side space-y-3">
          {!readOnly && (
            <section className="no-print rounded-lg border bg-card p-3">
              <div className="grid gap-3">
                <label className="text-xs font-medium text-muted-foreground">
                  {t("ruleset")}
                  <EditorSelect
                    value={team.rulesetId}
                    onChange={(e) => {
                      const next = {
                        ...team,
                        rulesetId: e.target.value as Team["rulesetId"],
                      };
                      if (!isSevens(next)) delete next.veteranId;
                      change(next);
                    }}
                  >
                    {rulesets.map((r) => (
                      <option
                        key={r.id}
                        value={r.id}
                        disabled={r.excludedRosters?.includes(team.rosterId)}
                      >
                        {r.name}
                      </option>
                    ))}
                  </EditorSelect>
                </label>
                <label className="text-xs font-medium text-muted-foreground">
                  {t("roster")}
                  <EditorSelect
                    value={team.rosterId}
                    onChange={(e) => {
                      const id = e.target.value;
                      if (id === team.rosterId) return;
                      if (hasTeamProgress(team)) setPendingRoster(id);
                      else void switchRoster(id);
                    }}
                  >
                    {rosters
                      .filter((r) => !rules.excludedRosters?.includes(r.id))
                      .map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.name}
                        </option>
                      ))}
                  </EditorSelect>
                </label>
                {["chaos-chosen", "chaos-renegade"].includes(roster.id) && (
                  <label className="text-xs font-medium text-muted-foreground">
                    <SpecialRules names={["Favoured of…"]} />
                    <EditorSelect
                      value={team.favouredOf}
                      onChange={(e) =>
                        change({
                          ...team,
                          favouredOf: e.target.value as Team["favouredOf"],
                        })
                      }
                    >
                      {[
                        "Undivided",
                        "Khorne",
                        "Nurgle",
                        "Slaanesh",
                        "Tzeentch",
                      ].map((x) => (
                        <option key={x}>{x}</option>
                      ))}
                    </EditorSelect>
                  </label>
                )}
                {roster.id === "norse" && (
                  <label className="text-xs font-medium text-muted-foreground">
                    {t("norseLeague")}
                    <EditorSelect
                      value={team.norseLeague}
                      onChange={(e) =>
                        change({
                          ...team,
                          norseLeague: e.target.value as Team["norseLeague"],
                        })
                      }
                    >
                      <option>Old World Classic</option>
                      <option>Chaos Clash</option>
                    </EditorSelect>
                  </label>
                )}
              </div>
              <div className="mt-4 border-t pt-4">
                <TeamAffiliations roster={roster} team={team} />
              </div>
            </section>
          )}
          {readOnly && (
            <section className="rounded-lg border bg-card p-4">
              <TeamAffiliations roster={roster} team={team} />
            </section>
          )}

          <TeamBudget
            team={team}
            floating={!readOnly}
            startingTreasury={leagueContext?.league.startingTreasury}
          />
          <TeamReadiness
            team={team}
            startingTreasury={leagueContext?.league.startingTreasury}
          />
        </aside>
      </div>
      <Dialog
        open={pendingRoster !== null}
        onOpenChange={(open) => {
          if (!open) setPendingRoster(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("switchTeamTitle")}</DialogTitle>
            <DialogDescription>
              {t("switchTeamWarning", {
                team: getRoster(pendingRoster ?? "")?.name ?? "",
              })}
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setPendingRoster(null)}>
              {t("cancel")}
            </Button>
            <Button
              variant="destructive"
              disabled={switchingRoster}
              onClick={() => {
                if (pendingRoster) void switchRoster(pendingRoster);
              }}
            >
              {t("switchTeam")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog
        open={dialog !== null}
        onOpenChange={(open) => {
          if (!open) setDialog(null);
        }}
      >
        <DialogContent className="star-recruitment flex max-h-[85dvh] flex-col overflow-hidden sm:max-w-5xl">
          <DialogHeader>
            <DialogTitle className="display-font text-3xl">
              {t("addStar")}
            </DialogTitle>
            <DialogDescription>{t("starHint")}</DialogDescription>
          </DialogHeader>
          <>
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("searchRosters")}
              aria-label={t("starPlayers")}
            />
            <div
              className="min-h-0 overflow-auto rounded-lg border bg-card"
              data-star-player-list
            >
              <Table
                className="min-w-[740px] table-auto md:table-fixed"
                aria-label={t("starPlayers")}
              >
                <TableHeader className="sticky top-0 z-10 bg-card">
                  <TableRow>
                    <TableHead className="w-48 pl-3">{t("player")}</TableHead>
                    {["MA", "ST", "AG", "PA", "AV"].map((stat) => (
                      <TableHead
                        key={stat}
                        className="w-8 text-center font-mono text-xs"
                      >
                        {stat}
                      </TableHead>
                    ))}
                    <TableHead>{t("skills")}</TableHead>
                    <TableHead className="w-14 text-right">
                      {t("cost")}
                    </TableHead>
                    <TableHead className="sticky right-0 w-14 bg-card pr-3">
                      <span className="sr-only">{t("addStar")}</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {allowedStars.flatMap((choice) => {
                    const pair = starPairs.find((pair) =>
                      pair.includes(choice.id),
                    ) ?? [choice.id];
                    const members = pair.map((id) =>
                      stars.find((star) => star.id === id)!,
                    );
                    return members.map((star, index) => (
                      <TableRow key={star.id} className="h-12">
                        <TableCell className="pl-3">
                          <div className="flex items-center gap-2">
                            <StarPlayerIcon
                              starId={star.id}
                              className="size-8"
                            />
                            <strong
                              className="truncate text-sm"
                              title={star.name}
                            >
                              {star.name}
                            </strong>
                          </div>
                        </TableCell>
                        {[star.ma, star.st, star.ag, star.pa, star.av].map(
                          (stat, i) => (
                            <TableCell
                              key={i}
                              className="text-center font-mono text-xs"
                            >
                              {stat}
                            </TableCell>
                          ),
                        )}
                        <TableCell>
                          <TableSkills
                            ids={star.skills}
                            label={t("skills") + " · " + star.name}
                          />
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs">
                          {star.cost / 1000}k
                        </TableCell>
                        {index === 0 && (
                          <TableCell
                            rowSpan={members.length}
                            className="sticky right-0 bg-card pr-3 text-right"
                          >
                            <Button
                              size="icon"
                              className="size-8"
                              aria-label={t("hireStarPlayer", {
                                player: members
                                  .map((star) => star.name)
                                  .join(" & "),
                              })}
                              onClick={() => hireStar(choice.id)}
                            >
                              <Plus className="size-4" />
                            </Button>
                          </TableCell>
                        )}
                      </TableRow>
                    ));
                  })}
                  {!allowedStars.length && (
                    <TableRow>
                      <TableCell
                        colSpan={9}
                        className="py-6 text-center text-sm text-muted-foreground"
                      >
                        {t("noStars")}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </>
          <Button variant="outline" onClick={() => setDialog(null)}>
            {t("close")}
          </Button>
        </DialogContent>
      </Dialog>
      <AlertDialog
        open={copyConfirmationOpen}
        onOpenChange={setCopyConfirmationOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("confirmCopyTeam", { name: team.name || t("untitled") })}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("confirmCopyTeamHint")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              disabled={duplicating}
              onClick={() => {
                setCopyConfirmationOpen(false);
                void copy();
              }}
            >
              {t("duplicate")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {selected && (
        <PlayerDialog
          key={selected}
          team={team}
          selected={selected}
          readOnly={readOnly}
          onChange={change}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}
