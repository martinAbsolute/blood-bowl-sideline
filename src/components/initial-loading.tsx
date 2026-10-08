"use client";

import { Suspense } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { LoadingLayout, type LoadingVariant } from "./loading-layouts";
import { rosterRuleset } from "@/lib/roster-ruleset";
import { getRoster } from "@/domain/catalog";

export function loadingVariantForPath(pathname: string): LoadingVariant {
  if (/^\/leagues\/manage\/[^/]+\/matches\//.test(pathname))
    return "league-match";
  if (/^\/leagues\/manage\/[^/]+\/teams\//.test(pathname))
    return "league-career";
  if (pathname === "/leagues/manage" || pathname.startsWith("/leagues/manage/"))
    return "league";
  if (/^\/leagues\/[^/]+/.test(pathname)) return "league-reference";
  if (pathname.startsWith("/leagues")) return "leagues";
  if (pathname === "/users") return "users";
  if (/^\/(rosters|team)\/[^/]+/.test(pathname)) return "reference";
  if (pathname === "/rosters" || pathname === "/builder") return "catalog";
  if (pathname.startsWith("/teams/")) return "editor";
  if (["/", "/teams", "/my-teams"].includes(pathname)) return "library";
  return "page";
}

function RouteLoading({ label }: { label: string }) {
  const pathname = usePathname();
  return (
    <InitialLoading variant={loadingVariantForPath(pathname)} label={label} />
  );
}

function RosterLoading({
  variant,
  label,
}: {
  variant: "catalog" | "reference";
  label: string;
}) {
  const pathname = usePathname();
  const params = useSearchParams();
  const rulesets = params.getAll("ruleset");
  const editor =
    variant === "catalog" &&
    (params.get("roster") || params.get("draft") || params.get("new") === "1");
  return (
    <LoadingLayout
      variant={editor ? "editor" : variant}
      label={label}
      rulesetId={rosterRuleset(rulesets.length > 1 ? rulesets : rulesets[0])}
      referenceRoster={
        variant === "reference" ? getRoster(pathname.split("/")[2]) : undefined
      }
    />
  );
}

// This boundary runs before translations, authentication, and draft providers.
// Known routes must not infer their destination from the outgoing pathname.
// URL hooks can suspend during partial prefetching; never default to My Teams.
export function InitialLoading({
  label = "Loading…",
  variant,
}: {
  label?: string;
  variant?: LoadingVariant;
}) {
  if (variant) {
    const fallback = <LoadingLayout variant={variant} label={label} />;
    return variant === "catalog" || variant === "reference" ? (
      <Suspense fallback={fallback}>
        <RosterLoading variant={variant} label={label} />
      </Suspense>
    ) : (
      fallback
    );
  }
  return (
    <Suspense fallback={<LoadingLayout label={label} />}>
      <RouteLoading label={label} />
    </Suspense>
  );
}
