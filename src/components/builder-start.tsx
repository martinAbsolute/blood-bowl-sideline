"use client";
import { useEffect, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "gt-next";
import { getRoster, newTeam } from "@/domain/catalog";
import { ACTIVE, readDrafts, draftAccount } from "@/lib/drafts";
import { TeamEditor } from "./team-editor";
import Link from "next/link";
import { Button } from "./ui/button";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { SharedTeam } from "./shared-team";
import { useDraftSync } from "./draft-sync-provider";
import { WorkspaceLoading } from "./workspace-loading";
const subscribe = () => () => {};
export function BuilderStart(props: {
  roster?: string;
  draft?: string;
  fresh: boolean;
}) {
  const hydrated = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
  const sync = useDraftSync();
  return hydrated && sync.ready ? (
    <LocalBuilder
      key={`${props.draft}-${props.roster}-${props.fresh}-${sync.account}`}
      account={sync.account}
      {...props}
    />
  ) : (
    <WorkspaceLoading variant="editor" />
  );
}
function LocalBuilder({
  roster,
  draft,
  fresh,
  account,
}: {
  roster?: string;
  draft?: string;
  fresh: boolean;
  account: string | null;
}) {
  const [initial] = useState(() => {
    const drafts = readDrafts().filter(
      (team) => !draftAccount(team.uuid) || draftAccount(team.uuid) === account,
    );
    const existing = !fresh
      ? drafts.find(
          (t) =>
            t.uuid ===
            (draft ??
              (() => {
                try {
                  return localStorage.getItem(ACTIVE);
                } catch {
                  return null;
                }
              })()),
        )
      : undefined;
    if (existing) return existing;
    const selectedRoster = getRoster(roster ?? "");
    return fresh || selectedRoster
      ? newTeam(crypto.randomUUID(), selectedRoster?.id ?? "human")
      : null;
  });
  const router = useRouter();
  const t = useTranslations();
  useEffect(() => {
    if (!initial) return;
    // Convex Auth must consume the callback code before any URL normalization.
    const params = new URLSearchParams(window.location.search);
    if (
      params.has("code") ||
      (params.get("draft") === initial.uuid && !params.has("new"))
    )
      return;
    router.replace(`/teams/${initial.uuid}`, { scroll: false });
  }, [router, initial]);
  return initial ? (
    <TeamEditor initial={initial} />
  ) : draft && account ? (
    <CloudDraft uuid={draft} />
  ) : (
    <div className="page-width py-16 text-center">
      <h1 className="display-font text-3xl">{t("noTeams")}</h1>
      <p className="mt-2 text-sm text-muted-foreground">{t("noTeamsHint")}</p>
      <Button
        className="mt-5"
        nativeButton={false}
        render={<Link href="/rosters" />}
      >
        {t("chooseRoster")}
      </Button>
    </div>
  );
}

function CloudDraft({ uuid }: { uuid: string }) {
  const team = useQuery(api.teams.getByUuid, { uuid });
  const t = useTranslations();
  if (team === undefined) return <WorkspaceLoading variant="editor" />;
  return team ? (
    <SharedTeam initial={team} />
  ) : (
    <p className="page-width py-20 text-muted-foreground">
      {t(team === undefined ? "loading" : "notFound")}
    </p>
  );
}
