"use client";

import { useEffect, useRef, useState, type ComponentProps } from "react";

/** Show a pinned-column edge only while it overlaps horizontally hidden content. */
export function TableScrollArea(props: ComponentProps<"div">) {
  const ref = useRef<HTMLDivElement>(null);
  const [canScrollRight, setCanScrollRight] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element?.querySelector(".sticky-right-column")) return;

    const update = () => setCanScrollRight(element.scrollWidth - element.clientWidth - element.scrollLeft > 1);
    update();
    element.addEventListener("scroll", update, { passive: true });
    const observer = new ResizeObserver(update);
    observer.observe(element);
    for (const child of element.children) observer.observe(child);
    return () => {
      element.removeEventListener("scroll", update);
      observer.disconnect();
    };
  }, []);

  return <div {...props} ref={ref} data-scroll-right={canScrollRight} />;
}
