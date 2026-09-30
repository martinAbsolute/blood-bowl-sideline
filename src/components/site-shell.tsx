"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useLocale, useSetLocale, useTranslations } from "gt-next";
import { useConvexAuth } from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";
import { CodeXml, Heart, Languages, LogOut, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BrandLogo } from "./brand";
import { toast } from "@/components/ui/toast";
import { useDraftSignIn } from "./draft-sign-in-provider";
import { version } from "../../package.json";
export function LoginButton({ className }: { className?: string }) {
  const t = useTranslations(),
    { signIn } = useAuthActions(),
    draftSignIn = useDraftSignIn(),
    [starting, setStarting] = useState(false);
  async function login() {
    if (process.env.NEXT_PUBLIC_TELEGRAM_AUTH_READY !== "true") {
      toast.add({ type: "info", title: t("botPending") });
      return;
    }
    setStarting(true);
    try {
      let redirectTo: string;
      try {
        redirectTo = draftSignIn.prepare();
      } catch {
        toast.add({ type: "error", title: t("storageError") });
        setStarting(false);
        return;
      }
      const result = await signIn("telegram", { redirectTo });
      if (!result.redirect) setStarting(false);
    } catch {
      toast.add({ type: "error", title: t("loginFailed") });
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
    setLocale = useSetLocale();
  const { isAuthenticated } = useConvexAuth(),
    { signOut } = useAuthActions();
  useEffect(() => {
    document.documentElement.lang = locale === "uk" ? "uk" : "en";
  }, [locale]);
  return (
    <>
      <header className="site-header no-print">
        <div className="page-width flex min-h-14 flex-wrap items-center justify-between gap-3 py-2">
          <Link
            href="/teams"
            className="flex items-center gap-2.5 text-primary"
            aria-label={t("app")}
          >
            <BrandLogo />
          </Link>

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
      <footer className="no-print border-t border-border py-6">
        <div className="page-width flex flex-col justify-between gap-5 md:flex-row md:items-center">
          <div className="space-y-2">
            <p className="flex items-start gap-2 text-sm font-medium leading-relaxed text-primary">
              <Heart
                aria-hidden="true"
                className="mt-0.5 size-4 shrink-0 text-orange-500"
              />
              {t("community")}
            </p>
            <p className="text-xs text-muted-foreground">
              © 2026 martinAbsolute · Blood Bowl Sideline
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-3 text-xs text-muted-foreground">
            <a
              href="https://github.com/martinAbsolute/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-sm transition-colors hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary"
            >
              <CodeXml aria-hidden="true" className="size-4" />
              GitHub
            </a>
            <a
              href="https://t.me/martinAbsolute"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-sm transition-colors hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary"
            >
              <Send aria-hidden="true" className="size-4" />
              @martinAbsolute
            </a>
            <p
              className="font-mono tabular-nums"
              aria-label={t("appVersion", { version })}
            >
              v{version}
            </p>
          </div>
        </div>
      </footer>
    </>
  );
}
