"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "gt-next";
import type { Team } from "@/domain/types";
import { budgetSummary } from "@/domain/budget";
import { BudgetBreakdown, BudgetOverview } from "./budget-details";
import { TeamReadiness } from "./team-readiness";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerTitle,
} from "./ui/drawer";

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
  // Keep the same allowance in the header throughout opening and closing.
  const drawerPool =
    summary.issues[0] ??
    summary.pools.find((pool) => pool.id === "funds" && pool.used > 0) ??
    summary.pools[0];
  const section = useRef<HTMLElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const [aboveBudget, setAboveBudget] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const swipeStart = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const target = section.current;
    if (!floating || !target) return;
    const mobile = window.matchMedia("(max-width: 767px)");
    // Give the full card room to enter before withdrawing the bottom bar.
    const observer = new IntersectionObserver(
      ([entry]) => {
        const above =
          mobile.matches &&
          entry.boundingClientRect.top >= (entry.rootBounds?.bottom ?? 0);
        setAboveBudget(above);
        if (!above) setExpanded(false);
      },
      { rootMargin: "0px 0px -80px 0px" },
    );
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
          Keep the resting bar outside the drawer so Back navigates immediately. */}
      {floating && aboveBudget && !expanded && (
        <div
          className="mobile-budget-bar budget-panel no-print"
          onPointerDown={(event) => {
            if (event.isPrimary && event.button === 0) {
              swipeStart.current = { x: event.clientX, y: event.clientY };
              // Capture on the pressed control so a tap still clicks it.
              if (event.target instanceof HTMLElement)
                event.target.setPointerCapture(event.pointerId);
            }
          }}
          onPointerCancel={() => {
            swipeStart.current = null;
          }}
          onPointerUp={(event) => {
            const start = swipeStart.current;
            swipeStart.current = null;
            if (
              start &&
              start.y - event.clientY > 30 &&
              start.y - event.clientY > Math.abs(start.x - event.clientX)
            )
              setExpanded(true);
          }}
        >
          <div className="budget-drawer-summary">
            <span className="budget-drawer-handle" aria-hidden="true" />
            <div className="relative">
              <button
                ref={trigger}
                type="button"
                className="absolute inset-0 w-full cursor-pointer rounded-sm"
                aria-label={t("budgetBreakdown")}
                aria-expanded={false}
                onClick={() => setExpanded(true)}
              />
              <BudgetOverview pool={drawerPool} />
            </div>
          </div>
        </div>
      )}
      {floating && (
        <Drawer open={aboveBudget && expanded} onOpenChange={setExpanded}>
          <DrawerContent
            className="mobile-budget-drawer budget-panel no-print"
            data-expanded="true"
            finalFocus={trigger}
            swipeHeader={
              <div className="budget-drawer-summary">
                <span className="budget-drawer-handle" aria-hidden="true" />
                <div className="relative">
                  <button
                    type="button"
                    className="absolute inset-0 w-full cursor-pointer rounded-sm"
                    aria-label={t("budgetBreakdown")}
                    aria-expanded={expanded}
                    onClick={() => setExpanded(!expanded)}
                  />
                  <BudgetOverview pool={drawerPool} />
                </div>
              </div>
            }
          >
            <DrawerTitle className="sr-only">{t("treasury")}</DrawerTitle>
            <DrawerDescription className="sr-only">
              {t("budgetBreakdown")}
            </DrawerDescription>
            <div className="budget-drawer-breakdown min-h-0 overflow-y-auto overscroll-contain">
              <BudgetBreakdown summary={summary} drawerPool={drawerPool} />
              <div className="px-3 pb-3">
                <TeamReadiness
                  team={team}
                  startingTreasury={startingTreasury}
                />
              </div>
            </div>
          </DrawerContent>
        </Drawer>
      )}
    </>
  );
}
