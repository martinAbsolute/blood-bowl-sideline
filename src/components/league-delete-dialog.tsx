"use client";

import { useId, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "convex/react";
import { useTranslations } from "gt-next";
import { Trash2 } from "lucide-react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Dialog, DialogTrigger } from "./dialog";
import { LeagueError, useLeagueAction } from "./league-ui";

import {
  LeagueDialogBody,
  LeagueDialogContent,
  LeagueDialogFooter,
  LeagueDialogHeader,
} from "./league-dialog";

export function LeagueDeleteDialog({
  leagueId,
  name,
}: {
  leagueId: Id<"leagues">;
  name: string;
}) {
  const t = useTranslations();
  const router = useRouter();
  const inputId = useId();
  const [open, setOpen] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const remove = useMutation(api.leagues.deleteLeague);
  const action = useLeagueAction();

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (confirmation !== name || action.busy) return;
    const deleted = await action.run(() =>
      remove({ leagueId, confirmationName: confirmation }),
    );
    if (deleted) router.replace("/leagues");
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (action.busy) return;
        setOpen(next);
        if (!next) setConfirmation("");
      }}
    >
      <DialogTrigger
        render={<Button variant="destructive" className="mt-4 h-10" />}
      >
        <Trash2 className="size-4" aria-hidden="true" />
        {t("leagueUx.deleteLeague")}
      </DialogTrigger>
      <LeagueDialogContent
        className="sm:max-w-md"
        showCloseButton={!action.busy}
      >
        <LeagueDialogHeader
          title={t("leagueUx.deleteLeague")}
          description={t("leagueUx.deleteLeagueHint")}
          icon={<Trash2 className="size-5" />}
          destructive
        />
        <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
          <LeagueDialogBody>
            <p className="break-words rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-sm font-semibold">
              {name}
            </p>
            <LeagueError message={action.error} />
            <div className="space-y-2">
              <label htmlFor={inputId} className="text-sm font-medium">
                {t("leagueUx.confirmLeagueName", { name })}
              </label>
              <Input
                id={inputId}
                value={confirmation}
                onChange={(event) => setConfirmation(event.target.value)}
                autoComplete="off"
                spellCheck={false}
                disabled={action.busy}
                className="h-10"
              />
            </div>
          </LeagueDialogBody>
          <LeagueDialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={action.busy}
              onClick={() => {
                setConfirmation("");
                setOpen(false);
              }}
            >
              {t("cancel")}
            </Button>
            <Button
              type="submit"
              variant="destructive"
              disabled={action.busy || confirmation !== name}
            >
              <Trash2 className="size-4" aria-hidden="true" />
              {t("leagueUx.deleteLeague")}
            </Button>
          </LeagueDialogFooter>
        </form>
      </LeagueDialogContent>
    </Dialog>
  );
}
