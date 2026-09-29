"use client";
import { useState } from "react";
import Link from "next/link";
import { useTranslations } from "gt-next";
import {
  ArrowUpRight,
  Search,
  Shield,
  Skull,
  Sparkles,
  Swords,
  TreePine,
} from "lucide-react";
import { rosters } from "@/domain/catalog";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { BlurFade } from "@/components/magic-ui/blur-fade";
import { cn } from "@/lib/utils";
export function rosterIcon(id: string) {
  return /undead|necromantic|tomb|vampire|nurgle/.test(id)
    ? Skull
    : /elf|amazon|slann/.test(id)
      ? Sparkles
      : /gnome|halfling|wood/.test(id)
        ? TreePine
        : /orc|chaos|khorne|norse/.test(id)
          ? Swords
          : Shield;
}
export function RosterExplorer({
  compact = false,
  onSelect,
}: {
  compact?: boolean;
  onSelect?: (id: string) => void;
}) {
  const t = useTranslations(),
    [search, setSearch] = useState("");
  const list = rosters.filter((r) =>
    r.name.toLowerCase().includes(search.toLowerCase()),
  );
  return (
    <>
      <div className="relative mb-6 max-w-md">
        <Search className="absolute left-3 top-3 size-4 text-muted-foreground" />
        <Input
          aria-label={t("searchRosters")}
          placeholder={t("searchRosters")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-11 bg-card pl-10"
        />
      </div>
      <div
        className={cn(
          "grid gap-3",
          compact
            ? "sm:grid-cols-2"
            : "sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4",
        )}
      >
        {list.map((r, index) => {
          const Icon = rosterIcon(r.id);
          const content = (
            <Card className="group flex h-full flex-row items-center gap-4 border-border bg-card p-4 transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md">
              <span
                className={cn(
                  "flex size-12 shrink-0 items-center justify-center rounded-xl bg-secondary text-primary",
                  index % 3 === 1 && "bg-[#f2e7d9] text-[#956030]",
                  index % 3 === 2 && "bg-[#e6e7f1] text-[#626480]",
                )}
              >
                <Icon className="size-6" />
              </span>
              <div className="flex-1">
                <h3 className="text-sm font-semibold">{r.name}</h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  {r.players.length} {t("positions")} · {r.rerolls.cost / 1000}k{" "}
                  {t("rerolls").toLowerCase()}
                </p>
              </div>
              <ArrowUpRight className="size-4 text-muted-foreground transition group-hover:text-primary" />
            </Card>
          );
          return (
            <BlurFade key={r.id} delay={Math.min(index, 8) * 0.025}>
              {onSelect ? (
                <button
                  className="w-full text-left"
                  onClick={() => onSelect(r.id)}
                >
                  {content}
                </button>
              ) : (
                <Link href={`/builder?roster=${r.id}&new=1`}>{content}</Link>
              )}
            </BlurFade>
          );
        })}
      </div>
      {!list.length && (
        <p className="text-sm text-muted-foreground">{t("noResults")}</p>
      )}
    </>
  );
}
