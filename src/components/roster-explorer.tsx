"use client";
import { useState } from "react";
import Link from "next/link";
import { useTranslations } from "gt-next";
import { Search, Plus, ArrowUpRight, ChevronDown } from "lucide-react";
import { rosters } from "@/domain/catalog";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { RosterIcon } from "./player-icon";
import { RosterFacts, RosterTable } from "./roster-reference";

export function RosterExplorer() {
  const t = useTranslations();
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());

  function toggleRoster(id: string) {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  const list = rosters.filter((r) =>
    r.name.toLowerCase().includes(search.trim().toLowerCase()),
  );
  return (
    <div className="catalog-layout">
      <aside className="no-print catalog-index">
        <div className="relative">
          <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
          <Input
            aria-label={t("searchRosters")}
            placeholder={t("searchRosters")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 bg-card pl-9"
          />
        </div>
        <nav
          aria-label={t("teams")}
          className="mt-3 flex gap-1 overflow-auto lg:max-h-[calc(100vh-230px)] lg:flex-col"
        >
          {list.map((r) => (
            <a
              key={r.id}
              href={`#${r.id}`}
              onClick={() =>
                setExpanded((current) => new Set([...current, r.id]))
              }
              className="shrink-0 rounded px-2 py-1.5 text-xs hover:bg-secondary"
            >
              {r.name}
            </a>
          ))}
        </nav>
      </aside>
      <div className="min-w-0 space-y-5">
        {list.map((r) => (
          <section
            id={r.id}
            key={r.id}
            className="scroll-mt-4 overflow-hidden rounded-lg border bg-card"
          >
            <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-secondary/40 px-3 py-2">
              <h2 className="min-w-0 flex-1 basis-full md:basis-auto">
                <button
                  type="button"
                  aria-expanded={expanded.has(r.id)}
                  aria-controls={`roster-content-${r.id}`}
                  onClick={() => toggleRoster(r.id)}
                  className="flex w-full items-center gap-2 rounded-sm text-left font-semibold outline-none focus-visible:ring-2 focus-visible:ring-ring md:hidden"
                >
                  <RosterIcon rosterId={r.id} className="size-8" />
                  {r.name}
                  <ChevronDown
                    aria-hidden="true"
                    className={`ml-auto size-4 shrink-0 text-primary transition-transform ${expanded.has(r.id) ? "rotate-180" : ""}`}
                  />
                </button>
                <Link
                  href={`/team/${r.id}`}
                  className="hidden items-center gap-2 font-semibold hover:underline md:flex"
                >
                  <RosterIcon rosterId={r.id} className="size-8" />
                  {r.name}
                </Link>
              </h2>
              <div className="ml-auto flex gap-2">
                <Button asChild size="sm" variant="ghost">
                  <Link href={`/team/${r.id}`}>
                    <span className="md:hidden">{t("teamDetailsShort")}</span>
                    <span className="hidden md:inline">{t("teamDetails")}</span>
                    <ArrowUpRight className="size-3.5" />
                  </Link>
                </Button>
                <Button asChild size="sm">
                  <Link href={`/builder?roster=${r.id}&new=1`}>
                    <Plus className="size-3.5" />
                    {t("createTeam")}
                  </Link>
                </Button>
              </div>
            </div>
            <div
              id={`roster-content-${r.id}`}
              className={`${expanded.has(r.id) ? "block" : "hidden"} md:block print:block`}
            >
              <RosterTable roster={r} />
              <RosterFacts roster={r} />
            </div>
          </section>
        ))}
        {!list.length && (
          <p className="py-4 text-sm text-muted-foreground">{t("noResults")}</p>
        )}
      </div>
    </div>
  );
}
