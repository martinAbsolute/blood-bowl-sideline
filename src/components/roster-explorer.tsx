"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useTranslations } from "gt-next";
import { Search, ArrowUpRight, ChevronDown } from "lucide-react";
import { rosters, getRuleset } from "@/domain/catalog";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { RosterIcon } from "./player-icon";
import { RosterFacts, RosterTable } from "./roster-reference";
import { CreateTeamButton } from "./create-team-button";
import type { RulesetId } from "@/domain/types";
import { rosterReferenceHref } from "@/lib/roster-ruleset";

export function RosterExplorer({
  rulesetId = "bb2025-default",
}: {
  rulesetId?: RulesetId;
}) {
  const t = useTranslations();
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    function openHashRoster() {
      const id = window.location.hash.slice(1);
      if (!rosters.some((roster) => roster.id === id)) return;

      setSearch("");
      setExpanded((current) => new Set(current).add(id));
      window.requestAnimationFrame(() => {
        document.getElementById(id)?.scrollIntoView({
          behavior: window.matchMedia("(prefers-reduced-motion: reduce)")
            .matches
            ? "instant"
            : "smooth",
          block: "start",
        });
      });
    }

    openHashRoster();
    window.addEventListener("hashchange", openHashRoster);
    return () => window.removeEventListener("hashchange", openHashRoster);
  }, []);

  function toggleRoster(id: string) {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  const list = rosters.filter(
    (r) =>
      !getRuleset(rulesetId).excludedRosters?.includes(r.id) &&
      r.name.toLowerCase().includes(search.trim().toLowerCase()),
  );
  return (
    <div className="catalog-layout">
      <aside className="no-print catalog-index">
        <label className="relative flex min-h-11 items-center lg:min-h-9">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            aria-label={t("searchRosters")}
            placeholder={t("searchRosters")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 bg-card pl-9"
          />
        </label>
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
            <div className="relative flex items-center gap-1 border-b bg-secondary/40 px-2 py-2 md:gap-2 md:px-3">
              <button
                type="button"
                aria-label={r.name}
                aria-expanded={expanded.has(r.id)}
                aria-controls={`roster-content-${r.id}`}
                onClick={() => toggleRoster(r.id)}
                className="absolute inset-0 rounded-t-lg focus-visible:outline-2 focus-visible:outline-ring md:hidden"
              />
              <h2 className="pointer-events-none relative min-w-0 flex-1 font-semibold md:pointer-events-auto">
                <span className="flex min-w-0 items-center gap-1 text-xs md:hidden">
                  <RosterIcon
                    rosterId={r.id}
                    className="size-4 shrink-0 min-[360px]:size-6"
                  />
                  <span className="line-clamp-2 leading-tight" title={r.name}>
                    {r.name}
                  </span>
                </span>
                <Link
                  href={rosterReferenceHref(r.id, rulesetId)}
                  className="hidden items-center gap-2 hover:underline md:flex"
                >
                  <RosterIcon rosterId={r.id} className="size-8" />
                  {r.name}
                </Link>
              </h2>
              <div className="pointer-events-none relative ml-auto flex shrink-0 gap-1 [&>*]:pointer-events-auto md:gap-2">
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-11 gap-0.5 px-1.5 text-xs min-[360px]:gap-1 min-[360px]:px-2 min-[360px]:text-sm md:h-7 md:gap-1.5 md:px-3 md:text-sm"
                  nativeButton={false}
                  render={<Link href={rosterReferenceHref(r.id, rulesetId)} />}
                >
                  <span className="md:hidden">{t("teamDetailsShort")}</span>
                  <span className="hidden md:inline">{t("teamDetails")}</span>
                  <ArrowUpRight className="size-3.5 md:size-4" />
                </Button>
                <CreateTeamButton
                  size="sm"
                  rosterId={r.id}
                  rulesetId={rulesetId}
                  className="h-11 gap-1 px-1.5 text-xs min-[360px]:px-2 min-[360px]:text-sm md:h-7 md:gap-1.5 md:px-3 md:text-sm"
                  iconClassName="hidden size-4 md:block"
                />
              </div>
              <span
                aria-hidden="true"
                className="pointer-events-none relative flex h-11 w-7 shrink-0 items-center justify-center md:hidden"
              >
                <ChevronDown
                  className={`size-5 text-primary transition-transform ${expanded.has(r.id) ? "rotate-180" : ""}`}
                />
              </span>
            </div>
            <div
              id={`roster-content-${r.id}`}
              className={`${expanded.has(r.id) ? "block" : "hidden"} md:block print:block`}
            >
              <RosterTable roster={r} rulesetId={rulesetId} />
              <RosterFacts roster={r} rulesetId={rulesetId} />
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
