"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "gt-next";
import { BookOpen, Flag, Shield, Trophy, UsersRound } from "lucide-react";

export function AppNavigation({
  admin = false,
  onNavigate,
}: {
  admin?: boolean;
  onNavigate?: () => void;
}) {
  const t = useTranslations();
  const pathname = usePathname();
  const items = [
    { href: "/teams", key: "myTeams", icon: Shield },
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
        const className = `flex min-h-11 w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${active ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-secondary hover:text-foreground"}`;
        return href ? (
          <Link
            key={key}
            href={href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={className}
          >
            <Icon aria-hidden="true" className="size-5" />
            {t(key)}
          </Link>
        ) : (
          <button
            key={key}
            type="button"
            disabled
            className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-muted-foreground opacity-45"
          >
            <Icon aria-hidden="true" className="size-5" />
            {t(key)}
            <span className="ml-auto text-xs">{t("comingSoon")}</span>
          </button>
        );
      })}
    </nav>
  );
}
