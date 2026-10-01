"use client";

import { useTranslations } from "gt-next";
import { ShieldCheck, UserRound } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";

export type UserProfileData = {
  name: string | null;
  image: string | null;
  email: string | null;
  role: "admin" | "user";
};

export function UserProfile({
  user,
  online,
  showRole = true,
}: {
  user: UserProfileData;
  online?: boolean;
  showRole?: boolean;
}) {
  const t = useTranslations();
  const name = user.name || t("coach");
  return (
    <div className="flex min-w-0 items-center gap-3">
      <div className="relative shrink-0">
        <UserAvatar user={user} />
        {online ? (
          <span
            aria-hidden="true"
            className="absolute bottom-0 right-0 size-3 rounded-full bg-emerald-500 ring-2 ring-background"
          />
        ) : null}
      </div>
      <div className="min-w-0">
        <p className="truncate font-semibold">{name}</p>
        {user.email ? (
          <p className="truncate text-xs text-muted-foreground">{user.email}</p>
        ) : null}
        {showRole ? (
          <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
            {user.role === "admin" ? (
              <ShieldCheck
                aria-hidden="true"
                className="size-3.5 text-primary"
              />
            ) : null}
            {t(user.role === "admin" ? "adminRole" : "userRole")}
          </p>
        ) : null}
      </div>
    </div>
  );
}

export function UserAvatar({
  user,
  className = "size-12",
}: {
  user: Pick<UserProfileData, "name" | "image">;
  className?: string;
}) {
  const t = useTranslations();
  const name = user.name || t("coach");
  const initials = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toLocaleUpperCase();
  return (
    <Avatar className={className}>
      {user.image ? (
        <AvatarImage src={user.image} alt={name} referrerPolicy="no-referrer" />
      ) : null}
      <AvatarFallback className="bg-primary/10 font-semibold text-primary">
        {initials || <UserRound className="size-5" />}
      </AvatarFallback>
    </Avatar>
  );
}
