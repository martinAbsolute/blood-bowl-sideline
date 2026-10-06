"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { PrefetchKind } from "next/dist/client/components/router-reducer/router-reducer-types";
import { useConvex, useConvexAuth } from "convex/react";
import { createNavigationPrewarmer } from "@/lib/navigation-prewarm";

export function NavigationPrewarm() {
  const client = useConvex();
  const router = useRouter();
  const { isAuthenticated, isLoading } = useConvexAuth();
  useEffect(() => {
    const warm = createNavigationPrewarmer(client, (href, onInvalidate) => {
      // The installed router defaults to the partial shell. FULL also resolves
      // the destination's params/searchParams and loads its page code.
      router.prefetch(href, { kind: PrefetchKind.FULL, onInvalidate });
    });
    function onIntent(event: Event) {
      if (isLoading || !(event.target instanceof Element)) return;
      const link = event.target.closest<HTMLAnchorElement>("a[href]");
      if (
        !link ||
        link.hasAttribute("download") ||
        (link.target && link.target !== "_self")
      )
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
      warm.dispose();
    };
  }, [client, router, isAuthenticated, isLoading]);
  return null;
}
