"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useLocale, useSetLocale, useTranslations } from "gt-next";
import { useAction, useConvexAuth, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useAuthActions } from "@convex-dev/auth/react";
import {
  Languages,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
  Send,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { BrandLogo } from "./brand";
import { toast } from "@/components/ui/toast";
import { useDraftSignIn } from "./draft-sign-in-provider";
import { ShellFrame } from "./shell-frame";
import { AppNavigation } from "./app-navigation";
import { SidebarTooltip } from "./sidebar-tooltip";
import { SidebarAccountMenu } from "./sidebar-account-menu";
import { UserPresence } from "./user-presence";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetTitle,
  SheetTrigger,
} from "./ui/sheet";
import { AccountLoading } from "./account-loading";
import { DevAuthPanel } from "./dev-auth-panel";
export function LoginButton({
  className,
  compact = false,
}: {
  className?: string;
  compact?: boolean;
}) {
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
    <SidebarTooltip
      enabled={compact}
      label={t(starting ? "loginPending" : "signIn")}
    >
      <Button
        variant={compact ? "ghost" : "outline"}
        className={className}
        aria-label={t("signIn")}
        disabled={starting}
        data-collapsed={compact}
        onClick={() => void login()}
      >
        <Send aria-hidden="true" className="size-4" />
        <span className="sidebar-button-label" aria-hidden={compact}>
          {t(starting ? "loginPending" : "signIn")}
        </span>
      </Button>
    </SidebarTooltip>
  );
}
export function SiteShell({
  children,
  footer,
}: {
  children: React.ReactNode;
  footer: React.ReactNode;
}) {
  const t = useTranslations(),
    locale = useLocale();
  const { isAuthenticated, isLoading } = useConvexAuth(),
    { signOut } = useAuthActions();
  const viewer = useQuery(api.users.viewer, isAuthenticated ? {} : "skip");
  const [open, setOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
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
  function accountControls(collapsed = false, mobile = false) {
    return (
      <div className="sidebar-account-controls flex shrink-0 flex-col gap-2 border-t pt-4">
        <LanguageSwitch compact={collapsed} />
        {viewer ? (
          <SidebarAccountMenu
            user={viewer}
            collapsed={collapsed}
            mobile={mobile}
            signingOut={signingOut}
            onSignOut={() => void logout()}
          />
        ) : isLoading || isAuthenticated ? (
          <AccountLoading compact={collapsed} />
        ) : (
          <LoginButton
            compact={collapsed}
            className="sidebar-menu-button sidebar-login-button h-12 w-full rounded-lg"
          />
        )}
        {!collapsed ? (
          <DevAuthPanel
            currentUserId={viewer?.id}
            onSignedIn={() => setOpen(false)}
          />
        ) : null}
      </div>
    );
  }
  const collapsed = !sidebarOpen;
  return (
    <>
      {isAuthenticated && viewer ? (
        <UserPresence key={viewer.id} userId={viewer.id} />
      ) : null}
      <ShellFrame
        footer={footer}
        sidebarOpen={sidebarOpen}
        header={
          <header className="site-header no-print">
            <div className="site-header-content flex h-full items-center justify-between gap-3">
              <Link
                href="/teams"
                className="flex items-center text-primary"
                aria-label={t("app")}
              >
                <BrandLogo />
              </Link>
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
                  <PanelRightOpen aria-hidden="true" className="size-6" />
                </SheetTrigger>
                <SheetContent
                  side="right"
                  showCloseButton={false}
                  className="w-[min(88vw,360px)]! gap-0 p-0"
                >
                  <div className="site-mobile-header flex shrink-0 items-center justify-between border-b">
                    <SheetTitle className="text-base font-semibold">
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
                      <PanelRightClose aria-hidden="true" className="size-6" />
                    </SheetClose>
                  </div>
                  <div className="site-mobile-body flex min-h-0 flex-1 flex-col gap-4 p-4">
                    <div className="min-h-0 flex-1 overflow-y-auto">
                      <AppNavigation
                        admin={viewer?.role === "admin"}
                        onNavigate={() => setOpen(false)}
                      />
                    </div>
                    {accountControls(false, true)}
                  </div>
                </SheetContent>
              </Sheet>
            </div>
          </header>
        }
        sidebar={
          <>
            <div className="site-sidebar-header flex h-16 shrink-0 items-center">
              <SidebarTooltip enabled={collapsed} label={t("app")}>
                <Link
                  href="/teams"
                  aria-label={t("app")}
                  className="site-sidebar-logo flex h-11 items-center overflow-hidden rounded-sm text-primary focus-visible:outline-2 focus-visible:outline-primary"
                >
                  <BrandLogo className="h-9" />
                </Link>
              </SidebarTooltip>
              <SidebarTooltip
                enabled
                label={t(collapsed ? "expandSidebar" : "collapseSidebar")}
              >
                <Button
                  variant="ghost"
                  size="icon"
                  className="site-sidebar-toggle text-muted-foreground"
                  aria-label={t(
                    collapsed ? "expandSidebar" : "collapseSidebar",
                  )}
                  aria-expanded={sidebarOpen}
                  aria-controls="site-sidebar"
                  onClick={() => setSidebarOpen((current) => !current)}
                >
                  {collapsed ? (
                    <PanelLeftOpen aria-hidden="true" className="size-4" />
                  ) : (
                    <PanelLeftClose aria-hidden="true" className="size-4" />
                  )}
                </Button>
              </SidebarTooltip>
            </div>
            <div className="site-sidebar-content min-h-0 flex-1 overflow-y-auto">
              <AppNavigation
                admin={viewer?.role === "admin"}
                collapsed={collapsed}
              />
            </div>
            <div className="site-sidebar-footer">
              {accountControls(collapsed)}
            </div>
          </>
        }
      >
        {children}
      </ShellFrame>
    </>
  );
}

function LanguageSwitch({ compact = false }: { compact?: boolean }) {
  const t = useTranslations(),
    locale = useLocale(),
    setLocale = useSetLocale();
  return (
    <SidebarTooltip
      enabled={compact}
      label={t(locale === "uk" ? "switchToEnglish" : "switchToUkrainian")}
    >
      <Button
        variant="ghost"
        aria-label={t("language")}
        data-collapsed={compact}
        className="sidebar-menu-button sidebar-language-button h-11 w-full rounded-lg"
        onClick={() => setLocale(locale === "uk" ? "en" : "uk")}
      >
        <span className="sidebar-language-icon" aria-hidden="true">
          <Languages className="size-4" />
        </span>
        <span className="sidebar-button-label" aria-hidden={compact}>
          {t("language")}
        </span>
        <span className="sidebar-language-code font-medium">
          {locale === "uk" ? "UK" : "EN"}
        </span>
      </Button>
    </SidebarTooltip>
  );
}
