"use client";

import { useEffect, useMemo } from "react";
import { useConvex, useConvexAuth } from "convex/react";
import { createNavigationPrewarmer } from "@/lib/navigation-prewarm";

export function NavigationPrewarm() {
  const client = useConvex();
  const { isAuthenticated, isLoading } = useConvexAuth();
  const warm = useMemo(() => createNavigationPrewarmer(client), [client]);
  useEffect(() => {
    function onIntent(event: Event) {
      if (isLoading || !(event.target instanceof Element)) return;
      const link = event.target.closest<HTMLAnchorElement>("a[href]");
      if (!link || link.hasAttribute("download") || link.target === "_blank")
        return;
      const url = new URL(link.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      warm(url, isAuthenticated);
    }
    document.addEventListener("pointerover", onIntent, { passive: true });
    document.addEventListener("focusin", onIntent);
    document.addEventListener("touchstart", onIntent, { passive: true });
    return () => {
      document.removeEventListener("pointerover", onIntent);
      document.removeEventListener("focusin", onIntent);
      document.removeEventListener("touchstart", onIntent);
    };
  }, [warm, isAuthenticated, isLoading]);
  return null;
}
