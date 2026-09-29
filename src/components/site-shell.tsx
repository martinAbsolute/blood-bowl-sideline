"use client";
import Link from "next/link";
import { useState } from "react";
import { usePathname } from "next/navigation";
import { useLocale, useSetLocale, useTranslations } from "gt-next";
import { useConvexAuth } from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";
import { ArrowUpRight, Languages, LogOut, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BrandMark } from "./brand";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
export function LoginButton({ className }: { className?: string }) {
  const t = useTranslations(),
    { signIn } = useAuthActions(),
    [starting, setStarting] = useState(false);
  async function login() {
    if (process.env.NEXT_PUBLIC_TELEGRAM_AUTH_READY !== "true") {
      toast.info(t("botPending"));
      return;
    }
    setStarting(true);
    try {
      await signIn("telegram", { redirectTo: "/builder" });
    } catch {
      toast.error(t("loginFailed"));
      setStarting(false);
    }
  }
  return (
    <Button
      variant="outline"
      className={className}
      aria-label={t("signIn")}
      disabled={starting}
      onClick={() => void login()}
    >
      <Send className="size-4" />
      <span>{t(starting ? "loginPending" : "signIn")}</span>
    </Button>
  );
}
export function SiteShell({ children }: { children: React.ReactNode }) {
  const t = useTranslations(),
    locale = useLocale(),
    setLocale = useSetLocale(),
    pathname = usePathname();
  const { isAuthenticated } = useConvexAuth(),
    { signOut } = useAuthActions();
  return (
    <>
      <header className="site-header no-print">
        <div className="page-width flex min-h-20 flex-wrap items-center justify-between gap-3 py-4">
          <Link
            href="/"
            className="flex items-center gap-2.5 text-primary"
            aria-label={t("app")}
          >
            <BrandMark />
            <span className="brand-wordmark">
              BLOOD BOWL
              <span>
                SIDELINE<span className="brand-dot">.</span>
              </span>
            </span>
          </Link>
          <nav
            aria-label={t("home")}
            className="order-3 flex w-full min-w-0 gap-1 overflow-x-auto sm:order-none sm:w-auto"
          >
            {[
              ["/builder", "teamBuilder"],
              ["/teams", "myTeams"],
              ["/rosters", "rosters"],
            ].map(([href, key]) => (
              <Button
                key={href}
                asChild
                variant="ghost"
                size="sm"
                className={cn(
                  "rounded-full px-3 text-xs sm:px-4 sm:text-sm",
                  pathname.startsWith(href) && "bg-secondary font-semibold",
                )}
              >
                <Link href={href}>{t(key)}</Link>
              </Button>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              aria-label={t("language")}
              className="rounded-full gap-1.5"
              onClick={() => setLocale(locale === "uk" ? "en" : "uk")}
            >
              <Languages className="size-4" />
              {locale === "uk" ? "UK" : "EN"}
              <span className="ml-1 inline-block size-2 rounded-full bg-blue-500 shadow-[0_3px_0_#facc15]" />
            </Button>
            {isAuthenticated ? (
              <Button
                size="sm"
                variant="outline"
                className="rounded-full"
                onClick={() => void signOut()}
              >
                <LogOut className="size-4" />
                <span className="hidden md:inline">{t("signOut")}</span>
              </Button>
            ) : (
              <LoginButton className="rounded-full text-xs [&>svg]:size-3.5 [&>span]:hidden md:[&>span]:inline" />
            )}
          </div>
        </div>
      </header>
      <main className="min-h-[calc(100vh-245px)]">{children}</main>
      <footer className="no-print border-t border-border py-7">
        <div className="page-width flex flex-col justify-between gap-5 md:flex-row">
          <div>
            <p className="text-sm font-medium text-primary">{t("community")}</p>
            <p className="mt-2 max-w-lg text-xs leading-relaxed text-muted-foreground">
              {t("fanDisclaimer")}
            </p>
          </div>
          <div className="text-xs text-muted-foreground">
            <Link
              href="/rules"
              className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
            >
              {t("rulesSources")}
              <ArrowUpRight className="size-3" />
            </Link>
            <p className="mt-2">{t("futureLeague")}</p>
          </div>
        </div>
      </footer>
    </>
  );
}
