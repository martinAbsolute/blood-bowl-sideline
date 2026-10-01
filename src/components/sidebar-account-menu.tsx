"use client";

import { useTranslations } from "gt-next";
import { ChevronsUpDown, LogOut } from "lucide-react";
import { Button } from "./ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { SidebarTooltip } from "./sidebar-tooltip";
import { UserAvatar, type UserProfileData } from "./user-profile";

export function SidebarAccountMenu({
  user,
  collapsed = false,
  mobile = false,
  signingOut,
  onSignOut,
}: {
  user: UserProfileData;
  collapsed?: boolean;
  mobile?: boolean;
  signingOut: boolean;
  onSignOut: () => void;
}) {
  const t = useTranslations();
  const name = user.name || t("coach");
  const label = `${t("accountMenu")} · ${name}`;
  return (
    <DropdownMenu>
      <SidebarTooltip enabled={collapsed} label={label}>
        <DropdownMenuTrigger
          aria-label={label}
          data-collapsed={collapsed}
          render={
            <Button
              variant="ghost"
              className="sidebar-menu-button sidebar-account-button h-12 w-full rounded-lg"
            />
          }
        >
          <UserAvatar user={user} className="size-8" />
          <span
            className="sidebar-button-label min-w-0 flex-1 text-left"
            aria-hidden={collapsed}
          >
            <span className="block truncate text-sm font-semibold">{name}</span>
            {user.email ? (
              <span className="block truncate text-xs font-normal text-muted-foreground">
                {user.email}
              </span>
            ) : null}
          </span>
          <span
            className="sidebar-button-badge text-muted-foreground"
            aria-hidden="true"
          >
            <ChevronsUpDown className="size-4" />
          </span>
        </DropdownMenuTrigger>
      </SidebarTooltip>
      <DropdownMenuContent
        side={mobile ? "top" : "right"}
        align="end"
        sideOffset={8}
        className="w-60"
      >
        <DropdownMenuGroup>
          <DropdownMenuLabel className="px-3 py-2 font-normal">
            <span className="block truncate text-sm font-semibold text-foreground">
              {name}
            </span>
            {user.email ? (
              <span className="block truncate">{user.email}</span>
            ) : null}
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          disabled={signingOut}
          onClick={onSignOut}
          className="min-h-11 gap-3 px-3"
        >
          <LogOut aria-hidden="true" className="size-4" />
          {t("signOut")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
