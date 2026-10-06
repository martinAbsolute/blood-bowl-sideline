"use client";

import { Suspense } from "react";
import { usePathname } from "next/navigation";
import { LoadingLayout, type LoadingVariant } from "./loading-layouts";

export function loadingVariantForPath(pathname: string): LoadingVariant {
  if (/^\/leagues\/manage\/[^/]+\/matches\//.test(pathname))
    return "league-match";
  if (/^\/leagues\/manage\/[^/]+\/teams\//.test(pathname))
    return "league-career";
  if (pathname.startsWith("/leagues/manage/")) return "league";
  if (/^\/leagues\/[^/]+/.test(pathname)) return "reference";
  if (pathname.startsWith("/leagues")) return "leagues";
  if (pathname === "/users") return "users";
  if (/^\/rosters\/[^/]+/.test(pathname)) return "reference";
  if (pathname.startsWith("/rosters")) return "catalog";
  if (
    pathname.startsWith("/teams/") ||
    pathname.startsWith("/team/") ||
    pathname === "/builder"
  )
    return "editor";
  return "library";
}

function RouteLoading({ label }: { label: string }) {
  const pathname = usePathname();
  return (
    <LoadingLayout variant={loadingVariantForPath(pathname)} label={label} />
  );
}

// This boundary runs before translations, authentication, and draft providers.
// Dynamic paths may themselves suspend with Cache Components enabled.
export function InitialLoading({ label = "Loading…" }: { label?: string }) {
  return (
    <Suspense fallback={<LoadingLayout label={label} />}>
      <RouteLoading label={label} />
    </Suspense>
  );
}
