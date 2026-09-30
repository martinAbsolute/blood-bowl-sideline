"use client";
import Link from "next/link";
import { useTranslations } from "gt-next";
import { Plus } from "lucide-react";
import { Button } from "./ui/button";

export function CreateTeamButton({ className }: { className?: string }) {
  const t = useTranslations();
  return (
    <Button
      className={className}
      nativeButton={false}
      render={<Link href="/rosters" prefetch />}
    >
      <Plus className="size-4" />
      {t("createTeam")}
    </Button>
  );
}
