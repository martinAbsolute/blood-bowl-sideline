"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "gt-next";
import { SidebarTooltip } from "./sidebar-tooltip";
import { BookOpen, Flag, House, Trophy, UsersRound } from "lucide-react";

export function AppNavigation({
  admin = false,
  onNavigate,
  collapsed = false,
}: {
  admin?: boolean;
  onNavigate?: () => void;
  collapsed?: boolean;
}) {
  const t = useTranslations();
  const pathname = usePathname();
  const items = [
    { href: "/teams", key: "myTeams", icon: House },
    { href: "/rosters", key: "rosters", icon: BookOpen },
    { href: "/leagues", key: "leagues", icon: Flag },
    { href: null, key: "tournaments", icon: Trophy },
    ...(admin ? [{ href: "/users", key: "users", icon: UsersRound }] : []),
  ];
  return (
    <nav aria-label={t("menu")} className="space-y-1">
      {items.map(({ href, key, icon: Icon }) => {
        const active =
          href !== null &&
          (pathname === href ||
            pathname.startsWith(`${href}/`) ||
            (href === "/teams" && pathname.startsWith("/team/")));
        const className = `sidebar-menu-button flex min-h-11 w-full items-center rounded-lg py-2.5 text-sm font-medium transition-colors ${active ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-secondary hover:text-foreground"} focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary`;
        const label = href ? t(key) : `${t(key)} · ${t("comingSoon")}`;
        const content = (
          <>
            <Icon aria-hidden="true" className="size-4 shrink-0" />
            <span className="sidebar-button-label" aria-hidden={collapsed}>
              {t(key)}
            </span>
            {!href ? (
              <span
                className="sidebar-button-badge text-xs"
                aria-hidden={collapsed}
              >
                {t("comingSoon")}
              </span>
            ) : null}
          </>
        );
        return href ? (
          <SidebarTooltip key={key} enabled={collapsed} label={label}>
            <Link
              href={href}
              onClick={onNavigate}
              aria-label={t(key)}
              aria-current={active ? "page" : undefined}
              data-collapsed={collapsed}
              className={className}
            >
              {content}
            </Link>
          </SidebarTooltip>
        ) : (
          <SidebarTooltip key={key} enabled={collapsed} label={label}>
            <span
              className="block rounded-lg focus-visible:outline-2 focus-visible:outline-primary"
              tabIndex={collapsed ? 0 : undefined}
              aria-label={collapsed ? label : undefined}
            >
              <button
                type="button"
                disabled
                data-collapsed={collapsed}
                className="sidebar-menu-button flex min-h-11 w-full items-center rounded-lg py-2.5 text-sm font-medium text-muted-foreground opacity-45"
              >
                {content}
              </button>
            </span>
          </SidebarTooltip>
        );
      })}
    </nav>
  );
}
