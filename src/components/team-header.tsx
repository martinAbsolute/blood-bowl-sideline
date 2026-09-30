"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { motion, useReducedMotion } from "motion/react";

// The title always measures against the full header, never the action buttons.
// This keeps the collision threshold stable as the buttons move between rows.
export function TeamHeader({
  back,
  actions,
  title,
  children,
}: {
  back: ReactNode;
  actions: ReactNode;
  title: ReactNode;
  children: ReactNode;
}) {
  const header = useRef<HTMLDivElement>(null);
  const titleRow = useRef<HTMLDivElement>(null);
  const actionRow = useRef<HTMLDivElement>(null);
  const [offset, setOffset] = useState(0);
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    const container = header.current;
    const titleContainer = titleRow.current;
    const buttons = actionRow.current;
    const heading = titleContainer?.querySelector("h1");
    const status = titleContainer?.querySelector('[role="status"]');
    if (
      !container ||
      !titleContainer ||
      !buttons ||
      !heading ||
      !window.ResizeObserver
    )
      return;
    const measure = () => {
      const titleWidth =
        heading.getBoundingClientRect().width +
        (status ? status.getBoundingClientRect().width + 8 : 0);
      const fits =
        window.matchMedia("(min-width: 1024px)").matches &&
        titleWidth + buttons.offsetWidth + 24 <= container.clientWidth;
      const next = fits
        ? titleContainer.offsetTop +
          (heading.getBoundingClientRect().height - buttons.offsetHeight) / 2
        : 0;
      setOffset((current) => (Math.abs(current - next) < 0.5 ? current : next));
    };
    const observer = new ResizeObserver(measure);
    for (const element of [container, heading, buttons, status]) {
      if (element) observer.observe(element);
    }
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={header} className="relative mb-4 space-y-2">
      <div className="flex min-h-8 flex-wrap items-center justify-between gap-3">
        {back}
        <motion.div
          ref={actionRow}
          initial={false}
          animate={{ y: offset }}
          transition={
            reducedMotion
              ? { duration: 0 }
              : { duration: 0.24, ease: [0.22, 1, 0.36, 1] }
          }
          className="no-print flex flex-wrap gap-2 lg:absolute lg:right-0 lg:top-0"
          data-title-actions
        >
          {actions}
        </motion.div>
      </div>
      <div
        ref={titleRow}
        className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-2"
      >
        {title}
      </div>
      {children}
    </div>
  );
}
