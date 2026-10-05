"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
}: {
  team: Team;
  floating?: boolean;
}) {
  const t = useTranslations();
  const summary = budgetSummary(team);
  // Keep the same allowance in the header throughout opening and closing.
  const drawerPool =
    summary.issues[0] ??
    summary.pools.find((pool) => pool.id === "funds" && pool.used > 0) ??
    summary.pools[0];
  const section = useRef<HTMLElement>(null);
  const [aboveBudget, setAboveBudget] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [summaryElement, setSummaryElement] = useState<HTMLDivElement | null>(
    null,
  );
  const [collapsedHeight, setCollapsedHeight] = useState(64);
  const collapsedPoint = `${collapsedHeight}px`;
  // 1 clamps to the panel's natural height, rather than forcing a full screen.
  const snapPoints = useMemo(() => [collapsedPoint, 1], [collapsedPoint]);

  useEffect(() => {
    if (!summaryElement) return;
    const observer = new ResizeObserver(() => {
      const panel = summaryElement.closest<HTMLElement>(
        ".mobile-budget-drawer",
      );
      if (!panel) return;
      const styles = getComputedStyle(panel);
      setCollapsedHeight(
        Math.ceil(
          summaryElement.getBoundingClientRect().height +
            parseFloat(styles.borderTopWidth) +
            parseFloat(styles.paddingBottom),
        ),
      );
    });
    observer.observe(summaryElement);
    return () => observer.disconnect();
  }, [summaryElement]);

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
      {floating && (
        <Drawer
          open={aboveBudget}
          modal={expanded}
          disablePointerDismissal={!expanded}
          snapPoints={snapPoints}
          snapToSequentialPoints
          snapPoint={expanded ? 1 : collapsedPoint}
          onSnapPointChange={(point, details) => {
            // Keep the compact budget visible even after a fast downward swipe.
            if (point === null) details.cancel();
            setExpanded(point === 1);
          }}
          onOpenChange={(open, details) => {
            if (!open) {
              // Dismissal returns to the compact resting position.
              details.cancel();
              setExpanded(false);
            }
          }}
        >
          <DrawerContent
            className="mobile-budget-drawer budget-panel no-print"
            data-expanded={expanded}
            initialFocus={false}
            finalFocus={false}
            swipeHeader={
              <div ref={setSummaryElement} className="budget-drawer-summary">
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
            <div
              className="budget-drawer-breakdown min-h-0 overflow-y-auto overscroll-contain"
              inert={!expanded}
              aria-hidden={!expanded}
            >
              <BudgetBreakdown summary={summary} drawerPool={drawerPool} />
              <div className="px-3 pb-3">
                <TeamReadiness team={team} />
              </div>
            </div>
          </DrawerContent>
        </Drawer>
      )}
    </>
  );
}
