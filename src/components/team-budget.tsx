"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import type { Team } from "@/domain/types";
import { budgetSummary } from "@/domain/budget";
import { BudgetBreakdown, BudgetOverview } from "./budget-details";
import { TeamReadiness } from "./team-readiness";
import { Drawer, DrawerContent, DrawerDescription, DrawerTitle, DrawerTrigger } from "./ui/drawer";

export function TeamBudget({
  team,
  floating = true,
  startingTreasury,
}: {
  team: Team;
  floating?: boolean;
  startingTreasury?: number;
}) {
  const t = useTranslations();
  const summary = budgetSummary(team, startingTreasury);
  // Surface overspending or reserve usage in the compact bar.
  const drawerPool =
    summary.issues[0] ?? summary.pools.find((pool) => pool.id === "funds" && pool.used > 0) ?? summary.pools[0];
  const section = useRef<HTMLElement>(null);
  const [aboveBudget, setAboveBudget] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    const target = section.current;
    if (!floating || !target) return;
    const mobile = window.matchMedia("(max-width: 767px)");
    const observer = new IntersectionObserver(([entry]) => {
      const above = mobile.matches && entry.boundingClientRect.top >= (entry.rootBounds?.bottom ?? 0);
      setAboveBudget(above);
      if (!above) setExpanded(false);
    });
    const observe = () => {
      observer.disconnect();
      if (mobile.matches) observer.observe(target);
      else {
        setAboveBudget(false);
        setExpanded(false);
      }
    };
    observe();
    mobile.addEventListener("change", observe);
    return () => {
      observer.disconnect();
      mobile.removeEventListener("change", observe);
    };
  }, [floating]);

  return (
    <>
      <section
        ref={section}
        aria-label={t("treasury")}
        className="team-budget budget-panel print-break-avoid overflow-hidden"
      >
        <BudgetOverview pool={summary.pools[0]} />
        <BudgetBreakdown summary={summary} />
      </section>
      {/* An open Base UI drawer owns Android Back, even when non-modal.
          Keep the resting bar outside the popup so Back navigates immediately. */}
      {floating && (
        <Drawer open={aboveBudget && expanded} onOpenChange={setExpanded}>
          <div
            className="mobile-budget-bar no-print md:hidden"
            data-visible={aboveBudget && !expanded}
            inert={!aboveBudget || expanded}
          >
            <DrawerTrigger
              className="absolute inset-0 w-full cursor-pointer rounded-t-lg focus-visible:outline-2 focus-visible:-outline-offset-3 focus-visible:outline-ring"
              aria-label={t("budgetBreakdown")}
            />
            <BudgetOverview pool={drawerPool} />
          </div>
          <DrawerContent className="mobile-budget-drawer no-print">
            <DrawerTitle className="sr-only">{t("treasury")}</DrawerTitle>
            <DrawerDescription className="sr-only">{t("budgetBreakdown")}</DrawerDescription>
            <div className="min-h-0 overflow-y-auto overscroll-contain">
              <BudgetOverview pool={drawerPool} />
              <BudgetBreakdown summary={summary} drawerPool={drawerPool} />
              <div className="px-3 pb-3">
                <TeamReadiness team={team} startingTreasury={startingTreasury} />
              </div>
            </div>
          </DrawerContent>
        </Drawer>
      )}
    </>
  );
}
