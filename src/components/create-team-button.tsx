"use client";
import Link from "next/link";
import { useTranslations } from "gt-next";
import { Plus } from "lucide-react";
import { Button } from "./ui/button";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { newTeam } from "@/domain/catalog";
import { storeDraft } from "@/lib/drafts";
import { useDraftSync } from "./draft-sync-provider";
import { toast } from "./ui/toast";
import { useConvexAuth } from "convex/react";
import { useTeamSave } from "@/lib/use-team-save";
import { saveCloudDraft } from "@/lib/cloud-save";
import type { RulesetId } from "@/domain/types";

export function CreateTeamButton({
  className,
  rosterId,
  rulesetId,
  leagueId,
  size,
  iconClassName = "size-4",
}: {
  className?: string;
  rosterId?: string;
  rulesetId?: RulesetId;
  leagueId?: string;
  size?: "default" | "sm";
  iconClassName?: string;
}) {
  const t = useTranslations();
  const router = useRouter();
  const sync = useDraftSync();
  const { isAuthenticated } = useConvexAuth();
  const save = useTeamSave(leagueId);
  const [creating, setCreating] = useState(false);
  if (rosterId)
    return (
      <Button
        className={className}
        size={size}
        disabled={creating || !sync.ready}
        onClick={async () => {
          if (creating) return;
          const team = newTeam(crypto.randomUUID(), rosterId);
          if (rulesetId) team.rulesetId = rulesetId;
          setCreating(true);
          const release = sync.editing(team.uuid);
          try {
            if (isAuthenticated) await saveCloudDraft(team, 0, save);
            else storeDraft(team, null, 0);
            router.push(
              `/teams/${team.uuid}${leagueId ? `?league=${encodeURIComponent(leagueId)}` : ""}`,
            );
          } catch {
            toast.add({
              type: "error",
              title: t(isAuthenticated ? "saveFailed" : "storageError"),
            });
          } finally {
            release();
            setCreating(false);
          }
        }}
      >
        <Plus className={iconClassName} />
        {t("createTeam")}
      </Button>
    );
  return (
    <Button
      className={className}
      size={size}
      nativeButton={false}
      render={<Link href="/rosters" prefetch />}
    >
      <Plus className="size-4" />
      {t("createTeam")}
    </Button>
  );
}
