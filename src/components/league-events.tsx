"use client";

import { useState } from "react";
import { useTranslations } from "gt-next";
import type { FunctionReturnType } from "convex/server";
import {
  Plus,
  Pencil,
  Trash2,
  Check,
  ListOrdered,
  Users,
  HeartPulse,
  X,
} from "lucide-react";
import { api } from "../../convex/_generated/api";
import { casualtyOutcome } from "@/domain/league-rules";
import {
  casualtyCauses,
  matchEventKinds,
  newMatchEvent,
  projectMatchEvents,
  resolvedCasualty,
  sortMatchEvents,
  type MatchEvent,
} from "@/domain/match-events";
import {
  snapshotPlayerNumber,
  leaguePlayerLabel,
} from "@/lib/league-player-label";
import { useBeforeUnload } from "@/lib/use-before-unload";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "./dialog";
import { LeagueField, LeagueSelect } from "./league-field";
import { PlayerIcon } from "./player-icon";
import { TableSkills } from "./skill-box";
import { positionLabel } from "./position-name";

type Data = FunctionReturnType<typeof api.leagues.getMatch>;
type Save = (
  event: MatchEvent,
  version: number,
  deleted?: boolean,
) => Promise<boolean>;

export function LeagueEvents({
  data,
  editable,
  onSave,
  review = false,
  onDraftChange,
  error,
  busy = false,
}: {
  data: Data;
  editable: boolean;
  onSave: Save;
  review?: boolean;
  onDraftChange: (open: boolean) => void;
  error?: string;
  busy?: boolean;
}) {
  const t = useTranslations();
  const [tab, setTab] = useState<"timeline" | "roster">("timeline");
  const [side, setSide] = useState(
    data.away?.coachId === data.viewerId ? data.away._id : data.home._id,
  );
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<{
    event: MatchEvent;
    version: number;
  } | null>(null);
  const ledger = data.playEvents ?? [];
  const events = sortMatchEvents(ledger.map((row) => row.event));
  const label = (id: string) => {
    const row = data.players.find((player) => player.playerId === id);
    if (!row) return t("player");
    const teammates = data.players.filter(
      (player) => player.entryId === row.entryId,
    );
    return leaguePlayerLabel(
      row.name,
      positionLabel(row.snapshot.positionName),
      snapshotPlayerNumber(
        row.sourcePlayerId,
        row.entryId === data.home._id
          ? data.match.homeSnapshot?.players
          : data.match.awaySnapshot?.players,
        teammates.indexOf(row) + 1,
      ),
    );
  };
  function open(
    event = newMatchEvent(
      data.players.find((row) => row.entryId === side && row.participated)
        ?.playerId,
    ),
    version = 0,
  ) {
    setEditing({
      event: { ...event, id: event.id || crypto.randomUUID() },
      version,
    });
    onDraftChange(true);
  }
  function close() {
    setEditing(null);
    onDraftChange(false);
  }
  const spp = (id: string) => {
    const row = data.players.find((player) => player.playerId === id)!;
    return Object.entries(row.stats).reduce(
      (sum, [key, count]) =>
        sum +
        count * (row.snapshot.sppRates?.[key as keyof typeof row.stats] ?? 0),
      0,
    );
  };
  const description = (event: MatchEvent) => {
    const actor = label(event.playerId),
      target = event.targetId ? label(event.targetId) : "";
    if (event.kind === "casualty") {
      const original = casualtyOutcome(
        event.casualtyRoll!,
        event.lastingRoll ?? undefined,
      );
      return event.targetId
        ? t("matchEvents.sentences.casualty", {
            actor,
            target,
            injury: t(`matchEvents.injuries.${original.result}`),
          })
        : t("matchEvents.sentences.injury", {
            actor,
            injury: t(`matchEvents.injuries.${original.result}`),
          });
    }
    return t(`matchEvents.sentences.${event.kind}`, { actor, target });
  };
  return (
    <section
      className="overflow-hidden rounded-lg border bg-card"
      aria-label={t("matchEvents.timeline")}
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-3 py-2">
        {review ? (
          <h2 className="text-sm font-semibold">{t("matchEvents.review")}</h2>
        ) : (
          <div className="flex gap-1">
            {(["timeline", "roster"] as const).map((value) => (
              <Button
                key={value}
                size="sm"
                variant={tab === value ? "secondary" : "ghost"}
                aria-pressed={tab === value}
                onClick={() => setTab(value)}
              >
                {value === "timeline" ? (
                  <ListOrdered className="size-4" />
                ) : (
                  <Users className="size-4" />
                )}
                {t(`matchEvents.${value}`)}
                {value === "timeline" && (
                  <span className="font-mono text-xs text-muted-foreground">
                    {events.length}
                  </span>
                )}
              </Button>
            ))}
          </div>
        )}
        {editable && (
          <Button size="sm" onClick={() => open()}>
            <Plus className="size-4" />
            {t("matchEvents.add")}
          </Button>
        )}
      </div>
      {review && (
        <div className="grid grid-cols-1 divide-y border-b sm:grid-cols-2 sm:divide-x sm:divide-y-0">
          {[data.home, data.away].map((entry) => {
            if (!entry) return null;
            const players = data.players.filter(
              (row) => row.entryId === entry._id,
            );
            const mvp = players.find((row) => row.stats.mvp);
            return (
              <div key={entry._id} className="space-y-1 px-3 py-2 text-xs">
                <p className="font-semibold">{entry.team.name}</p>
                <p className="flex flex-wrap gap-x-3 text-muted-foreground">
                  <span className="font-mono text-primary">
                    +{players.reduce((sum, row) => sum + spp(row.playerId), 0)}{" "}
                    SPP
                  </span>
                  <span>
                    {t("leagueUi.stats.sppCas")}:{" "}
                    {players.reduce((sum, row) => sum + row.stats.sppCas, 0)}
                  </span>
                </p>
                <p className={mvp ? "text-muted-foreground" : "text-amber-700"}>
                  MVP ·{" "}
                  {mvp ? label(mvp.playerId) : t("matchEvents.notRecorded")}
                </p>
              </div>
            );
          })}
        </div>
      )}
      {review || tab === "timeline" ? (
        <>
          <p className="border-b bg-secondary/20 px-3 py-2 text-xs text-muted-foreground">
            {t(review ? "matchEvents.reviewHint" : "matchEvents.hint")}
          </p>
          {!events.length ? (
            <div className="flex flex-col items-center gap-3 px-4 py-10 text-center">
              <ListOrdered className="size-7 text-muted-foreground" />
              <p className="text-sm font-medium">{t("matchEvents.empty")}</p>
              <p className="max-w-sm text-xs text-muted-foreground">
                {t("matchEvents.emptyHint")}
              </p>
              {editable && (
                <Button size="sm" variant="outline" onClick={() => open()}>
                  {t("matchEvents.addFirst")}
                </Button>
              )}
            </div>
          ) : (
            <ol className="divide-y">
              {events.map((event, index) => {
                const row = ledger.find((row) => row.event.id === event.id)!;
                const player = data.players.find(
                  (player) => player.playerId === event.playerId,
                )!;
                const injury =
                  event.kind === "casualty" ? resolvedCasualty(event) : null;
                const rate = player.snapshot.sppRates;
                const earned =
                  event.kind === "touchdown"
                    ? rate?.td
                    : event.kind === "completion"
                      ? rate?.com
                      : event.kind === "interception"
                        ? rate?.int
                        : event.kind === "mvp"
                          ? rate?.mvp
                          : event.kind === "casualty" && event.cause === "block"
                            ? rate?.sppCas
                            : event.kind === "throw-team-mate" && event.superb
                              ? rate?.superbThrows
                              : 0;
                return (
                  <li
                    key={event.id}
                    className="flex items-start gap-2 px-3 py-3 sm:gap-3"
                  >
                    <span
                      className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-secondary font-mono text-[10px] text-muted-foreground"
                      title={t("matchEvents.order")}
                    >
                      {index + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="mb-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] text-muted-foreground">
                        <span className="font-semibold uppercase tracking-wide">
                          {t(`matchEvents.kinds.${event.kind}`)}
                        </span>
                        <span>
                          {player.entryId === data.home._id
                            ? data.home.team.name
                            : data.away?.team.name}
                        </span>
                        <span>
                          {event.kind === "mvp"
                            ? t("matchEvents.fullTime")
                            : event.half === null
                              ? t("matchEvents.untimed")
                              : `${t("matchEvents.half")} ${event.half}${event.turn === null ? "" : ` · ${t("matchEvents.turn")} ${event.turn}`}`}
                        </span>
                      </div>
                      <p className="break-words text-sm font-medium leading-5">
                        {description(event)}
                      </p>
                      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                        {!!earned && (
                          <span className="font-mono font-semibold text-primary">
                            +{earned} SPP
                          </span>
                        )}
                        {event.kind === "throw-team-mate" && (
                          <span className="text-primary">
                            {label(event.targetId!)} +1 SPP ·{" "}
                            {t(
                              event.superb
                                ? "matchEvents.superb"
                                : "matchEvents.notSuperb",
                            )}
                          </span>
                        )}
                        {injury && (
                          <span className="contents">
                            <span>
                              {t(`matchEvents.causes.${event.cause}`)} ·{" "}
                              {t("matchEvents.roll")} {event.casualtyRoll}
                            </span>
                            <span
                              className={
                                injury.outcome.dead && !injury.recovered
                                  ? "text-destructive"
                                  : ""
                              }
                            >
                              {t("matchEvents.finalOutcome")}:{" "}
                              {injury.recovered
                                ? t("matchEvents.recovered")
                                : t(
                                    `matchEvents.injuries.${injury.outcome.result}`,
                                  )}
                              {!injury.recovered &&
                              injury.outcome.characteristicReduction
                                ? ` · ${injury.outcome.characteristicReduction.toUpperCase()}`
                                : ""}
                            </span>
                          </span>
                        )}
                        {event.kind === "casualty" && (
                          <span>
                            {event.apothecary
                              ? `${t("apothecary")} · ${event.apothecaryRoll} · ${t(event.keepOriginal ? "matchEvents.keptOriginal" : "matchEvents.usedReroll")}`
                              : t("matchEvents.noApothecary")}
                          </span>
                        )}
                        {event.kind === "knockout" && event.apothecary && (
                          <span>{t("matchEvents.koApothecary")}</span>
                        )}
                        {event.regeneration !== "not-used" && (
                          <span>
                            {t(
                              `matchEvents.regeneration.${event.regeneration}`,
                            )}
                          </span>
                        )}
                        {event.kind === "casualty" &&
                          event.cause !== "block" && (
                            <span>{t("matchEvents.noSpp")}</span>
                          )}
                      </div>
                      {event.notes && (
                        <p className="mt-1 break-words text-xs text-muted-foreground">
                          {event.notes}
                        </p>
                      )}
                      <p className="mt-1 text-[10px] text-muted-foreground">
                        {t("matchEvents.recordedBy", { name: row.actorName })}
                      </p>
                    </div>
                    {editable && (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="size-8 shrink-0"
                        aria-label={`${t("matchEvents.edit")} · ${description(event)}`}
                        onClick={() => open(event, row.version)}
                      >
                        <Pencil className="size-3.5" />
                      </Button>
                    )}
                  </li>
                );
              })}
            </ol>
          )}
        </>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2 border-b p-2">
            {[data.home, data.away].map(
              (entry) =>
                entry && (
                  <Button
                    size="sm"
                    key={entry._id}
                    variant={side === entry._id ? "secondary" : "ghost"}
                    aria-pressed={side === entry._id}
                    onClick={() => setSide(entry._id)}
                  >
                    {entry.team.name}
                  </Button>
                ),
            )}
            <Input
              className="h-8 sm:ml-auto sm:w-48"
              placeholder={t("leagueUx.rosterSearch")}
              aria-label={t("leagueUx.rosterSearch")}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-secondary/30 text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left">{t("player")}</th>
                  {["MA", "ST", "AG", "PA", "AV"].map((stat) => (
                    <th
                      className="hidden px-2 py-2 text-center md:table-cell"
                      key={stat}
                    >
                      {stat}
                    </th>
                  ))}
                  <th className="hidden px-3 text-left lg:table-cell">
                    {t("skills")}
                  </th>
                  <th className="px-2">TD</th>
                  <th className="px-2">SPP</th>
                  <th className="px-3 text-right">{t("matchEvents.events")}</th>
                </tr>
              </thead>
              <tbody>
                {data.players
                  .filter(
                    (row) =>
                      row.entryId === side &&
                      `${label(row.playerId)} ${row.snapshot.positionName}`
                        .toLocaleLowerCase()
                        .includes(search.toLocaleLowerCase()),
                  )
                  .map((row) => (
                    <tr
                      key={row._id}
                      className="border-t hover:bg-secondary/20"
                    >
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-2">
                          <PlayerIcon
                            positionId={row.positionId}
                            className="size-8 shrink-0"
                          />
                          <div>
                            <p className="font-semibold">
                              {label(row.playerId)}
                            </p>
                            <p className="text-[10px] text-muted-foreground">
                              {positionLabel(row.snapshot.positionName)}
                            </p>
                            {(!row.participated ||
                              row.statusAfter !== "active") && (
                              <span className="text-[10px] text-destructive">
                                {t(
                                  `leagueUi.status.${row.participated ? row.statusAfter : row.snapshot.status}`,
                                )}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                      {(["ma", "st", "ag", "pa", "av"] as const).map((stat) => (
                        <td
                          key={stat}
                          className="hidden px-2 text-center font-mono md:table-cell"
                        >
                          {row.snapshot.profile[stat]}
                        </td>
                      ))}
                      <td className="hidden max-w-64 px-3 lg:table-cell">
                        <TableSkills
                          ids={row.snapshot.baseSkills}
                          additionalIds={row.skills.filter(
                            (id) => !row.snapshot.baseSkills.includes(id),
                          )}
                          label={t("skills")}
                        />
                      </td>
                      <td className="px-2 text-center font-mono">
                        {row.stats.td || "—"}
                      </td>
                      <td className="px-2 text-center font-mono font-semibold text-primary">
                        {spp(row.playerId) || "—"}
                      </td>
                      <td className="px-3 text-right">
                        {editable && row.participated ? (
                          <Button
                            size="icon"
                            variant="ghost"
                            className="size-8"
                            aria-label={`${t("matchEvents.add")} · ${label(row.playerId)}`}
                            onClick={() => open(newMatchEvent(row.playerId))}
                          >
                            <Plus className="size-4" />
                          </Button>
                        ) : (
                          "—"
                        )}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </>
      )}
      <Dialog
        open={!!editing}
        onOpenChange={(open) => {
          if (!open && !busy) close();
        }}
      >
        {editing && (
          <EventEditor
            key={`${editing.event.id}:${editing.version}`}
            initial={editing.event}
            version={editing.version}
            data={data}
            label={label}
            onSave={onSave}
            onClose={close}
            error={error}
          />
        )}
      </Dialog>
    </section>
  );
}

function EventEditor({
  initial,
  version,
  data,
  label,
  onSave,
  onClose,
  error,
}: {
  initial: MatchEvent;
  version: number;
  data: Data;
  label: (id: string) => string;
  onSave: Save;
  onClose: () => void;
  error?: string;
}) {
  const t = useTranslations();
  const [event, setEvent] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [remove, setRemove] = useState(false);
  useBeforeUnload(true);
  const change = (patch: Partial<MatchEvent>) =>
    setEvent((current) => ({ ...current, ...patch }));
  const linked =
    ["completion", "interception", "throw-team-mate"].includes(event.kind) ||
    (event.kind === "casualty" &&
      ["block", "foul", "special"].includes(event.cause));
  const teammate = ["completion", "throw-team-mate"].includes(event.kind);
  const actor = data.players.find((row) => row.playerId === event.playerId);
  const available = data.players.filter((row) => row.participated);
  let validation = "";
  try {
    projectMatchEvents(
      data.players,
      [
        ...(data.playEvents ?? [])
          .filter((row) => row.event.id !== event.id)
          .map((row) => row.event),
        event,
      ],
      data.home._id,
    );
  } catch (cause) {
    const code =
      cause instanceof Error && /^[A-Z_]+$/.test(cause.message)
        ? cause.message
        : "INVALID_DICE";
    validation = t(`leagueUi.errors.${code}`);
  }
  const current = data.playEvents?.find((row) => row.event.id === event.id);
  const stale = version > 0 && (!current || current.version !== version);
  async function save(deleted = false) {
    setBusy(true);
    try {
      if (await onSave(event, version, deleted)) onClose();
    } finally {
      setBusy(false);
    }
  }
  const playerSelect = (target: boolean) => (
    <LeagueField>
      {t(
        target
          ? teammate
            ? "matchEvents.receiver"
            : event.kind === "interception"
              ? "matchEvents.passer"
              : "matchEvents.victim"
          : event.kind === "casualty" && !linked
            ? "matchEvents.victim"
            : "player",
      )}
      <LeagueSelect
        value={(target ? event.targetId : event.playerId) ?? ""}
        onChange={(e) =>
          target
            ? change({ targetId: e.target.value || null })
            : change({ playerId: e.target.value, targetId: null })
        }
      >
        <option value="">{t("matchEvents.choosePlayer")}</option>
        {[data.home, data.away].map(
          (entry) =>
            entry && (
              <optgroup key={entry._id} label={entry.team.name}>
                {available
                  .filter(
                    (row) =>
                      row.entryId === entry._id &&
                      (!target ||
                        (row.playerId !== event.playerId &&
                          (teammate
                            ? row.entryId === actor?.entryId
                            : row.entryId !== actor?.entryId))),
                  )
                  .map((row) => (
                    <option key={row.playerId} value={row.playerId}>
                      {label(row.playerId)}
                    </option>
                  ))}
              </optgroup>
            ),
        )}
      </LeagueSelect>
    </LeagueField>
  );
  const rollFields = (apothecary: boolean) => {
    const rollKey = apothecary ? "apothecaryRoll" : "casualtyRoll",
      lastingKey = apothecary ? "apothecaryLastingRoll" : "lastingRoll";
    const roll = event[rollKey];
    return (
      <div className="grid grid-cols-2 gap-3">
        <LeagueField>
          {t(apothecary ? "matchEvents.reroll" : "matchEvents.casualtyRoll")}
          <Input
            type="number"
            min={1}
            max={99}
            value={roll ?? ""}
            onChange={(e) =>
              change({
                [rollKey]: e.target.value ? Number(e.target.value) : null,
                [lastingKey]: null,
              })
            }
          />
        </LeagueField>
        {roll !== null && roll >= 13 && roll <= 14 ? (
          <LeagueField>
            {t("leagueUi.lastingRoll")}
            <LeagueSelect
              value={event[lastingKey] ?? ""}
              onChange={(e) =>
                change({
                  [lastingKey]: e.target.value ? Number(e.target.value) : null,
                })
              }
            >
              <option value="">—</option>
              {[1, 2, 3, 4, 5, 6].map((value) => (
                <option key={value} value={value}>
                  {value} · {["AV", "AV", "MA", "PA", "AG", "ST"][value - 1]}
                </option>
              ))}
            </LeagueSelect>
          </LeagueField>
        ) : (
          <div className="self-end pb-2 text-xs text-muted-foreground">
            {roll !== null && Number.isInteger(roll) && roll >= 1 && roll <= 99
              ? t(`matchEvents.injuries.${casualtyOutcome(roll, 1).result}`)
              : t("matchEvents.modifiedRoll")}
          </div>
        )}
      </div>
    );
  };
  return (
    <DialogContent
      className="max-h-[90dvh] overflow-y-auto p-4 sm:max-w-xl sm:p-5"
      showCloseButton={!busy}
    >
      <DialogHeader>
        <DialogTitle>
          {t(version ? "matchEvents.edit" : "matchEvents.add")}
        </DialogTitle>
        <DialogDescription>{t("matchEvents.editorHint")}</DialogDescription>
      </DialogHeader>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!validation && !stale && !busy) void save();
        }}
      >
        <fieldset disabled={busy} className="space-y-4">
          <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
            {matchEventKinds.map((kind) => (
              <button
                type="button"
                key={kind}
                aria-pressed={event.kind === kind}
                className={`flex min-h-11 items-center justify-center rounded-md border px-2 py-2 text-xs font-medium focus-visible:outline-2 focus-visible:outline-ring ${event.kind === kind ? "border-primary bg-primary/10 text-primary" : "hover:bg-secondary"}`}
                onClick={() =>
                  setEvent({
                    ...newMatchEvent(event.playerId),
                    id: event.id,
                    kind,
                    half: event.half,
                    turn: event.turn,
                    notes: event.notes,
                  })
                }
              >
                {t(`matchEvents.kinds.${kind}`)}
              </button>
            ))}
          </div>
          {event.kind === "casualty" && (
            <LeagueField>
              {t("matchEvents.cause")}
              <LeagueSelect
                value={event.cause}
                onChange={(e) =>
                  change({
                    cause: e.target.value as MatchEvent["cause"],
                    targetId: null,
                  })
                }
              >
                {casualtyCauses.map((cause) => (
                  <option key={cause} value={cause}>
                    {t(`matchEvents.causes.${cause}`)}
                  </option>
                ))}
              </LeagueSelect>
            </LeagueField>
          )}
          <div className={`grid gap-3 ${linked ? "sm:grid-cols-2" : ""}`}>
            {playerSelect(false)}
            {linked && playerSelect(true)}
          </div>
          {event.kind === "casualty" && (
            <div className="space-y-3 rounded-md border bg-secondary/10 p-3">
              <h3 className="flex items-center gap-2 text-xs font-semibold">
                <HeartPulse className="size-4" />
                {t("matchEvents.injuryResolution")}
              </h3>
              {rollFields(false)}
              <label className="flex min-h-8 items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={event.apothecary}
                  onChange={(e) =>
                    change({
                      apothecary: e.target.checked,
                      apothecaryRoll: null,
                      apothecaryLastingRoll: null,
                      keepOriginal: false,
                    })
                  }
                />
                {t("matchEvents.usedApothecary")}
              </label>
              {event.apothecary && (
                <>
                  {rollFields(true)}
                  <LeagueField>
                    {t("matchEvents.keepResult")}
                    <LeagueSelect
                      value={event.keepOriginal ? "original" : "reroll"}
                      onChange={(e) =>
                        change({ keepOriginal: e.target.value === "original" })
                      }
                    >
                      <option value="reroll">
                        {t("matchEvents.usedReroll")}
                      </option>
                      <option value="original">
                        {t("matchEvents.keptOriginal")}
                      </option>
                    </LeagueSelect>
                  </LeagueField>
                </>
              )}
              <LeagueField>
                {t("matchEvents.regenerationLabel")}
                <LeagueSelect
                  value={event.regeneration}
                  onChange={(e) =>
                    change({
                      regeneration: e.target
                        .value as MatchEvent["regeneration"],
                    })
                  }
                >
                  {(["not-used", "failed", "succeeded"] as const).map(
                    (value) => (
                      <option key={value} value={value}>
                        {t(`matchEvents.regeneration.${value}`)}
                      </option>
                    ),
                  )}
                </LeagueSelect>
              </LeagueField>
              <p className="text-xs text-muted-foreground">
                {t(
                  event.cause === "block"
                    ? "matchEvents.blockSppHint"
                    : "matchEvents.noSppHint",
                )}
              </p>
            </div>
          )}
          {event.kind === "knockout" && (
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={event.apothecary}
                onChange={(e) => change({ apothecary: e.target.checked })}
              />
              {t("matchEvents.koApothecary")}
            </label>
          )}
          {event.kind === "throw-team-mate" && (
            <div className="space-y-2 rounded-md border p-3">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={event.superb}
                  onChange={(e) => change({ superb: e.target.checked })}
                />
                {t("matchEvents.superb")}
              </label>
              <p className="text-xs text-muted-foreground">
                {t("matchEvents.throwHint")}
              </p>
            </div>
          )}
          {event.kind !== "mvp" && (
            <div className="grid grid-cols-2 gap-3">
              <LeagueField>
                {t("matchEvents.halfOptional")}
                <LeagueSelect
                  value={event.half ?? ""}
                  onChange={(e) =>
                    change({
                      half: e.target.value ? Number(e.target.value) : null,
                      turn: null,
                    })
                  }
                >
                  <option value="">{t("matchEvents.notRecorded")}</option>
                  {[1, 2, 3].map((half) => (
                    <option key={half} value={half}>
                      {half === 3
                        ? t("matchEvents.extraTime")
                        : `${t("matchEvents.half")} ${half}`}
                    </option>
                  ))}
                </LeagueSelect>
              </LeagueField>
              <LeagueField>
                {t("matchEvents.turnOptional")}
                <LeagueSelect
                  disabled={event.half === null}
                  value={event.turn ?? ""}
                  onChange={(e) =>
                    change({
                      turn: e.target.value ? Number(e.target.value) : null,
                    })
                  }
                >
                  <option value="">{t("matchEvents.notRecorded")}</option>
                  {[1, 2, 3, 4, 5, 6, 7, 8].map((turn) => (
                    <option key={turn}>{turn}</option>
                  ))}
                </LeagueSelect>
              </LeagueField>
            </div>
          )}
          <LeagueField>
            {t("matchEvents.notes")}
            <Input
              maxLength={500}
              value={event.notes}
              onChange={(e) => change({ notes: e.target.value })}
            />
          </LeagueField>
          {error && (
            <p role="alert" className="text-xs text-destructive">
              {error}
            </p>
          )}
          {(stale || validation) && (
            <p role="status" className="text-xs text-muted-foreground">
              {stale ? t("matchEvents.stale") : validation}
            </p>
          )}
          <div className="flex flex-wrap items-center gap-2 border-t pt-3">
            {version > 0 && (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="text-destructive"
                onClick={() => setRemove(!remove)}
              >
                <Trash2 className="size-3.5" />
                {t("matchEvents.remove")}
              </Button>
            )}
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="ml-auto"
              onClick={onClose}
            >
              {t("cancel")}
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={busy || stale || !!validation}
            >
              <Check className="size-4" />
              {t(busy ? "matchEvents.saving" : "matchEvents.save")}
            </Button>
          </div>
          {remove && (
            <div className="flex flex-wrap items-center gap-2 rounded-md border border-destructive/30 p-3 text-xs">
              <span className="flex-1">{t("matchEvents.removeHint")}</span>
              <Button
                type="button"
                size="sm"
                variant="destructive"
                disabled={busy || stale}
                onClick={() => void save(true)}
              >
                {t("matchEvents.remove")}
              </Button>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                aria-label={t("cancel")}
                onClick={() => setRemove(false)}
              >
                <X className="size-3" />
              </Button>
            </div>
          )}
        </fieldset>
      </form>
    </DialogContent>
  );
}
