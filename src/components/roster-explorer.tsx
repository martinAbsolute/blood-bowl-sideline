"use client";
import { useState } from "react";
import Link from "next/link";
import { useTranslations } from "gt-next";
import { Search, ArrowUpRight, ChevronDown } from "lucide-react";
import { rosters } from "@/domain/catalog";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { RosterIcon } from "./player-icon";
import { RosterFacts, RosterTable } from "./roster-reference";
import { CreateTeamButton } from "./create-team-button";

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
            className="h-11 bg-card pl-9 lg:h-9"
          />
        </div>
        <nav
          aria-label={t("rosters")}
          className="scroll-fade-x mt-3 flex gap-1 overflow-x-auto lg:max-h-[calc(100dvh-var(--site-content-top)-9.25rem)] lg:flex-col lg:overflow-y-auto lg:scroll-fade-none"
        >
          {list.map((r) => (
            <a
              key={r.id}
              href={`#${r.id}`}
              onClick={() =>
                setExpanded((current) => new Set([...current, r.id]))
              }
              className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded px-2 py-1.5 text-xs hover:bg-secondary focus-visible:outline-2 focus-visible:outline-ring lg:min-h-0 lg:py-1"
            >
              <RosterIcon rosterId={r.id} className="size-4" />
              <span>{r.name}</span>
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
            <div className="relative border-b bg-secondary/40 p-2 md:flex md:items-center md:gap-2 md:px-3 md:py-2">
              <button
                type="button"
                aria-label={r.name}
                aria-expanded={expanded.has(r.id)}
                aria-controls={`roster-content-${r.id}`}
                onClick={() => toggleRoster(r.id)}
                className="absolute inset-0 rounded-t-lg focus-visible:outline-2 focus-visible:outline-ring md:hidden"
              />
              <h2 className="pointer-events-none relative flex min-h-11 min-w-0 items-center justify-between gap-2 font-semibold md:pointer-events-auto md:min-h-0 md:flex-1">
                <span className="flex min-w-0 items-center gap-2 text-sm md:hidden">
                  <RosterIcon rosterId={r.id} className="size-6 shrink-0" />
                  <span className="truncate" title={r.name}>
                    {r.name}
                  </span>
                </span>
                <ChevronDown
                  aria-hidden="true"
                  className={`size-5 shrink-0 text-primary transition-transform md:hidden ${expanded.has(r.id) ? "rotate-180" : ""}`}
                />
                <Link
                  href={`/rosters/${r.id}`}
                  className="hidden items-center gap-2 hover:underline md:flex"
                >
                  <RosterIcon rosterId={r.id} className="size-8" />
                  {r.name}
                </Link>
              </h2>
              <div className="pointer-events-none relative mt-1 grid grid-cols-2 gap-2 [&>*]:pointer-events-auto md:ml-auto md:mt-0 md:flex md:shrink-0">
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-11 min-w-0 px-2 text-xs md:h-7 md:gap-1.5 md:px-3 md:text-sm"
                  nativeButton={false}
                  render={<Link href={`/rosters/${r.id}`} />}
                >
                  <span className="md:hidden">{t("teamDetailsShort")}</span>
                  <span className="hidden md:inline">{t("teamDetails")}</span>
                  <ArrowUpRight className="size-4" />
                </Button>
                <CreateTeamButton
                  size="sm"
                  rosterId={r.id}
                  className="h-11 min-w-0 px-2 text-xs md:h-7 md:gap-1.5 md:px-3 md:text-sm"
                  iconClassName="hidden size-4 md:block"
                />
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
