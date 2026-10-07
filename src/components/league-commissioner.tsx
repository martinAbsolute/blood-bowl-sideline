"use client";

import { useState, type ReactNode } from "react";
import {
  ArrowUpRight,
  Coins,
  Gavel,
  ShieldCheck,
  UserMinus,
} from "lucide-react";
import { useMutation } from "convex/react";
import { useTranslations } from "gt-next";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Textarea } from "./ui/textarea";
import { LeagueField, LeagueSelect } from "./league-field";
import { LeagueError, LeagueSection, useLeagueAction } from "./league-ui";
import { Dialog } from "./dialog";
import {
  LeagueDialogBody,
  LeagueDialogContent,
  LeagueDialogFooter,
  LeagueDialogHeader,
} from "./league-dialog";

function CommissionerAction({
  title,
  description,
  icon,
  open,
  onOpenChange,
  busy,
  children,
  destructive = false,
}: {
  title: string;
  description: string;
  icon: ReactNode;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  busy: boolean;
  children: ReactNode;
  destructive?: boolean;
}) {
  return (
    <>
      <LeagueSection
        title={
          <span className="flex items-center gap-2">
            {icon}
            {title}
          </span>
        }
      >
        <p className="text-sm leading-relaxed text-muted-foreground">
          {description}
        </p>
        <Button
          variant="outline"
          className="mt-4 min-h-11"
          onClick={() => onOpenChange(true)}
        >
          {title}
          <ArrowUpRight className="size-4" />
        </Button>
      </LeagueSection>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (!busy) onOpenChange(next);
        }}
      >
        <LeagueDialogContent showCloseButton={!busy}>
          <LeagueDialogHeader
            title={title}
            description={description}
            icon={icon}
            destructive={destructive}
          />
          {children}
        </LeagueDialogContent>
      </Dialog>
    </>
  );
}

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
  const [open, setOpen] = useState(false);
  const adjudicate = useMutation(api.leagues.adjudicateMatch);
  const action = useLeagueAction();
  const [outcome, setOutcome] = useState<
    "home-win" | "away-win" | "draw" | "void" | ""
  >("");
  const [reason, setReason] = useState("");
  return (
    <CommissionerAction
      title={t("leagueUi.adjudicate")}
      description={t("leagueUi.adjudicateHint")}
      icon={<Gavel className="size-4" />}
      open={open}
      onOpenChange={setOpen}
      busy={action.busy}
      destructive={false}
    >
      <form
        className="flex min-h-0 flex-1 flex-col"
        onSubmit={(event) => {
          event.preventDefault();
          if (action.busy || !outcome || reason.trim().length < 3) return;
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
              if (saved) {
                setReason("");
                setOpen(false);
              }
            });
        }}
      >
        <LeagueDialogBody>
          <LeagueError message={action.error} />
          <p className="flex items-start gap-2 rounded-lg border bg-secondary/25 p-3 text-xs text-muted-foreground">
            <ShieldCheck className="size-4 shrink-0" />
            {t("leagueDesk.auditedChange")}
          </p>
          <LeagueSelect
            aria-label={t("leagueUi.adjudicate")}
            disabled={action.busy}
            value={outcome}
            onChange={(event) =>
              setOutcome(event.target.value as typeof outcome)
            }
          >
            <option value="" disabled>
              {t("leagueUx.chooseRuling")}
            </option>
            {["home-win", "away-win", "draw", "void"].map((value) => (
              <option key={value} value={value}>
                {t("leagueUi." + value)}
              </option>
            ))}
          </LeagueSelect>
          <LeagueField>
            {t("leagueUi.reason")}
            <Textarea
              className="mt-1"
              maxLength={1000}
              required
              value={reason}
              disabled={action.busy}
              onChange={(event) => setReason(event.target.value)}
            />
          </LeagueField>
        </LeagueDialogBody>
        <LeagueDialogFooter>
          <Button
            type="button"
            variant="outline"
            disabled={action.busy}
            onClick={() => setOpen(false)}
          >
            {t("cancel")}
          </Button>
          <Button
            className="h-11"
            type="submit"
            disabled={action.busy || !outcome || reason.trim().length < 3}
          >
            {t("leagueUi.saveRuling")}
          </Button>
        </LeagueDialogFooter>
      </form>
    </CommissionerAction>
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
  const [open, setOpen] = useState(false);
  const withdraw = useMutation(api.leagues.withdrawEntry);
  const action = useLeagueAction();
  const [entryId, setEntryId] = useState("");
  const [reason, setReason] = useState("");
  return (
    <CommissionerAction
      title={t("leagueUi.withdrawEntry")}
      description={t("leagueUi.withdrawHint")}
      icon={<UserMinus className="size-4" />}
      open={open}
      onOpenChange={setOpen}
      busy={action.busy}
      destructive={true}
    >
      <form
        className="flex min-h-0 flex-1 flex-col"
        onSubmit={(event) => {
          event.preventDefault();
          if (
            action.busy ||
            !entries.some(
              (entry) => entry._id === entryId && !entry.withdrawn,
            ) ||
            reason.trim().length < 3
          )
            return;
          void action
            .run(() =>
              withdraw({
                entryId: entryId as Id<"leagueTeams">,
                reason: reason.trim(),
              }),
            )
            .then((saved) => {
              if (saved) {
                setOpen(false);
                setReason("");
                setEntryId("");
              }
            });
        }}
      >
        <LeagueDialogBody>
          <LeagueError message={action.error} />
          <p className="flex items-start gap-2 rounded-lg border bg-secondary/25 p-3 text-xs text-muted-foreground">
            <ShieldCheck className="size-4 shrink-0" />
            {t("leagueDesk.auditedChange")}
          </p>
          <LeagueSelect
            value={entryId}
            aria-label={t("team")}
            disabled={action.busy}
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
          </LeagueSelect>
          <LeagueField>
            {t("leagueUi.reason")}
            <Textarea
              className="mt-1"
              maxLength={1000}
              required
              value={reason}
              disabled={action.busy}
              onChange={(event) => setReason(event.target.value)}
            />
          </LeagueField>
        </LeagueDialogBody>
        <LeagueDialogFooter>
          <Button
            type="button"
            variant="outline"
            disabled={action.busy}
            onClick={() => setOpen(false)}
          >
            {t("cancel")}
          </Button>
          <Button
            type="submit"
            className="h-11"
            variant="destructive"
            disabled={
              action.busy ||
              !entries.some(
                (entry) => entry._id === entryId && !entry.withdrawn,
              ) ||
              reason.trim().length < 3
            }
          >
            {t("leagueUi.withdrawEntry")}
          </Button>
        </LeagueDialogFooter>
      </form>
    </CommissionerAction>
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
  const [open, setOpen] = useState(false);
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
    <CommissionerAction
      title={t("leagueUi.correctTreasury")}
      description={t("leagueDesk.treasuryHint")}
      icon={<Coins className="size-4" />}
      open={open}
      onOpenChange={setOpen}
      busy={action.busy}
      destructive={false}
    >
      <form
        className="flex min-h-0 flex-1 flex-col"
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
              if (saved) {
                setDraft(null);
                setOpen(false);
              }
            });
        }}
      >
        <LeagueDialogBody>
          <LeagueError message={action.error} />
          <div className="grid grid-cols-2 divide-x rounded-lg border bg-card p-3 text-center">
            <div>
              <p className="text-xs text-muted-foreground">
                {t("leagueUi.before")}
              </p>
              <p className="mt-1 font-mono text-lg">{treasury / 1000}k GP</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">
                {t("leagueUi.after")}
              </p>
              <p className="mt-1 font-mono text-lg text-primary">
                {current.amount / 1000}k GP
              </p>
            </div>
          </div>
          <p className="flex items-start gap-2 rounded-lg border bg-secondary/25 p-3 text-xs text-muted-foreground">
            <ShieldCheck className="size-4 shrink-0" />
            {t("leagueDesk.auditedChange")}
          </p>
          <LeagueField>
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
          </LeagueField>
          <LeagueField>
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
          </LeagueField>
        </LeagueDialogBody>
        <LeagueDialogFooter>
          <Button
            type="button"
            variant="outline"
            disabled={action.busy}
            onClick={() => setOpen(false)}
          >
            {t("cancel")}
          </Button>
          <Button
            type="submit"
            className="h-11"
            disabled={action.busy || current.reason.trim().length < 3}
          >
            {t("leagueUi.saveCorrection")}
          </Button>
        </LeagueDialogFooter>
      </form>
    </CommissionerAction>
  );
}
