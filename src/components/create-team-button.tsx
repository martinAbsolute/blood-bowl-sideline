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

export function CreateTeamButton({
  className,
  rosterId,
  size,
  iconClassName = "size-4",
}: {
  className?: string;
  rosterId?: string;
  size?: "default" | "sm";
  iconClassName?: string;
}) {
  const t = useTranslations();
  const router = useRouter();
  const sync = useDraftSync();
  const [creating, setCreating] = useState(false);
  if (rosterId)
    return (
      <Button
        className={className}
        size={size}
        disabled={creating || !sync.ready}
        onClick={() => {
          const team = newTeam(crypto.randomUUID(), rosterId);
          try {
            storeDraft(team, sync.account);
          } catch {
            toast.add({ type: "error", title: t("storageError") });
            return;
          }
          setCreating(true);
          router.push(`/teams/${team.uuid}`);
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
