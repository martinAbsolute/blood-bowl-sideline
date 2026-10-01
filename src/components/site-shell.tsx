"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useLocale, useSetLocale, useTranslations } from "gt-next";
import { useAction, useConvexAuth, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useAuthActions } from "@convex-dev/auth/react";
import { Languages, LogOut, Menu, Send, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BrandLogo } from "./brand";
import { toast } from "@/components/ui/toast";
import { useDraftSignIn } from "./draft-sign-in-provider";
import { SiteFooter } from "./site-footer";
import { AppNavigation } from "./app-navigation";
import { UserProfile } from "./user-profile";
import { UserPresence } from "./user-presence";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "./ui/sheet";
import { Skeleton } from "./ui/skeleton";
export function LoginButton({ className }: { className?: string }) {
  const t = useTranslations(),
    { signIn } = useAuthActions(),
    isTelegramConfigured = useAction(api.auth.isTelegramConfigured),
    draftSignIn = useDraftSignIn(),
    [starting, setStarting] = useState(false);
  async function login() {
    setStarting(true);
    try {
      if (!(await isTelegramConfigured({}))) {
        toast.add({ type: "info", title: t("botPending") });
        setStarting(false);
        return;
      }
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
    locale = useLocale();
  const { isAuthenticated, isLoading } = useConvexAuth(),
    { signOut } = useAuthActions();
  const viewer = useQuery(api.users.viewer, isAuthenticated ? {} : "skip");
  const [open, setOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  async function logout() {
    setSigningOut(true);
    try {
      await signOut();
      setOpen(false);
    } catch {
      toast.add({ type: "error", title: t("signOutFailed") });
    } finally {
      setSigningOut(false);
    }
  }
  useEffect(() => {
    document.documentElement.lang = locale === "uk" ? "uk" : "en";
  }, [locale]);
  return (
    <>
      {isAuthenticated && viewer ? (
        <UserPresence key={viewer.id} userId={viewer.id} />
      ) : null}
      <header className="site-header no-print">
        <div className="page-width flex min-h-14 flex-wrap items-center justify-between gap-3 py-2">
          <Link
            href="/teams"
            className="flex items-center gap-2.5 text-primary"
            aria-label={t("app")}
          >
            <BrandLogo />
          </Link>

          <div className="hidden items-center gap-2 lg:flex">
            <LanguageSwitch />
            {isAuthenticated ? (
              <Button
                size="sm"
                variant="outline"
                className="rounded-full"
                disabled={signingOut}
                onClick={() => void logout()}
              >
                <LogOut className="size-4" />
                <span>{t("signOut")}</span>
              </Button>
            ) : (
              <LoginButton className="rounded-full text-xs [&>svg]:size-3.5 [&>span]:hidden md:[&>span]:inline" />
            )}
          </div>
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-11 lg:hidden"
                  aria-label={t("openMenu")}
                />
              }
            >
              <Menu className="size-6" />
            </SheetTrigger>
            <SheetContent
              side="right"
              showCloseButton={false}
              className="w-[min(88vw,360px)]! gap-0 overflow-y-auto p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]"
            >
              <SheetHeader className="mb-6 flex-row items-center justify-between p-0">
                <SheetTitle className="display-font text-xl">
                  {t("menu")}
                </SheetTitle>
                <SheetDescription className="sr-only">
                  {t("menuDescription")}
                </SheetDescription>
                <SheetClose
                  render={
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-11"
                      aria-label={t("closeMenu")}
                    />
                  }
                >
                  <X className="size-5" />
                </SheetClose>
              </SheetHeader>
              <div className="mb-5 border-b pb-5">
                {viewer ? (
                  <UserProfile user={viewer} />
                ) : isLoading || isAuthenticated ? (
                  <Skeleton className="h-12 w-full" />
                ) : (
                  <LoginButton className="h-11 w-full" />
                )}
              </div>
              <AppNavigation
                admin={viewer?.role === "admin"}
                onNavigate={() => setOpen(false)}
              />
              <div className="mt-auto pt-8">
                <div className="space-y-3 border-t pt-5">
                  <LanguageSwitch expanded />
                  {isAuthenticated ? (
                    <Button
                      variant="outline"
                      className="h-11 w-full justify-start"
                      disabled={signingOut}
                      onClick={() => void logout()}
                    >
                      <LogOut className="size-4" />
                      {t("signOut")}
                    </Button>
                  ) : null}
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </header>
      <div className="lg:grid lg:grid-cols-[240px_minmax(0,1fr)] print:block">
        <aside className="no-print hidden border-r bg-card/50 px-4 py-6 lg:block">
          <div className="sticky top-6">
            <div className="mb-5 border-b pb-5">
              {viewer ? (
                <UserProfile user={viewer} />
              ) : isLoading || isAuthenticated ? (
                <Skeleton className="h-12 w-full" />
              ) : (
                <LoginButton className="h-11 w-full" />
              )}
            </div>
            <AppNavigation admin={viewer?.role === "admin"} />
          </div>
        </aside>
        <div className="min-w-0">
          <main className="min-h-[calc(100vh-245px)]">{children}</main>
          <SiteFooter community={t("community")} />
        </div>
      </div>
    </>
  );
}

function LanguageSwitch({ expanded = false }: { expanded?: boolean }) {
  const t = useTranslations(),
    locale = useLocale(),
    setLocale = useSetLocale();
  return (
    <Button
      variant="ghost"
      size="sm"
      aria-label={t("language")}
      className={
        expanded
          ? "h-11 w-full justify-start gap-3 px-3"
          : "rounded-full gap-1.5"
      }
      onClick={() => setLocale(locale === "uk" ? "en" : "uk")}
    >
      <Languages className="size-4" />
      {expanded ? t("language") : null}
      <span className={expanded ? "ml-auto" : undefined}>
        {locale === "uk" ? "UK" : "EN"}
      </span>
      <span
        aria-hidden="true"
        className="ml-1 inline-block size-2 rounded-full bg-blue-500 shadow-[0_3px_0_#facc15]"
      />
    </Button>
  );
}
