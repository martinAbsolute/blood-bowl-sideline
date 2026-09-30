"use client";
import { useEffect, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "gt-next";
import { getRoster, newTeam } from "@/domain/catalog";
import { ACTIVE, readDrafts } from "@/lib/drafts";
import { TeamEditor } from "./team-editor";
import Link from "next/link";
import { Button } from "./ui/button";
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
    ),
    t = useTranslations();
  return hydrated ? (
    <LocalBuilder
      key={`${props.draft}-${props.roster}-${props.fresh}`}
      {...props}
    />
  ) : (
    <p className="page-width py-20 text-muted-foreground">{t("loading")}</p>
  );
}
function LocalBuilder({
  roster,
  draft,
  fresh,
}: {
  roster?: string;
  draft?: string;
  fresh: boolean;
}) {
  const [initial] = useState(() => {
    const drafts = readDrafts();
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
    router.replace(`/builder?draft=${initial.uuid}`, { scroll: false });
  }, [router, initial]);
  return initial ? (
    <TeamEditor initial={initial} />
  ) : (
    <div className="page-width py-16 text-center">
      <h1 className="display-font text-3xl">{t("noTeams")}</h1>
      <p className="mt-2 text-sm text-muted-foreground">{t("noTeamsHint")}</p>
      <Button asChild className="mt-5">
        <Link href="/teams">{t("chooseRoster")}</Link>
      </Button>
    </div>
  );
}
