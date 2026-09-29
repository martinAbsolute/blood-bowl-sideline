"use client";
import { useEffect, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "gt-next";
import { getRoster, newTeam } from "@/domain/catalog";
import { ACTIVE, readDrafts } from "@/lib/drafts";
import { TeamEditor } from "./team-editor";
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
    return (
      existing ??
      newTeam(crypto.randomUUID(), getRoster(roster ?? "")?.id ?? "human")
    );
  });
  const router = useRouter();
  useEffect(() => {
    router.replace(`/builder?draft=${initial.uuid}`, { scroll: false });
  }, [router, initial.uuid]);
  return <TeamEditor initial={initial} />;
}
