import { Skeleton } from "./ui/skeleton";
import { BrandLogo } from "./brand";
import { SiteFooter } from "./site-footer";
import { ShellFrame } from "./shell-frame";
import { AccountLoading } from "./account-loading";
import { Languages, PanelLeftClose, PanelRightOpen } from "lucide-react";
import { getRoster, getRuleset } from "@/domain/catalog";
import { budgetSummary } from "@/domain/budget";
import { BudgetOverview, BudgetBreakdown } from "./budget-details";
import { TeamSupport } from "./team-support";
import { TeamAffiliations } from "./team-affiliations";
import { PlayerRecruitment } from "./player-recruitment";
import type { Team } from "@/domain/types";
import { TeamHeader } from "./team-header";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { ArrowLeft, Copy, Printer, ChevronDown, Ellipsis } from "lucide-react";
import { BookOpen, Flag, Shield, Trophy } from "lucide-react";
import { EditorSelect } from "./editor-select";
import { Card } from "./ui/card";
import type { ReactNode } from "react";
import { LeagueCardsLoading, UsersLoading } from "./list-loading";

const ignoreChange = () => {};

export type LoadingVariant =
  "library" | "editor" | "catalog" | "leagues" | "league" | "users";

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
  const summary = team ? budgetSummary(team) : undefined;
  if (variant === "editor")
    return (
      <div
        className="page-width team-builder py-3"
        role="status"
        aria-label={label}
      >
        <span className="sr-only">{label}</span>
        <div inert>
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
                <Button
                  variant="outline"
                  size="sm"
                  className="hidden h-9 sm:inline-flex"
                >
                  <Copy className="size-4" />
                  {text?.("duplicate")}
                </Button>
                <Button size="sm" className="h-11 flex-1 sm:h-9 sm:flex-none">
                  <Printer className="size-4" />
                  {text?.("print")}
                  <ChevronDown className="size-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-11 flex-1 sm:hidden"
                >
                  <Ellipsis className="size-4" />
                  {text?.("teamActions")}
                </Button>
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
              {team ? (
                <PlayerRecruitment team={team} onChange={ignoreChange} />
              ) : (
                <TableLoading
                  rows={4}
                  heading={text?.("recruitPlayers")}
                  text={text}
                />
              )}
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
              {team ? (
                <TeamSupport team={team} onChange={ignoreChange} />
              ) : (
                <div className="grid items-start gap-4 @min-[780px]:grid-cols-2">
                  {[5, 6].map((count) => (
                    <section key={count}>
                      <div className="mb-2 flex h-6 items-center justify-between px-1">
                        <h2 className="section-title">
                          {text?.(count === 5 ? "staff" : "inducements")}
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
              )}
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
                        <EditorSelect
                          tabIndex={-1}
                          aria-label={text?.(
                            index === 0 ? "ruleset" : "roster",
                          )}
                        >
                          <option>
                            {index === 0
                              ? getRuleset(team.rulesetId).name
                              : getRoster(team.rosterId)?.name}
                          </option>
                        </EditorSelect>
                      ) : (
                        <Skeleton className="h-9 w-full" />
                      )}
                    </div>
                  ))}
                </div>
                <div className="mt-4 border-t pt-4">
                  {team ? (
                    <TeamAffiliations
                      roster={getRoster(team.rosterId)!}
                      team={team}
                    />
                  ) : (
                    <div className="space-y-2">
                      <Skeleton className="h-4 w-full" />
                      <Skeleton className="h-4 w-3/4" />
                    </div>
                  )}
                </div>
              </section>
              <section className="rounded-lg border bg-card">
                {summary ? (
                  <>
                    <BudgetOverview pool={summary.pools[0]} />
                    <BudgetBreakdown summary={summary} />
                  </>
                ) : (
                  <div className="p-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-medium">
                        {text?.("treasury")}
                      </span>
                      <Skeleton className="h-4 w-24" />
                    </div>
                    <Skeleton className="mt-1.5 h-1 w-full" />
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
  if (variant === "league")
    return (
      <div
        className="page-width space-y-4 py-5 sm:py-6"
        role="status"
        data-loading-layout={variant}
      >
        <span className="sr-only">{label}</span>
        <div aria-hidden="true" className="flex min-h-10 items-center">
          <ArrowLeft className="mr-2 size-4 text-muted-foreground" />
          <Skeleton className="h-4 w-24" />
        </div>
        <div
          aria-hidden="true"
          className="overflow-hidden rounded-xl border bg-card"
        >
          <div className="space-y-3 p-5 sm:p-6">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-9 w-72 max-w-full" />
            <Skeleton className="h-5 w-56 max-w-full" />
          </div>
          <div className="flex gap-5 border-t bg-secondary/25 px-5 py-3">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-28" />
          </div>
        </div>
        <div
          aria-hidden="true"
          className="flex gap-3 overflow-hidden rounded-xl border p-2"
        >
          {[0, 1, 2].map((index) => (
            <Skeleton key={index} className="h-10 w-28 shrink-0" />
          ))}
        </div>
        <div
          aria-hidden="true"
          className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]"
        >
          <div className="space-y-4 rounded-xl border bg-card p-5">
            <Skeleton className="h-6 w-40" />
            {[0, 1, 2, 3].map((index) => (
              <Skeleton key={index} className="h-12 w-full" />
            ))}
          </div>
          <div className="space-y-4 rounded-xl border bg-card p-5">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-16 w-full" />
          </div>
        </div>
      </div>
    );
  // The locale is still resolving here, so translated headings are placeholders.
  // Once providers resolve, the page keeps its real headings and static controls.
  return (
    <div className="page-width py-8 sm:py-10" data-loading-layout={variant}>
      <div aria-hidden="true" className="mb-7 space-y-2">
        <Skeleton className="h-[30px] w-40 sm:h-[37.5px]" />
        {variant !== "catalog" && <Skeleton className="h-5 w-80 max-w-full" />}
      </div>
      {variant === "catalog" ? (
        <div className="catalog-layout" role="status">
          <span className="sr-only">{label}</span>
          <aside aria-hidden="true" className="catalog-index">
            <Skeleton className="h-9 w-full" />
            <div className="mt-3 flex gap-1 overflow-hidden lg:flex-col">
              {Array.from({ length: 8 }, (_, index) => (
                <Skeleton key={index} className="h-7 w-28 shrink-0" />
              ))}
            </div>
          </aside>
          <div aria-hidden="true" className="min-w-0 space-y-5">
            {[0, 1, 2].map((index) => (
              <div
                key={index}
                className="overflow-hidden rounded-lg border bg-card"
              >
                <div className="flex h-[49px] items-center justify-between gap-4 bg-secondary/40 px-3">
                  <Skeleton className="h-6 w-36" />
                  <Skeleton className="h-7 w-24" />
                </div>
                <div className="hidden md:block">
                  <TableLoading rows={4} title={false} framed={false} />
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
          {variant === "leagues" ? (
            <LeagueCardsLoading label={label} />
          ) : (
            <LibraryCardsLoading label={label} />
          )}
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
