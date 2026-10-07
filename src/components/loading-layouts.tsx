import { Skeleton } from "./ui/skeleton";
import { BrandLogo } from "./brand";
import { SiteFooter } from "./site-footer";
import { ShellFrame } from "./shell-frame";
import { AccountLoading } from "./account-loading";
import { Languages, PanelLeftClose, PanelRightOpen } from "lucide-react";
import { getRoster, getRuleset, inducements } from "@/domain/catalog";
import { inducementInfo, staffInfo } from "@/domain/rules";
import { needsPlayerRecruitment } from "@/lib/builder";
import { budgetSummary } from "@/domain/budget";
import type { Team } from "@/domain/types";
import { TeamHeader } from "./team-header";
import { Badge } from "./ui/badge";
import { ArrowLeft, Copy, Printer, ChevronDown, Ellipsis } from "lucide-react";
import { BookOpen, Flag, Shield, Trophy } from "lucide-react";
import { Card } from "./ui/card";
import type { ReactNode } from "react";
import { UsersLoading } from "./list-loading";
import {
  LeagueContentLoading,
  LeagueDirectoryLoading,
} from "./league-content-loading";
import { rosterChoices } from "@/lib/roster-ruleset";

export type LoadingVariant =
  | "library"
  | "editor"
  | "catalog"
  | "reference"
  | "leagues"
  | "league"
  | "league-reference"
  | "league-match"
  | "league-career"
  | "users";

export function LibraryCardsLoading({
  label,
  text,
  actionLabel,
}: {
  label: string;
  text?: (key: string) => string;
  actionLabel?: string;
}) {
  return (
    <div
      role="status"
      aria-label={label}
      className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3"
    >
      <span className="sr-only">{label}</span>
      {[0, 1, 2].map((index) => (
        <Card
          key={index}
          aria-hidden="true"
          className={`min-w-0 gap-0 rounded-2xl py-0 shadow-sm ${index === 1 ? "hidden sm:flex" : index === 2 ? "hidden xl:flex" : ""}`}
        >
          <div className="bg-primary/10 px-5 pb-5 pt-4">
            <div className="mb-4 flex h-6 justify-between">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-6 w-14 rounded-full" />
            </div>
            <div className="flex h-16 items-center gap-4">
              <Skeleton className="size-16 shrink-0 rounded-2xl" />
              <div className="min-w-0 flex-1 space-y-1">
                <Skeleton className="h-6 w-4/5" />
                <Skeleton className="h-6 w-1/2" />
              </div>
            </div>
          </div>
          <div className="space-y-4 p-5">
            <div className="h-8">
              <Skeleton className="h-4 w-3/4" />
            </div>
            <dl className="grid grid-cols-3 divide-x rounded-lg border bg-secondary/25 py-3 text-center">
              {["players", "teamValue", "remaining"].map((key) => (
                <div key={key}>
                  <dt className="text-[10px] text-muted-foreground">
                    {text?.(key) ?? (
                      <Skeleton className="mx-auto h-[15px] w-12" />
                    )}
                  </dt>
                  <dd className="mt-1 flex h-6 items-center justify-center">
                    <Skeleton className="h-4 w-10" />
                  </dd>
                </div>
              ))}
            </dl>
            <div className="flex h-4 items-center text-xs font-semibold text-primary">
              {actionLabel ?? <Skeleton className="h-4 w-24" />}
            </div>
          </div>
          <div className="flex min-h-14 items-center border-t bg-secondary/15 px-5">
            <Skeleton className="h-4 w-28" />
          </div>
        </Card>
      ))}
    </div>
  );
}

