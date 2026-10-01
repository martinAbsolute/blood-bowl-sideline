"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { useTranslations } from "gt-next";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Textarea } from "./ui/textarea";
import { EditorSelect } from "./editor-select";
import { LeagueError, LeagueSection, useLeagueAction } from "./league-ui";

export function CommissionerAdvancementUndo({
  playerId,
  revision,
}: {
  playerId: Id<"leaguePlayers">;
  revision: number;
}) {
  const t = useTranslations();
  const undo = useMutation(api.leagues.undoLatestAdvancement);
  const action = useLeagueAction();
  const [reason, setReason] = useState("");
  return (
    <form
      className="mt-4 space-y-2 rounded-lg border border-primary/20 p-3"
      onSubmit={(event) => {
        event.preventDefault();
        void action
          .run(() =>
            undo({
              playerId,
              expectedRevision: revision,
              reason: reason.trim(),
            }),
          )
          .then((saved) => {
            if (saved) setReason("");
          });
      }}
    >
      <p className="text-xs text-muted-foreground">
        {t("leagueUi.undoAdvancementHint")}
      </p>
      <LeagueError message={action.error} />
      <Input
        aria-label={t("leagueUi.reason")}
        placeholder={t("leagueUi.reason")}
        className="h-10"
        maxLength={1000}
        required
        value={reason}
        onChange={(event) => setReason(event.target.value)}
      />
      <Button
        type="submit"
        variant="outline"
        className="h-10"
        disabled={action.busy || reason.trim().length < 3}
      >
        {t("leagueUi.undoAdvancement")}
      </Button>
    </form>
  );
}

export function CommissionerRuling({
  matchId,
  revision,
}: {
  matchId: Id<"leagueMatches">;
  revision: number;
}) {
  const t = useTranslations();
  const adjudicate = useMutation(api.leagues.adjudicateMatch);
  const action = useLeagueAction();
  const [outcome, setOutcome] = useState<
    "home-win" | "away-win" | "draw" | "void" | ""
  >("");
  const [reason, setReason] = useState("");
  return (
    <LeagueSection title={t("leagueUi.adjudicate")}>
      <p className="mb-4 text-sm text-muted-foreground">
        {t("leagueUi.adjudicateHint")}
      </p>
      <LeagueError message={action.error} />
      <form
        className="space-y-3"
        onSubmit={(event) => {
          event.preventDefault();
          if (!outcome) return;
          void action
            .run(() =>
              adjudicate({
                matchId,
                outcome,
                reason: reason.trim(),
                expectedRevision: revision,
              }),
            )
            .then((saved) => {
              if (saved) setReason("");
            });
        }}
      >
        <EditorSelect
          aria-label={t("leagueUi.adjudicate")}
          value={outcome}
          onChange={(event) => setOutcome(event.target.value as typeof outcome)}
        >
          <option value="" disabled>
            {t("leagueUx.chooseRuling")}
          </option>
          {["home-win", "away-win", "draw", "void"].map((value) => (
            <option key={value} value={value}>
              {t("leagueUi." + value)}
            </option>
          ))}
        </EditorSelect>
        <label className="block text-sm">
          {t("leagueUi.reason")}
          <Textarea
            className="mt-1"
            maxLength={1000}
            required
            value={reason}
            onChange={(event) => setReason(event.target.value)}
          />
        </label>
        <Button
          className="h-11"
          type="submit"
          disabled={action.busy || !outcome || reason.trim().length < 3}
        >
          {t("leagueUi.saveRuling")}
        </Button>
      </form>
    </LeagueSection>
  );
}

export function CommissionerWithdrawal({
  entries,
}: {
  entries: {
    _id: Id<"leagueTeams">;
    team: { name: string };
    withdrawn: boolean;
  }[];
}) {
  const t = useTranslations();
  const withdraw = useMutation(api.leagues.withdrawEntry);
  const action = useLeagueAction();
  const [entryId, setEntryId] = useState("");
  const [reason, setReason] = useState("");
  return (
    <LeagueSection title={t("leagueUi.withdrawEntry")}>
      <p className="mb-4 text-sm text-muted-foreground">
        {t("leagueUi.withdrawHint")}
      </p>
      <LeagueError message={action.error} />
      <form
        className="space-y-3"
        onSubmit={(event) => {
          event.preventDefault();
          void action
            .run(() =>
              withdraw({
                entryId: entryId as Id<"leagueTeams">,
                reason: reason.trim(),
              }),
            )
            .then((saved) => {
              if (saved) {
                setReason("");
                setEntryId("");
              }
            });
        }}
      >
        <EditorSelect
          value={entryId}
          aria-label={t("team")}
          onChange={(event) => setEntryId(event.target.value)}
        >
          <option value="">{t("leagueUi.chooseTeam")}</option>
          {entries
            .filter((entry) => !entry.withdrawn)
            .map((entry) => (
              <option key={entry._id} value={entry._id}>
                {entry.team.name}
              </option>
            ))}
        </EditorSelect>
        <label className="block text-sm">
          {t("leagueUi.reason")}
          <Textarea
            className="mt-1"
            maxLength={1000}
            required
            value={reason}
            onChange={(event) => setReason(event.target.value)}
          />
        </label>
        <Button
          type="submit"
          className="h-11"
          variant="destructive"
          disabled={action.busy || !entryId || reason.trim().length < 3}
        >
          {t("leagueUi.withdrawEntry")}
        </Button>
      </form>
    </LeagueSection>
  );
}

export function CommissionerTreasury({
  entryId,
  treasury,
  revision,
}: {
  entryId: Id<"leagueTeams">;
  treasury: number;
  revision: number;
}) {
  const t = useTranslations();
  const correct = useMutation(api.leagues.correctCareer);
  const action = useLeagueAction();
  const [draft, setDraft] = useState<{
    revision: number;
    amount: number;
    reason: string;
  } | null>(null);
  const current =
    draft?.revision === revision
      ? draft
      : { revision, amount: treasury, reason: "" };
  return (
    <LeagueSection title={t("leagueUi.correctTreasury")}>
      <LeagueError message={action.error} />
      <form
        className="space-y-3"
        onSubmit={(event) => {
          event.preventDefault();
          void action
            .run(() =>
              correct({
                entryId,
                treasury: current.amount,
                reason: current.reason.trim(),
                expectedRevision: current.revision,
              }),
            )
            .then((saved) => {
              if (saved) setDraft(null);
            });
        }}
      >
        <label className="block text-sm">
          {t("leagueUi.treasury")} (GP)
          <Input
            className="mt-1 h-11"
            type="number"
            min={0}
            max={100000000}
            step={5000}
            value={current.amount}
            disabled={action.busy}
            onChange={(event) =>
              setDraft({ ...current, amount: Number(event.target.value) })
            }
          />
        </label>
        <label className="block text-sm">
          {t("leagueUi.reason")}
          <Textarea
            className="mt-1"
            maxLength={1000}
            required
            value={current.reason}
            disabled={action.busy}
            onChange={(event) =>
              setDraft({ ...current, reason: event.target.value })
            }
          />
        </label>
        <Button
          type="submit"
          className="h-11"
          disabled={action.busy || current.reason.trim().length < 3}
        >
          {t("leagueUi.saveCorrection")}
        </Button>
      </form>
    </LeagueSection>
  );
}
