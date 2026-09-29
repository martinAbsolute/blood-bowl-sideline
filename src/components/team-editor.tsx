"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "gt-next";
import { useConvexAuth, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import {
  getRoster,
  getRuleset,
  inducements,
  rulesets,
  skills,
  skillName,
  stars,
  starPairs,
  starChoices,
} from "@/domain/catalog";
import {
  inducementInfo,
  playerSkillCost,
  skillAccess,
  starEligible,
  summarize,
  validateTeam,
} from "@/domain/rules";
import type { Team } from "@/domain/types";
import {
  storeDraft,
  exportTeam,
  readRevision,
  storeRevision,
} from "@/lib/drafts";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Textarea } from "./ui/textarea";
import { Badge } from "./ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "./ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { BorderBeam } from "./magic-ui/border-beam";
import {
  ArrowUpRight,
  Check,
  ChevronRight,
  Copy,
  Download,
  Minus,
  Plus,
  Printer,
  Save,
  ShieldCheck,
  Star,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { LoginButton } from "./site-shell";
import { toast } from "sonner";
import Link from "next/link";
const gold = (n: number) => `${(n / 1000).toLocaleString("en")}k`;
const selectClass =
  "h-10 w-full rounded-md border border-input bg-card px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring";
function Counter({
  label,
  value,
  max,
  onChange,
  disabled = false,
  cost,
}: {
  label: string;
  value: number;
  max: number;
  onChange: (v: number) => void;
  disabled?: boolean;
  cost?: number;
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-border/60 py-4 last:border-0">
      <div>
        <p className="text-sm font-medium">{label}</p>
        {cost !== undefined && (
          <p className="mt-1 font-mono text-xs text-muted-foreground">
            {gold(cost)} GP
          </p>
        )}
      </div>
      <div className="flex items-center gap-2">
        <Button
          size="icon"
          variant="outline"
          className="size-8"
          disabled={disabled || value === 0}
          aria-label={`− ${label}`}
          onClick={() => onChange(value - 1)}
        >
          <Minus className="size-3" />
        </Button>
        <span className="w-6 text-center font-mono text-sm">{value}</span>
        <Button
          size="icon"
          variant="outline"
          className="size-8"
          disabled={disabled || value >= max}
          aria-label={`+ ${label}`}
          onClick={() => onChange(value + 1)}
        >
          <Plus className="size-3" />
        </Button>
      </div>
    </div>
  );
}
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
    { isAuthenticated } = useConvexAuth(),
    save = useMutation(api.teams.save);
  const [team, setTeam] = useState(initial),
    [revision, setRevision] = useState(
      () => initialRevision || readRevision(initial.uuid),
    ),
    [saving, setSaving] = useState(false),
    [dirty, setDirty] = useState(false);
  const [dialog, setDialog] = useState<"players" | "stars" | null>(null),
    [selected, setSelected] = useState<string | null>(null),
    [search, setSearch] = useState("");
  const roster = getRoster(team.rosterId)!,
    rules = getRuleset(team.rulesetId),
    totals = summarize(team),
    validation = validateTeam(team);
  const currentPlayer = team.players.find((p) => p.id === selected),
    position = roster.players.find((p) => p.id === currentPlayer?.positionId);
  useEffect(() => {
    if (!readOnly) {
      try {
        storeDraft(team);
      } catch {
        toast.error(t("storageError"));
      }
    }
  }, [team, readOnly, t]);
  function change(next: Team) {
    setTeam(next);
    setDirty(true);
  }
  function staff(key: keyof Team["staff"], value: number) {
    change({ ...team, staff: { ...team.staff, [key]: value } });
  }
  function editPlayer(update: Partial<Team["players"][number]>) {
    change({
      ...team,
      players: team.players.map((p) =>
        p.id === selected ? { ...p, ...update } : p,
      ),
    });
  }
  async function saveTeam() {
    setSaving(true);
    try {
      const result = await save({ team, expectedRevision: revision });
      setRevision(result.revision);
      storeRevision(team.uuid, result.revision);
      setDirty(false);
      toast.success(t("saved"));
    } catch (error) {
      toast.error(
        error instanceof Error && error.message.includes("CONFLICT")
          ? t("conflict")
          : t("saveFailed"),
      );
    } finally {
      setSaving(false);
    }
  }
  async function share() {
    try {
      await navigator.clipboard.writeText(
        `${window.location.origin}/teams/${team.uuid}`,
      );
      toast.success(t("copied"));
    } catch {
      toast.error(t("copyFailed"));
    }
  }
  function copy() {
    const duplicate = {
      ...team,
      uuid: crypto.randomUUID(),
      name: `${team.name} (${t("copySuffix")})`.slice(0, 80),
    };
    try {
      storeDraft(duplicate);
      router.push(`/builder?draft=${duplicate.uuid}`);
    } catch {
      toast.error(t("storageError"));
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
  const eligibleInducements = inducements.filter(
    (i) => inducementInfo(team, i).allowed || (team.inducements[i.id] ?? 0) > 0,
  );
  return (
    <div className="page-width py-8 md:py-12">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="eyebrow">
            {readOnly ? t("sharedTeam") : t("newRoster")} / {roster.name}
          </p>
          <h1 className="display-font mt-2 text-4xl leading-tight md:text-5xl">
            {team.name || t("untitled")}
          </h1>
          <div className="mt-3 flex flex-wrap gap-2">
            <Badge variant="outline">{rules.name}</Badge>
            <Badge variant="secondary">
              {totals.playerCount}/16 {t("players")}
            </Badge>
            {readOnly && <Badge variant="outline">{t("viewOnly")}</Badge>}
          </div>
        </div>
        <div className="no-print flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => exportTeam(team)}>
            <Download className="size-4" />
            {t("export")}
          </Button>
          <Button variant="outline" size="sm" onClick={() => window.print()}>
            <Printer className="size-4" />
            {t("print")}
          </Button>
          {readOnly && (
            <Button size="sm" onClick={copy}>
              <Copy className="size-4" />
              {t("duplicate")}
            </Button>
          )}
          {revision > 0 && (
            <Button variant="outline" size="sm" onClick={share}>
              <Copy className="size-4" />
              {t("share")}
            </Button>
          )}
        </div>
      </div>
      {!readOnly && !isAuthenticated && (
        <div className="no-print mb-6 flex flex-col justify-between gap-4 rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 sm:flex-row sm:items-center">
          <div>
            <p className="text-sm font-semibold text-amber-950">
              {t("guestTitle")}
            </p>
            <p className="mt-1 max-w-2xl text-xs leading-relaxed text-amber-900/80">
              {t("guestText")}
            </p>
          </div>
          <LoginButton className="shrink-0 border-amber-300 bg-transparent text-xs" />
        </div>
      )}
      <div className="budget-grid">
        <div className="space-y-6">
          {!readOnly && (
            <section className="no-print rounded-xl border bg-card p-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="text-xs font-medium">
                  {t("teamName")}
                  <Input
                    className="mt-2"
                    value={team.name}
                    maxLength={80}
                    onChange={(e) => change({ ...team, name: e.target.value })}
                  />
                </label>
                <label className="text-xs font-medium">
                  {t("coachName")}
                  <Input
                    className="mt-2"
                    value={team.coach}
                    maxLength={80}
                    onChange={(e) => change({ ...team, coach: e.target.value })}
                  />
                </label>
                <label className="text-xs font-medium">
                  {t("ruleset")}
                  <select
                    className={`${selectClass} mt-2`}
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
                  </select>
                </label>
                <div className="flex items-end">
                  <Button asChild variant="outline" className="w-full">
                    <Link href="/rosters">
                      {t("chooseRoster")}
                      <ArrowUpRight className="size-4" />
                    </Link>
                  </Button>
                </div>
                {["chaos-chosen", "chaos-renegade"].includes(roster.id) && (
                  <label className="text-xs font-medium">
                    {t("favouredOf")}
                    <select
                      className={`${selectClass} mt-2`}
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
                    </select>
                  </label>
                )}
                {roster.id === "norse" && (
                  <label className="text-xs font-medium">
                    {t("norseLeague")}
                    <select
                      className={`${selectClass} mt-2`}
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
                    </select>
                  </label>
                )}
              </div>
            </section>
          )}
          <section className="overflow-hidden rounded-xl border bg-card">
            <div className="flex items-center justify-between border-b px-5 py-4">
              <h2 className="section-title flex items-center gap-2">
                <Users className="size-5 text-muted-foreground" />
                {t("players")}
              </h2>
              {!readOnly && (
                <Button
                  size="sm"
                  disabled={totals.playerCount >= 16}
                  onClick={() => setDialog("players")}
                >
                  <Plus className="size-4" />
                  {t("addPlayer")}
                </Button>
              )}
            </div>
            {team.players.length === 0 && team.stars.length === 0 ? (
              <div className="px-6 py-16 text-center">
                <div className="mx-auto mb-5 grid size-14 place-items-center rounded-full bg-secondary">
                  <Users className="size-6 text-primary/60" />
                </div>
                <p className="display-font text-2xl">{t("emptyRoster")}</p>
                <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">
                  {t("emptyRosterHint")}
                </p>
                {!readOnly && (
                  <Button
                    className="mt-6"
                    variant="outline"
                    onClick={() => setDialog("players")}
                  >
                    {t("addPlayer")}
                    <Plus className="size-4" />
                  </Button>
                )}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10 pl-5">#</TableHead>
                    <TableHead className="min-w-44">{t("player")}</TableHead>
                    {["MA", "ST", "AG", "PA", "AV"].map((x) => (
                      <TableHead
                        key={x}
                        className="text-center font-mono text-xs"
                      >
                        {x}
                      </TableHead>
                    ))}
                    <TableHead className="min-w-44">{t("skills")}</TableHead>
                    <TableHead className="pr-5 text-right">
                      {t("cost")}
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
                      <TableRow key={p.id}>
                        <TableCell className="pl-5 font-mono text-xs text-muted-foreground">
                          {String(index + 1).padStart(2, "0")}
                        </TableCell>
                        <TableCell>
                          {readOnly ? (
                            <strong className="text-sm">
                              {p.name || pos.position}
                            </strong>
                          ) : (
                            <button
                              className="flex items-center gap-2 text-left text-sm font-semibold text-primary hover:underline"
                              onClick={() => {
                                setSelected(p.id);
                                setSearch("");
                              }}
                            >
                              {p.name || pos.position}
                              <ChevronRight className="size-3" />
                            </button>
                          )}
                          {p.name && (
                            <p className="mt-0.5 text-xs text-muted-foreground">
                              {pos.position}
                            </p>
                          )}
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
                          <p className="text-xs leading-relaxed text-muted-foreground">
                            {[
                              ...pos.skills,
                              ...(team.captainId === p.id ? ["pro"] : []),
                            ]
                              .map(skillName)
                              .join(", ") || "—"}
                          </p>
                          {p.skills.length > 0 && (
                            <p className="mt-1 text-xs font-semibold text-primary">
                              + {p.skills.map(skillName).join(", ")}
                            </p>
                          )}
                        </TableCell>
                        <TableCell className="pr-5 text-right font-mono text-xs">
                          {gold(
                            pos.cost +
                              (rules.id === "bb2025-default"
                                ? playerSkillCost(team, pos, p.skills)
                                : 0),
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {team.stars.map((id) => {
                    const s = stars.find((x) => x.id === id);
                    return (
                      s && (
                        <TableRow key={id} className="bg-amber-50/70">
                          <TableCell className="pl-5 text-amber-700">
                            <Star className="size-3" />
                          </TableCell>
                          <TableCell>
                            <strong className="text-sm">{s.name}</strong>
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
                          </TableCell>
                          {[s.ma, s.st, s.ag, s.pa, s.av].map((x, i) => (
                            <TableCell
                              key={i}
                              className="text-center font-mono text-xs"
                            >
                              {x}
                            </TableCell>
                          ))}
                          <TableCell className="text-xs text-muted-foreground">
                            {s.skills.map(skillName).join(", ")}
                          </TableCell>
                          <TableCell className="pr-5 text-right font-mono text-xs">
                            {gold(s.cost)}
                          </TableCell>
                        </TableRow>
                      )
                    );
                  })}
                </TableBody>
              </Table>
            )}
            {!readOnly && (
              <div className="flex items-center justify-between border-t px-5 py-3">
                <p className="text-xs text-muted-foreground">
                  {totals.playerCount}/16 {t("players")}
                </p>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={
                    starChoices(team.stars).length >= 2 ||
                    totals.playerCount >= 16 ||
                    (rules.id === "world-cup-2027" && team.players.length < 11)
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
          </section>
          <section className="rounded-xl border bg-card p-5">
            <Tabs defaultValue="staff">
              <TabsList className="no-print">
                <TabsTrigger value="staff">{t("staff")}</TabsTrigger>
                <TabsTrigger value="inducements">
                  {t("inducements")}
                </TabsTrigger>
              </TabsList>
              <TabsContent
                value="staff"
                forceMount
                className="mt-3 data-[state=inactive]:hidden print:!block"
              >
                <h2 className="section-title mb-2">{t("staff")}</h2>
                {(
                  [
                    ["rerolls", roster.rerolls.cost, roster.rerolls.max],
                    ["apothecary", 50000, roster.apothecary ? 1 : 0],
                    ["assistantCoaches", 10000, 6],
                    ["cheerleaders", 10000, 6],
                    [
                      "dedicatedFans",
                      5000,
                      team.rulesetId === "bb2025-default" ? 6 : 0,
                    ],
                  ] as const
                ).map(([key, cost, max]) => (
                  <Counter
                    key={key}
                    label={t(key)}
                    value={team.staff[key]}
                    cost={cost}
                    max={max}
                    disabled={readOnly}
                    onChange={(v) => staff(key, v)}
                  />
                ))}
              </TabsContent>
              <TabsContent
                value="inducements"
                forceMount
                className="mt-3 data-[state=inactive]:hidden print:!block"
              >
                <h2 className="section-title mb-2">{t("inducements")}</h2>
                {eligibleInducements.length ? (
                  eligibleInducements.map((i) => {
                    const info = inducementInfo(team, i);
                    return (
                      <Counter
                        key={i.id}
                        label={i.name}
                        value={team.inducements[i.id] ?? 0}
                        max={info.allowed ? info.max : 0}
                        cost={info.cost}
                        disabled={readOnly}
                        onChange={(v) =>
                          change({
                            ...team,
                            inducements: { ...team.inducements, [i.id]: v },
                          })
                        }
                      />
                    );
                  })
                ) : (
                  <p className="py-5 text-sm text-muted-foreground">
                    {t("noInducements")}
                  </p>
                )}
              </TabsContent>
            </Tabs>
          </section>
          <section className="rounded-xl border bg-card p-5">
            <h2 className="section-title mb-4">{t("notes")}</h2>
            {readOnly ? (
              <p className="whitespace-pre-wrap text-sm leading-relaxed">
                {team.notes || "—"}
              </p>
            ) : (
              <Textarea
                value={team.notes}
                maxLength={2000}
                placeholder={t("notesHint")}
                className="min-h-24"
                onChange={(e) => change({ ...team, notes: e.target.value })}
              />
            )}
          </section>
        </div>
        <aside className="budget-side space-y-4 md:sticky md:top-6">
          <section className="print-break-avoid overflow-hidden rounded-xl border bg-card">
            <div className="bg-primary p-5 text-primary-foreground">
              <p className="text-[10px] font-semibold tracking-[.16em] opacity-60">
                {t("summary").toUpperCase()}
              </p>
              <div className="mt-4 flex items-end justify-between">
                <span className="display-font text-4xl">
                  {gold(totals.teamGold)}
                </span>
                <span className="pb-1 font-mono text-xs opacity-60">
                  / {gold(totals.budget.teamBudget)} GP
                </span>
              </div>
              <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/15">
                <div
                  className={`h-full transition-[width] ${totals.remaining < 0 ? "bg-orange-300" : "bg-lime-200"}`}
                  style={{
                    width: `${Math.min(100, (totals.teamGold / totals.budget.teamBudget) * 100)}%`,
                  }}
                />
              </div>
              <div className="mt-3 flex justify-between text-xs">
                <span className="opacity-70">{t("remaining")}</span>
                <span className="font-mono">{gold(totals.remaining)} GP</span>
              </div>
            </div>
            <div className="space-y-3 p-5 text-xs">
              {[
                [t("players"), totals.players],
                [t("staff"), totals.staff],
                [t("starPlayers"), totals.starGold],
                [t("inducements"), totals.inducements],
              ].map(([label, n]) => (
                <div className="flex justify-between" key={label}>
                  <span className="text-muted-foreground">{label}</span>
                  <span className="font-mono">{gold(n as number)}</span>
                </div>
              ))}
              {rules.id !== "bb2025-default" && (
                <div className="border-t pt-3">
                  <div className="flex justify-between font-semibold">
                    <span>{t("skillAllowance")}</span>
                    <span className="font-mono">
                      {rules.skillCurrency
                        ? totals.skills
                        : gold(totals.skills)}{" "}
                      /{" "}
                      {rules.skillCurrency
                        ? totals.budget.skillGold
                        : gold(totals.budget.skillGold)}{" "}
                      {rules.skillCurrency === "spp"
                        ? "SPP"
                        : rules.skillCurrency === "sp"
                          ? "SP"
                          : "GP"}
                    </span>
                  </div>
                  {totals.starTax > 0 && (
                    <p className="mt-2 text-muted-foreground">
                      {t("starPlayers")}:{" "}
                      {rules.skillCurrency
                        ? totals.starTax
                        : gold(totals.starTax)}{" "}
                      {rules.skillCurrency?.toUpperCase() ?? "GP"}
                    </p>
                  )}
                </div>
              )}
              {rules.id === "eurobowl-2026" && (
                <div className="border-t pt-3">
                  <div className="flex justify-between">
                    <span>{t("flowingFunds")}</span>
                    <span className="font-mono">
                      {gold(totals.fundsUsed)} /{" "}
                      {gold(totals.budget.flowingFunds)}
                    </span>
                  </div>
                  <p className="mt-2 leading-relaxed text-muted-foreground">
                    {t("flowingHint")}
                  </p>
                </div>
              )}
              <div className="flex justify-between border-t pt-3">
                <span>{t("tier")}</span>
                <span>{totals.tier || roster.tier}</span>
              </div>
            </div>
          </section>
          <section
            className={`relative overflow-hidden rounded-xl border p-5 ${validation.valid ? "border-emerald-300 bg-emerald-50" : "bg-card"}`}
            aria-live="polite"
          >
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
                <BorderBeam
                  size={120}
                  duration={9}
                  colorFrom="#84a97b"
                  colorTo="#e9eddf"
                />
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
          </section>
          {!readOnly && (
            <div className="no-print space-y-3">
              {isAuthenticated ? (
                <Button
                  className="w-full"
                  disabled={
                    saving || (!dirty && revision > 0) || !team.name.trim()
                  }
                  onClick={() => void saveTeam()}
                >
                  {saving ? (
                    <span className="animate-pulse">{t("saving")}</span>
                  ) : (
                    <>
                      <Save className="size-4" />
                      {t(revision ? "saveChanges" : "saveTeam")}
                    </>
                  )}
                </Button>
              ) : (
                <LoginButton className="w-full" />
              )}
              <p className="flex justify-center gap-1.5 text-[10px] text-muted-foreground">
                <Check className="size-3" />
                {t("draftSaved")}
              </p>
              {revision > 0 && (
                <>
                  <Button asChild variant="outline" className="w-full">
                    <Link href={`/teams/${team.uuid}`}>
                      {t("viewTeam")}
                      <ArrowUpRight className="size-4" />
                    </Link>
                  </Button>
                  <p className="text-center text-[10px] leading-relaxed text-muted-foreground">
                    {t("savedHint")}
                  </p>
                </>
              )}
            </div>
          )}
          <Link
            href="/rules"
            className="no-print block text-center text-xs text-muted-foreground hover:underline"
          >
            {t("rulesSources")} · {t("rulesAsOf")}
          </Link>
        </aside>
      </div>
      <Dialog
        open={dialog !== null}
        onOpenChange={(open) => {
          if (!open) setDialog(null);
        }}
      >
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="display-font text-3xl">
              {t(dialog === "stars" ? "addStar" : "addPlayer")}
            </DialogTitle>
            <DialogDescription>
              {t(dialog === "stars" ? "starHint" : "addPlayersHint")}
            </DialogDescription>
          </DialogHeader>
          {dialog === "players" ? (
            <div className="mt-2 grid gap-3 sm:grid-cols-2">
              {roster.players.map((p) => {
                const count = team.players.filter(
                    (x) => x.positionId === p.id,
                  ).length,
                  max = Number(p.qty.split("-")[1]);
                return (
                  <button
                    key={p.id}
                    className="rounded-xl border bg-card p-4 text-left transition-colors hover:bg-secondary disabled:opacity-40"
                    disabled={totals.playerCount >= 16 || count >= max}
                    onClick={() =>
                      change({
                        ...team,
                        players: [
                          ...team.players,
                          {
                            id: crypto.randomUUID(),
                            positionId: p.id,
                            name: "",
                            skills: [],
                          },
                        ],
                      })
                    }
                  >
                    <div className="flex justify-between gap-2">
                      <strong className="text-sm">{p.position}</strong>
                      <Plus className="size-4 text-primary" />
                    </div>
                    <div className="mt-3 flex gap-4 font-mono text-xs">
                      <span>{gold(p.cost)} GP</span>
                      <span className="text-muted-foreground">
                        {count}/{max}
                      </span>
                    </div>
                    <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                      {p.skills.map(skillName).join(", ") || "—"}
                    </p>
                  </button>
                );
              })}
            </div>
          ) : (
            <>
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t("searchRosters")}
                aria-label={t("starPlayers")}
              />
              <div className="grid gap-3 sm:grid-cols-2">
                {allowedStars.map((s) => (
                  <button
                    key={s.id}
                    className="rounded-xl border bg-card p-4 text-left hover:bg-secondary"
                    onClick={() => hireStar(s.id)}
                  >
                    <strong className="text-sm">
                      {(starPairs.find((p) => p.includes(s.id)) ?? [s.id])
                        .map((id) => stars.find((s) => s.id === id)?.name)
                        .join(" & ")}
                    </strong>
                    <p className="mt-2 font-mono text-xs">
                      {gold(
                        (
                          starPairs.find((p) => p.includes(s.id)) ?? [s.id]
                        ).reduce(
                          (sum, id) =>
                            sum + (stars.find((s) => s.id === id)?.cost ?? 0),
                          0,
                        ),
                      )}{" "}
                      GP
                    </p>
                    <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                      {s.skills.map(skillName).join(", ")}
                    </p>
                  </button>
                ))}
              </div>
              {!allowedStars.length && (
                <p className="py-6 text-sm text-muted-foreground">
                  {t("noStars")}
                </p>
              )}
            </>
          )}
          <Button variant="outline" onClick={() => setDialog(null)}>
            {t("close")}
          </Button>
        </DialogContent>
      </Dialog>
      <Dialog
        open={!!currentPlayer}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
      >
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle className="display-font text-3xl">
              {t("managePlayer")}
            </DialogTitle>
            <DialogDescription>{position?.position}</DialogDescription>
          </DialogHeader>
          {currentPlayer && position && (
            <>
              <label className="text-xs font-medium">
                {t("playerName")}
                <Input
                  value={currentPlayer.name}
                  maxLength={80}
                  className="mt-2"
                  onChange={(e) => editPlayer({ name: e.target.value })}
                />
              </label>
              {roster.specialRules.includes("Team Captain") &&
                !position.position.includes("Big Guy") && (
                  <Button
                    variant="outline"
                    onClick={() => {
                      const next = { ...team };
                      if (next.captainId === currentPlayer.id)
                        delete next.captainId;
                      else next.captainId = currentPlayer.id;
                      next.players = next.players.map((p) =>
                        p.id === currentPlayer.id
                          ? {
                              ...p,
                              skills: p.skills.filter((s) => s !== "pro"),
                            }
                          : p,
                      );
                      change(next);
                    }}
                  >
                    {t(
                      team.captainId === currentPlayer.id
                        ? "removeCaptain"
                        : "makeCaptain",
                    )}
                  </Button>
                )}
              <div>
                <p className="eyebrow mb-2">{t("builtInSkills")}</p>
                <p className="text-sm text-muted-foreground">
                  {[
                    ...position.skills,
                    ...(team.captainId === currentPlayer.id ? ["pro"] : []),
                  ]
                    .map(skillName)
                    .join(", ") || "—"}
                </p>
              </div>
              <div>
                <p className="eyebrow mb-3">{t("addedSkills")}</p>
                <div className="flex flex-wrap gap-2">
                  {currentPlayer.skills.map((id) => (
                    <Button
                      key={id}
                      variant="secondary"
                      size="sm"
                      onClick={() =>
                        editPlayer({
                          skills: currentPlayer.skills.filter((s) => s !== id),
                        })
                      }
                    >
                      {skillName(id)}
                      <X className="size-3" />
                    </Button>
                  ))}
                  {!currentPlayer.skills.length && (
                    <p className="text-sm text-muted-foreground">
                      {t("noSkills")}
                    </p>
                  )}
                </div>
              </div>
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t("searchSkills")}
                aria-label={t("searchSkills")}
              />
              <div className="grid max-h-64 grid-cols-2 gap-2 overflow-y-auto">
                {skills
                  .filter(
                    (s) =>
                      skillAccess(position, s.id) &&
                      !position.skills.some((x) => x.split(":")[0] === s.id) &&
                      !currentPlayer.skills.includes(s.id) &&
                      !(
                        team.captainId === currentPlayer.id && s.id === "pro"
                      ) &&
                      s.name.toLowerCase().includes(search.toLowerCase()),
                  )
                  .map((s) => (
                    <button
                      key={s.id}
                      disabled={
                        currentPlayer.skills.length >=
                        Math.min(
                          6,
                          rules.teamOverrides?.[roster.id]
                            ?.maxSkillsPerPlayer ??
                            (rules.id === "eurobowl-2026"
                              ? 2
                              : rules.maxAdvancementsPerPlayer),
                        )
                      }
                      className="rounded-lg border p-3 text-left text-xs hover:bg-secondary disabled:opacity-40"
                      onClick={() =>
                        editPlayer({ skills: [...currentPlayer.skills, s.id] })
                      }
                    >
                      <strong>{s.name}</strong>
                      <p className="mt-1 text-[10px] text-muted-foreground">
                        {t(skillAccess(position, s.id)!)}
                        {s.isElite ? ` · ${t("elite")}` : ""}
                      </p>
                    </button>
                  ))}
              </div>
              <div className="flex justify-between border-t pt-4">
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => {
                    const next = {
                      ...team,
                      players: team.players.filter((p) => p.id !== selected),
                    };
                    if (next.captainId === selected) delete next.captainId;
                    change(next);
                    setSelected(null);
                  }}
                >
                  <Trash2 className="size-4" />
                  {t("removePlayer")}
                </Button>
                <Button onClick={() => setSelected(null)}>{t("close")}</Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