function TableLoading({
  rows,
  empty = false,
  compact = false,
  footer = false,
  title = true,
  framed = true,
  heading,
  text,
}: {
  rows: number;
  empty?: boolean;
  compact?: boolean;
  footer?: boolean;
  title?: boolean;
  framed?: boolean;
  heading?: string;
  text?: (key: string) => string;
}) {
  return (
    <div
      className={`overflow-hidden bg-card ${framed ? "rounded-lg border" : ""}`}
    >
      {title && (
        <div
          className={`flex items-center justify-between border-b bg-secondary/40 px-4 ${compact ? "h-[44px]" : "h-[54px]"}`}
        >
          <span className="text-base font-semibold">{heading}</span>
          <Skeleton className="h-3 w-10" />
        </div>
      )}
      {!empty && (
        <div className="flex h-[34px] items-center gap-5 border-b px-4 text-[10px] font-medium text-muted-foreground">
          <span className="w-40 shrink-0">{text?.("player")}</span>
          <span className="hidden flex-1 sm:block">MA　 ST　 AG　 PA　 AV</span>
          <span className="ml-auto">{text?.("cost")}</span>
        </div>
      )}
      {Array.from({ length: rows }, (_, index) => (
        <div
          key={index}
          className={`flex items-center gap-3 border-b px-4 last:border-0 ${empty ? "min-h-[68px] justify-center py-6" : "h-12"}`}
        >
          {empty ? (
            <p className="text-center text-xs leading-relaxed text-muted-foreground">
              {text?.("emptyRosterHint")}
            </p>
          ) : (
            <>
              <Skeleton className="size-8 shrink-0" />
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="ml-auto h-4 w-1/4" />
            </>
          )}
        </div>
      ))}
      {footer && (
        <div className="flex h-[53px] items-center justify-between border-t px-5">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-7 w-32" />
        </div>
      )}
    </div>
  );
}

