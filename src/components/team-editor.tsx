"use client";
import { useRef, useState } from "react";
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
  playerSkillCost,
  starEligible,
  summarize,
  validateTeam,
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
import { ReadinessCard } from "./readiness-card";
import { Button } from "./ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "./ui/dropdown-menu";
import { Input } from "./ui/input";
import { Badge } from "./ui/badge";
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
import { SkillList, TableSkills } from "./skill-box";
import { TeamAffiliations, SpecialRules } from "./team-affiliations";
import { Checkbox } from "./ui/checkbox";
import { ScrollArea } from "./ui/scroll-area";
import { PlayerSkillPicker } from "./player-skill-picker";
import { positionLabel } from "./position-name";
import { TeamSupport } from "./team-support";
import { TeamBudget } from "./team-budget";
import { shareTeamLink } from "@/lib/share-team";
import { hasTeamProgress, resetTeamRoster } from "@/lib/builder";
import {
  ArrowLeft,
  ChevronRight,
  Copy,
  Share2,
  ChevronDown,
  Plus,
  Printer,
  ShieldCheck,
  Star,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "@/components/ui/toast";
import Link from "next/link";
import { PlayerIcon, StarPlayerIcon } from "./player-icon";
import { useTeamAutosave } from "@/lib/use-team-autosave";
import { useTeamSave } from "@/lib/use-team-save";
const gold = (n: number) => `${(n / 1000).toLocaleString("en")}k`;
export function TeamEditor({
  initial,
  revision: initialRevision = 0,
  readOnly = false,
}: {
  initial: Team;
  revision?: number;
  readOnly?: boolean;
}) {
  const t = useTranslations(),
    router = useRouter(),
    { isAuthenticated, isLoading } = useConvexAuth(),
    save = useTeamSave();
  const draftSync = useDraftSync();
  const locale = useLocale();
  const [duplicating, setDuplicating] = useState(false);
  const autosave = useTeamAutosave(initial, initialRevision, readOnly, save);
  const { team, revision, syncError, cloudInvalid, change } = autosave;
  const [dialog, setDialog] = useState<"stars" | null>(null),
    [selected, setSelected] = useState<string | null>(null),
    [search, setSearch] = useState("");
  const [pendingRoster, setPendingRoster] = useState<string | null>(null);
  const playerTitle = useRef<HTMLHeadingElement>(null);
  const roster = getRoster(team.rosterId)!,
    rules = getRuleset(team.rulesetId),
    totals = summarize(team),
    validation = validateTeam(team);
  const currentPlayer = team.players.find((p) => p.id === selected),
    position = roster.players.find((p) => p.id === currentPlayer?.positionId);
  const currentStar = team.stars.includes(selected ?? "")
    ? stars.find((star) => star.id === selected)
    : undefined;
  const requiresCaptain = roster.specialRules.includes("Team Captain");
  function switchRoster(rosterId: string) {
    const next = resetTeamRoster(
      team,
      rosterId,
      revision > 0 ? crypto.randomUUID() : team.uuid,
    );
    // A saved team keeps its identity; switching starts a separate local draft.
    if (revision > 0) {
      try {
        storeDraft(next);
      } catch {
        toast.add({ type: "error", title: t("storageError") });
        return;
      }
      router.replace(`/teams/${next.uuid}`, { scroll: false });
    }
    change(next);
    setSelected(null);
    setPendingRoster(null);
  }
  function editPlayer(update: Partial<Team["players"][number]>) {
    change({
      ...team,
      players: team.players.map((p) =>
        p.id === selected ? { ...p, ...update } : p,
      ),
    });
  }
  async function share() {
    try {
      const result = await shareTeamLink(
        `${window.location.origin}/teams/${team.uuid}`,
      );
      if (result === "copied")
        toast.add({ type: "success", title: t("copied") });
    } catch {
      toast.add({ type: "error", title: t("copyFailed") });
    }
  }
  async function copy() {
    if (duplicating) return;
    setDuplicating(true);
    const duplicate = duplicateTeam(team, t("copySuffix"));
    const release = draftSync.editing(duplicate.uuid);
    try {
      storeDraft(duplicate, draftSync.account);
    } catch {
      toast.add({ type: "error", title: t("storageError") });
      release();
      setDuplicating(false);
      return;
    }
    try {
      if (isAuthenticated) await saveCloudDraft(duplicate, 0, save);
      router.push(`/teams/${duplicate.uuid}`);
    } catch {
      toast.add({ type: "error", title: t("saveFailed") });
      router.push(`/teams/${duplicate.uuid}`);
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
    <div className="page-width team-builder py-5">
      <TeamHeader
        back={
          <Link
            href="/teams"
            className="no-print inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:underline"
          >
            <ArrowLeft className="size-3.5" />
            {t("myTeams")}
          </Link>
        }
        actions={
          <>
            <Button
              variant="outline"
              size="sm"
              disabled={duplicating || isLoading || !draftSync.ready}
              onClick={() => void copy()}
            >
              <Copy className="size-4" />
              {t("duplicate")}
            </Button>
            {!readOnly && isAuthenticated && revision > 0 && (
              <Button variant="outline" size="sm" onClick={share}>
                <Share2 className="size-4" />
                {t("share")}
              </Button>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger render={<Button size="sm" />}>
                <Printer className="size-4" />
                {t("print")}
                <ChevronDown className="size-4" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-44">
                <DropdownMenuItem onClick={() => void print("portrait")}>
                  {t("verticalPdf")}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => void print("landscape")}>
                  {t("horizontalPdf")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        }
        title={
          <>
            <h1 className="page-heading w-max min-w-0 max-w-full shrink-0">
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
            {!readOnly && (
              <TeamSaveStatus
                state={autosave}
                isAuthenticated={isAuthenticated}
              />
            )}
          </>
        }
      >
        <div className="flex flex-wrap gap-2">
          <Badge
            variant="outline"
            render={<Link href={`/rosters/${roster.id}`} />}
          >
            {roster.name}
          </Badge>
          <Badge variant="outline">{rules.name}</Badge>
          {readOnly && <Badge variant="outline">{t("viewOnly")}</Badge>}
        </div>
      </TeamHeader>
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
                {totals.playerCount}/16
              </span>
            </div>
            <div className="overflow-hidden rounded-lg border bg-card">
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
                    <TableHead className="w-16 pr-3 text-right">
                      {t("cost")}
                    </TableHead>
                    <TableHead className="w-8">
                      <span className="sr-only">{t("managePlayer")}</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {!team.players.length && !team.stars.length && (
                    <TableRow>
                      <TableCell
                        colSpan={requiresCaptain ? 11 : 10}
                        className="py-8 text-center text-xs text-muted-foreground"
                      >
                        {t("emptyRosterHint")}
                      </TableCell>
                    </TableRow>
                  )}
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
                        {[pos.ma, pos.st, pos.ag, pos.pa, pos.av].map(
                          (x, i) => (
                            <TableCell
                              key={i}
                              className="text-center font-mono text-xs"
                            >
                              {x}
                            </TableCell>
                          ),
                        )}
                        <TableCell>
                          <TableSkills
                            ids={pos.skills}
                            additionalIds={p.skills}
                            captain={team.captainId === p.id}
                            label={t("skills")}
                          />
                        </TableCell>
                        {requiresCaptain && (
                          <TableCell className="text-center">
                            <label
                              className="inline-flex size-8 items-center justify-center"
                              onClick={(event) => event.stopPropagation()}
                            >
                              <Checkbox
                                checked={team.captainId === p.id}
                                disabled={
                                  readOnly || pos.position.includes("Big Guy")
                                }
                                aria-label={`${t("teamCaptain")} · ${p.name || positionLabel(pos.position)}`}
                                onCheckedChange={(checked) => {
                                  const next = { ...team };
                                  if (checked) {
                                    next.captainId = p.id;
                                    next.players = team.players.map((player) =>
                                      player.id === p.id
                                        ? {
                                            ...player,
                                            skills: player.skills.filter(
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
              {!readOnly && (
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
                    onChange={(e) =>
                      change({
                        ...team,
                        rulesetId: e.target.value as Team["rulesetId"],
                      })
                    }
                  >
                    {rulesets.map((r) => (
                      <option key={r.id} value={r.id}>
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
                      else switchRoster(id);
                    }}
                  >
                    {rosters.map((r) => (
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

          <TeamBudget team={team} floating={!readOnly} />
          <ReadinessCard ready={validation.valid}>
            <div className="flex items-center gap-2">
              <ShieldCheck
                className={`size-5 ${validation.valid ? "text-emerald-700" : "text-muted-foreground"}`}
              />
              <h2 className="font-semibold text-sm">
                {validation.valid ? t("ready") : t("workInProgress")}
              </h2>
            </div>
            {validation.valid ? (
              <>
                <p className="mt-3 text-xs leading-relaxed text-emerald-900">
                  {t("legalText")}
                </p>
              </>
            ) : (
              <ul className="mt-3 space-y-2 text-xs leading-relaxed text-muted-foreground">
                {validation.issues.map((issue, index) => (
                  <li key={`${issue.code}-${index}`} className="flex gap-2">
                    <span className="mt-1.5 size-1 shrink-0 rounded-full bg-orange-600" />
                    <span>{t(`issues.${issue.code}`, issue.values)}</span>
                  </li>
                ))}
              </ul>
            )}
            {rules.id !== "bb2025-default" && (
              <p className="mt-4 border-t pt-3 text-[10px] leading-relaxed text-muted-foreground">
                {t("squadNotice")}
              </p>
            )}
          </ReadinessCard>
          {!readOnly && (syncError || cloudInvalid) && (
            <p
              role="alert"
              className="text-xs leading-relaxed text-muted-foreground"
            >
              {t(
                cloudInvalid
                  ? "invalidTeamSave"
                  : syncError?.conflict
                    ? "conflict"
                    : "saveFailed",
              )}
            </p>
          )}
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
              onClick={() => {
                if (pendingRoster) switchRoster(pendingRoster);
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
      <Dialog
        open={!!currentPlayer || !!currentStar}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
      >
        <DialogContent
          className="player-dialog flex max-h-[90dvh] flex-col overflow-hidden p-4 sm:max-w-2xl sm:p-6"
          initialFocus={playerTitle}
        >
          <DialogHeader className="pr-8 text-left">
            <p className="eyebrow">{t("managePlayer")}</p>
            <DialogTitle
              ref={playerTitle}
              tabIndex={-1}
              className="display-font break-words text-2xl leading-tight outline-none"
            >
              {currentStar?.name ||
                currentPlayer?.name.trim() ||
                (position && positionLabel(position.position))}
            </DialogTitle>
            <DialogDescription className="flex items-center gap-2 font-medium text-foreground">
              {position && <PlayerIcon positionId={position.id} />}
              {position && positionLabel(position.position)}
              {currentStar && (
                <>
                  <StarPlayerIcon starId={currentStar.id} />
                  {t("starPlayers")}
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          {currentPlayer && position && (
            <>
              <ScrollArea className="h-[min(65dvh,40rem)] min-h-0">
                <div className="space-y-5 py-1 pl-1 pr-3">
                  <label className="block text-xs font-medium">
                    {t("playerName")}
                    <Input
                      value={currentPlayer.name}
                      maxLength={80}
                      className="mt-2"
                      disabled={readOnly}
                      onChange={(event) =>
                        editPlayer({ name: event.target.value })
                      }
                    />
                  </label>
                  <div>
                    <p className="eyebrow mb-2">{t("builtInSkills")}</p>
                    <SkillList ids={position.skills} />
                  </div>
                  {readOnly ? (
                    <div>
                      <p className="eyebrow mb-2">{t("addedSkills")}</p>
                      <SkillList ids={currentPlayer.skills} added />
                    </div>
                  ) : (
                    <PlayerSkillPicker
                      key={currentPlayer.id}
                      team={team}
                      playerId={currentPlayer.id}
                      position={position}
                      selected={currentPlayer.skills}
                      captain={team.captainId === currentPlayer.id}
                      max={Math.min(
                        6,
                        rules.teamOverrides?.[roster.id]?.maxSkillsPerPlayer ??
                          (rules.id === "eurobowl-2026"
                            ? 2
                            : rules.maxAdvancementsPerPlayer),
                      )}
                      onChange={(skills) => editPlayer({ skills })}
                    />
                  )}
                  {team.captainId === currentPlayer.id && (
                    <div>
                      <p className="eyebrow mb-2">{t("teamCaptain")}</p>
                      <SkillList ids={[]} captain />
                    </div>
                  )}
                </div>
              </ScrollArea>
              <div className="flex justify-between gap-3 border-t pt-4">
                {!readOnly && (
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => {
                      const next = {
                        ...team,
                        players: team.players.filter(
                          (player) => player.id !== selected,
                        ),
                      };
                      if (next.captainId === selected) delete next.captainId;
                      change(next);
                      setSelected(null);
                    }}
                  >
                    <Trash2 className="size-4" />
                    {t("removePlayer")}
                  </Button>
                )}
                <Button className="ml-auto" onClick={() => setSelected(null)}>
                  {t("close")}
                </Button>
              </div>
            </>
          )}
          {currentStar && (
            <>
              <ScrollArea className="h-[min(50dvh,24rem)] min-h-0">
                <div className="space-y-5 py-1 pl-1 pr-3">
                  <p className="font-mono text-sm">
                    {gold(currentStar.cost)} GP
                  </p>
                  <dl className="grid grid-cols-5 gap-2 text-center font-mono">
                    {[
                      ["MA", currentStar.ma],
                      ["ST", currentStar.st],
                      ["AG", currentStar.ag],
                      ["PA", currentStar.pa],
                      ["AV", currentStar.av],
                    ].map(([label, value]) => (
                      <div key={label}>
                        <dt className="text-xs text-muted-foreground">
                          {label}
                        </dt>
                        <dd className="mt-1 text-sm">{value}</dd>
                      </div>
                    ))}
                  </dl>
                  <div>
                    <p className="eyebrow mb-2">{t("builtInSkills")}</p>
                    <SkillList ids={currentStar.skills} />
                  </div>
                </div>
              </ScrollArea>
              <Button className="ml-auto" onClick={() => setSelected(null)}>
                {t("close")}
              </Button>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
