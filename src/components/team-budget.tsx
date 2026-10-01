"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "gt-next";
import { X } from "lucide-react";
import type { Team } from "@/domain/types";
import { BudgetBreakdown, BudgetOverview } from "./budget-details";
import { Button } from "./ui/button";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "./ui/accordion";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerTitle,
  DrawerTrigger,
} from "./ui/drawer";

function BudgetContent({
  team,
  expanded = false,
}: {
  team: Team;
  expanded?: boolean;
}) {
  const t = useTranslations();
  return (
    <>
      <BudgetOverview team={team} />
      <Accordion
        defaultValue={expanded ? ["budget"] : []}
        className="border-t px-4 text-xs"
      >
        <AccordionItem value="budget">
          <AccordionTrigger className="items-center py-3 text-xs font-normal text-muted-foreground hover:no-underline">
            {t("budgetBreakdown")}
          </AccordionTrigger>
          <AccordionContent className="text-xs motion-reduce:animate-none">
            <BudgetBreakdown team={team} />
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </>
  );
}

export function TeamBudget({
  team,
  floating = true,
}: {
  team: Team;
  floating?: boolean;
}) {
  const t = useTranslations();
  const section = useRef<HTMLElement>(null);
  const [aboveBudget, setAboveBudget] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

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
        if (!above) setDrawerOpen(false);
      },
      { rootMargin: "0px 0px -80px 0px" },
    );
    const observe = () => {
      observer.disconnect();
      if (mobile.matches) observer.observe(target);
      else {
        setAboveBudget(false);
        setDrawerOpen(false);
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
        aria-label={t("summary")}
        className="team-budget budget-panel print-break-avoid overflow-hidden"
      >
        <BudgetContent team={team} />
      </section>
      {floating && (
        <Drawer
          open={aboveBudget && drawerOpen}
          onOpenChange={setDrawerOpen}
          showSwipeHandle
        >
          <div
            className="mobile-budget budget-panel no-print"
            data-visible={aboveBudget}
            inert={!aboveBudget}
            aria-hidden={!aboveBudget}
          >
            <DrawerTrigger
              className="mobile-budget-trigger"
              aria-label={t("budgetBreakdown")}
            >
              <BudgetOverview team={team} compact />
            </DrawerTrigger>
          </div>
          <DrawerContent className="mobile-budget-drawer budget-panel">
            <DrawerTitle className="sr-only">{t("summary")}</DrawerTitle>
            <DrawerDescription className="sr-only">
              {t("budgetBreakdown")}
            </DrawerDescription>
            <DrawerClose
              render={
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="absolute right-3 top-1 z-10"
                  aria-label={t("close")}
                />
              }
            >
              <X />
            </DrawerClose>
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
              <BudgetContent team={team} expanded />
            </div>
          </DrawerContent>
        </Drawer>
      )}
    </>
  );
}