export function LoadingLayout({
  variant = "library",
  label,
  team,
  text,
}: {
  variant?: LoadingVariant;
  label: string;
  team?: Team;
  text?: (key: string) => string;
}) {
  const roster = team ? getRoster(team.rosterId) : undefined;
  const budget = team ? budgetSummary(team) : undefined;
  const budgetRows = budget
    ? [
        budget.totals.players,
        budget.totals.starGold,
        budget.totals.skills - budget.totals.starTax,
        budget.totals.starTax,
        budget.totals.staff,
        budget.totals.inducements,
      ].filter((cost) => cost > 0).length
    : 0;
  const recruitmentOpen = !team || needsPlayerRecruitment(team);
  const supportRows = team
    ? [
        Object.keys(staffInfo(team)).length,
        inducements.filter(
          (item) =>
            inducementInfo(team, item).allowed ||
            (team.inducements[item.id] ?? 0) > 0,
        ).length,
      ]
    : [5, 6];
  const catalogChoices =
    variant === "catalog" ? rosterChoices("bb2025-default") : [];
  const catalogTiers = [
    ...new Set(catalogChoices.map(({ tier }) => tier)),
  ].filter((tier) => tier > 0);
  if (variant === "reference")
    return (
      <div
        className="page-width space-y-5 py-6"
        role="status"
        data-loading-layout={variant}
        aria-label={label}
      >
        <span className="sr-only">{label}</span>
        <div aria-hidden="true" className="space-y-5">
          <Skeleton className="h-5 w-24" />
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <Skeleton className="size-10" />
              <div className="space-y-2">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-9 w-48 max-w-full" />
              </div>
            </div>
            <Skeleton className="h-11 w-32 sm:h-9" />
          </div>
          <Skeleton className="h-9 w-48" />
          <TableLoading rows={5} title={false} />
          <div className="grid items-start gap-5 xl:grid-cols-[300px_minmax(0,1fr)]">
            <TableLoading rows={5} />
            <TableLoading rows={6} />
          </div>
        </div>
      </div>
    );
  if (variant === "league-match" || variant === "league-career")
    return <LeagueContentLoading variant={variant} label={label} />;
  if (variant === "editor")
    return (
      <div
        className="page-width team-builder py-3"
        role="status"
        aria-label={label}
      >
        <span className="sr-only">{label}</span>
        <div aria-hidden="true">
          <TeamHeader
            back={
              <div className="inline-flex min-h-8 items-center gap-1.5 text-sm text-muted-foreground">
                <ArrowLeft className="size-3.5" />
                {text?.("myTeams")}
              </div>
            }
            title={
              <div className="page-heading team-heading min-w-0 truncate py-1">
                {team?.name || (
                  <Skeleton className="h-[1.2em] w-60 max-w-full" />
                )}
              </div>
            }
            status={<Skeleton className="h-3 w-16" />}
            actions={
              <>
                <span className="hidden h-9 items-center justify-center gap-2 rounded-lg border bg-background px-3 text-sm font-medium sm:inline-flex">
                  <Copy className="size-4" />
                  {text?.("duplicate")}
                </span>
                <span className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground sm:h-9 sm:flex-none">
                  <Printer className="size-4" />
                  {text?.("print")}
                  <ChevronDown className="size-4" />
                </span>
                <span className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-lg border bg-background px-3 text-sm font-medium sm:hidden">
                  <Ellipsis className="size-4" />
                  {text?.("teamActions")}
                </span>
              </>
            }
          >
            <div className="flex min-h-6 flex-wrap gap-2">
              {team ? (
                <>
                  <Badge
                    variant="outline"
                    className="h-auto min-h-6 max-w-full whitespace-normal text-left"
                  >
                    {getRoster(team.rosterId)?.name}
                  </Badge>
                  <Badge
                    variant="outline"
                    className="h-auto min-h-6 max-w-full whitespace-normal text-left"
                  >
                    {getRuleset(team.rulesetId).name}
                  </Badge>
                </>
              ) : (
                <>
                  <Skeleton className="h-6 w-20" />
                  <Skeleton className="h-6 w-28" />
                </>
              )}
            </div>
          </TeamHeader>
          <div className="budget-grid">
            <div className="@container space-y-5">
              <TableLoading
                rows={recruitmentOpen ? (roster?.players.length ?? 4) : 0}
                empty={!recruitmentOpen}
                heading={text?.("recruitPlayers")}
                text={text}
              />
              <div>
                <div className="mb-2 flex h-6 items-center justify-between px-1">
                  <h2 className="section-title">{text?.("players")}</h2>
                  <Skeleton className="h-3 w-10" />
                </div>
                <TableLoading
                  rows={team ? team.players.length + team.stars.length || 1 : 3}
                  empty={!!team && !team.players.length && !team.stars.length}
                  title={false}
                  text={text}
                />
                <div className="-mt-px flex h-12 justify-end rounded-b-lg border bg-card p-2">
                  <span className="flex h-7 items-center px-2 text-xs font-medium">
                    {text?.("addStar")}
                  </span>
                </div>
              </div>
              <div className="grid items-start gap-4 @min-[780px]:grid-cols-2">
                {supportRows.map((count, sectionIndex) => (
                  <section key={sectionIndex}>
                    <div className="mb-2 flex h-6 items-center justify-between px-1">
                      <h2 className="section-title">
                        {text?.(sectionIndex === 0 ? "staff" : "inducements")}
                      </h2>
                      <Skeleton className="h-3 w-12" />
                    </div>
                    <div className="space-y-1.5">
                      {Array.from({ length: count }, (_, index) => (
                        <div
                          key={index}
                          className="flex h-14 items-center justify-between gap-2 rounded-lg border bg-card px-3"
                        >
                          <div className="flex-1 space-y-1.5">
                            <Skeleton className="h-4 w-3/4" />
                            <Skeleton className="h-3 w-2/3" />
                          </div>
                          <Skeleton className="size-8" />
                          <Skeleton className="h-4 w-5" />
                          <Skeleton className="size-8" />
                        </div>
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            </div>
            <aside className="budget-side space-y-3">
              <section className="rounded-lg border bg-card p-3">
                <div className="grid gap-3">
                  {(team &&
                  ["chaos-chosen", "chaos-renegade", "norse"].includes(
                    team.rosterId,
                  )
                    ? [0, 1, 2]
                    : [0, 1]
                  ).map((index) => (
                    <div
                      key={index}
                      className={`space-y-1 ${index === 2 ? "max-[900px]:col-start-2" : ""}`}
                    >
                      <div className="text-xs font-medium text-muted-foreground">
                        {index < 2 ? (
                          text?.(index === 0 ? "ruleset" : "roster")
                        ) : (
                          <Skeleton className="h-4 w-16" />
                        )}
                      </div>
                      {team && index < 2 ? (
                        <div className="flex h-9 items-center justify-between gap-2 rounded-lg border bg-background px-3 text-sm">
                          <span className="truncate">
                            {index === 0
                              ? getRuleset(team.rulesetId).name
                              : getRoster(team.rosterId)?.name}
                          </span>
                          <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
                        </div>
                      ) : (
                        <Skeleton className="h-9 w-full" />
                      )}
                    </div>
                  ))}
                </div>
                <div className="mt-4 border-t pt-4">
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-3/4" />
                  </div>
                </div>
              </section>
              <section className="rounded-lg border bg-card">
                <div className="p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-medium">
                      {text?.("treasury")}
                    </span>
                    <Skeleton className="h-4 w-24" />
                  </div>
                  <Skeleton className="mt-1.5 h-1 w-full" />
                </div>
                {budget && (budget.pools.length > 1 || budgetRows > 0) && (
                  <div className="space-y-3 px-3 pb-3">
                    {budget.pools.slice(1).map((pool) => (
                      <div key={pool.id}>
                        <div className="flex h-4 justify-between">
                          <Skeleton className="h-3 w-20" />
                          <Skeleton className="h-3 w-24" />
                        </div>
                        <Skeleton className="mt-1.5 h-1 w-full" />
                      </div>
                    ))}
                    {budgetRows > 0 && (
                      <div className="space-y-1.5 border-t pt-3">
                        {Array.from({ length: budgetRows }, (_, index) => (
                          <div key={index} className="flex h-4 justify-between">
                            <Skeleton className="h-3 w-20" />
                            <Skeleton className="h-3 w-12" />
                          </div>
                        ))}
                        {budget.counts.primary + budget.counts.secondary >
                          0 && (
                          <div className="flex h-[22px] items-end justify-between">
                            <Skeleton className="h-3 w-20" />
                            <Skeleton className="h-3 w-12" />
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </section>
              <section className="space-y-3 rounded-lg border bg-card p-4">
                <Skeleton className="h-6 w-40" />
                <Skeleton className="h-4 w-full" />
              </section>
            </aside>
          </div>
        </div>
      </div>
    );
  if (
    variant === "leagues" ||
    variant === "league" ||
    variant === "league-reference"
  )
    return (
      <LeagueDirectoryLoading
        label={label}
        workspace={variant === "league"}
        reference={variant === "league-reference"}
      />
    );
  // The locale is still resolving here, so translated headings are placeholders.
  // Once providers resolve, the page keeps its real headings and static controls.
  return (
    <div className="page-width py-8 sm:py-10" data-loading-layout={variant}>
      <div
        aria-hidden="true"
        className={`${variant === "catalog" ? "mb-5 gap-4" : "mb-7 gap-5"} flex flex-wrap items-start justify-between`}
      >
        <div className="space-y-2">
          <Skeleton className="h-[30px] w-40 sm:h-[37.5px]" />
          {variant !== "catalog" && (
            <Skeleton className="h-5 w-80 max-w-full" />
          )}
        </div>
        {variant === "catalog" ? (
          <div className="flex max-w-full flex-wrap items-end gap-x-4 gap-y-2">
            <div className="flex flex-wrap items-center gap-1 pb-1">
              {catalogTiers.map((tier) => (
                <Skeleton key={tier} className="h-[26px] w-14 rounded-full" />
              ))}
            </div>
            <div className="flex w-full flex-col gap-1 text-xs sm:max-w-80">
              <Skeleton className="h-4 w-14" />
              <div className="relative mt-1 block min-w-0">
                <Skeleton className="h-11 w-full sm:h-9" />
              </div>
            </div>
          </div>
        ) : (
          variant === "library" && <Skeleton className="h-11 w-36 sm:h-9" />
        )}
      </div>
      {variant === "catalog" ? (
        <div className="catalog-layout" role="status">
          <span className="sr-only">{label}</span>
          <aside aria-hidden="true" className="catalog-index">
            <div className="flex min-h-11 items-center lg:min-h-9">
              <Skeleton className="h-9 w-full" />
            </div>
            <div className="scroll-fade-x mt-3 flex gap-1 overflow-hidden lg:max-h-[calc(100dvh-var(--site-content-top)-9.25rem)] lg:flex-col lg:overflow-y-auto lg:scroll-fade-none">
              {catalogChoices.map(({ roster }) => (
                <div
                  key={roster.id}
                  className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded px-2 py-1.5 lg:min-h-0 lg:py-1"
                >
                  <Skeleton className="size-4 shrink-0" />
                  <Skeleton
                    className="h-4"
                    style={{ width: Math.min(150, roster.name.length * 6) }}
                  />
                </div>
              ))}
            </div>
          </aside>
          <div aria-hidden="true" className="min-w-0 space-y-5">
            {catalogChoices.slice(0, 3).map(({ roster }) => (
              <div
                key={roster.id}
                className="overflow-hidden rounded-lg border bg-card"
              >
                <div className="flex items-center gap-1 border-b bg-secondary/40 px-2 py-2 md:gap-2 md:px-3">
                  <Skeleton className="size-4 shrink-0 min-[360px]:size-6 md:size-8" />
                  <Skeleton className="h-4 min-w-0 max-w-36 flex-1 md:h-5" />
                  <Skeleton className="h-11 w-16 shrink-0 md:h-7 md:w-24" />
                  <Skeleton className="h-11 w-20 shrink-0 md:h-7 md:w-28" />
                  <span className="flex h-11 w-7 shrink-0 items-center justify-center md:hidden">
                    <ChevronDown className="size-5 text-muted-foreground" />
                  </span>
                </div>
                <div className="hidden md:block">
                  <TableLoading
                    rows={roster.players.length}
                    title={false}
                    framed={false}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : variant === "users" ? (
        <UsersLoading label={label} />
      ) : (
        <>
          <div
            aria-hidden="true"
            className="mb-7 grid grid-cols-2 gap-3 lg:grid-cols-[minmax(200px,1fr)_180px_210px]"
          >
            <Skeleton className="col-span-2 h-10 lg:col-span-1" />
            <Skeleton className="h-10" />
            <Skeleton className="h-10" />
          </div>
          <LibraryCardsLoading label={label} />
        </>
      )}
    </div>
  );
}

/** The initial locale/provider boundary preserves the same shell geometry. */
export function ShellLoading({ children }: { children?: ReactNode }) {
  return (
    <ShellFrame
      footer={<SiteFooter />}
      header={
        <header className="site-header no-print" aria-hidden="true">
          <div className="site-header-content flex h-full items-center justify-between gap-3">
            <BrandLogo />
            <div className="flex size-11 items-center justify-center lg:hidden">
              <PanelRightOpen className="size-6" />
            </div>
          </div>
        </header>
      }
      sidebar={
        <>
          <div
            className="site-sidebar-header flex h-16 shrink-0 items-center"
            aria-hidden="true"
          >
            <div className="site-sidebar-logo flex h-11 items-center overflow-hidden">
              <BrandLogo className="h-9" />
            </div>
            <div className="site-sidebar-toggle flex items-center justify-center text-muted-foreground">
              <PanelLeftClose className="size-4" />
            </div>
          </div>
          <div
            className="site-sidebar-content min-h-0 flex-1 space-y-1 overflow-y-auto"
            aria-hidden="true"
          >
            {[Shield, BookOpen, Flag, Trophy].map((Icon, index) => (
              <div key={index} className="flex h-11 items-center gap-3 px-3">
                <Icon className="size-4 shrink-0 text-muted-foreground" />
                <Skeleton className="h-4 w-24" />
              </div>
            ))}
          </div>
          <div className="site-sidebar-footer" aria-hidden="true">
            <div className="flex shrink-0 flex-col gap-2 border-t pt-4">
              <div className="flex h-11 items-center gap-3 px-3">
                <Languages className="size-4 shrink-0 text-muted-foreground" />
                <Skeleton className="h-4 w-20" />
                <Skeleton className="ml-auto h-4 w-8" />
              </div>
              <AccountLoading />
            </div>
          </div>
        </>
      }
    >
      {children ?? <LoadingLayout label="Loading…" />}
    </ShellFrame>
  );
}
