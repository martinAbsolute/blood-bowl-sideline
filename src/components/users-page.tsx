"use client";

import { useConvexAuth, usePaginatedQuery, useQuery } from "convex/react";
import { useLocale, useTranslations } from "gt-next";
import { LoaderCircle, LockKeyhole, UsersRound } from "lucide-react";
import { api } from "../../convex/_generated/api";
import { UsersLoading } from "./list-loading";
import { UserProfile } from "./user-profile";
import { Button } from "./ui/button";
import { sortUsers } from "@/lib/user-directory";

export function UsersPage() {
  const t = useTranslations();
  const { isAuthenticated, isLoading } = useConvexAuth();
  const viewer = useQuery(api.users.viewer, isAuthenticated ? {} : "skip");
  return (
    <div className="page-width py-8 sm:py-10">
      <header className="mb-7">
        <h1 className="page-heading">{t("users")}</h1>
        <p className="mt-2 max-w-xl text-sm text-muted-foreground">
          {t("usersHint")}
        </p>
      </header>
      {isLoading || (isAuthenticated && viewer === undefined) ? (
        <UsersLoading label={t("loading")} />
      ) : viewer?.role === "admin" ? (
        <UserDirectory />
      ) : (
        <div className="rounded-xl border bg-card p-8 text-center">
          <LockKeyhole
            aria-hidden="true"
            className="mx-auto mb-3 size-7 text-muted-foreground"
          />
          <p role="alert" className="font-medium">
            {t("adminOnly")}
          </p>
        </div>
      )}
    </div>
  );
}

function UserDirectory() {
  const t = useTranslations();
  const locale = useLocale();
  const { results, status, loadMore } = usePaginatedQuery(
    api.users.list,
    {},
    { initialNumItems: 30 },
  );
  const users = sortUsers(results);
  const dateFormat = new Intl.DateTimeFormat(
    locale === "uk" ? "uk-UA" : "en-GB",
    { dateStyle: "medium", timeStyle: "short" },
  );
  return (
    <>
      {users.length ? (
        <ul className="divide-y overflow-hidden rounded-xl border bg-card">
          {users.map((user) => (
            <li
              key={user.id}
              className="flex items-center justify-between gap-4 p-4 sm:px-5"
            >
              <div className="min-w-0">
                <UserProfile user={user} online={user.online} />
                <p
                  className={`ml-15 mt-1 text-xs ${user.online ? "text-emerald-700" : "text-muted-foreground"}`}
                >
                  {user.online
                    ? t("online")
                    : user.lastSeenAt
                      ? t("lastSeen", {
                          date: dateFormat.format(user.lastSeenAt),
                        })
                      : t("notSeenYet")}
                </p>
              </div>
            </li>
          ))}
        </ul>
      ) : status === "Exhausted" ? (
        <div className="rounded-xl border bg-card p-10 text-center">
          <UsersRound
            aria-hidden="true"
            className="mx-auto mb-3 size-8 text-muted-foreground"
          />
          <p className="text-sm text-muted-foreground">{t("noOtherUsers")}</p>
        </div>
      ) : null}
      {status === "LoadingFirstPage" ? (
        <UsersLoading label={t("loading")} />
      ) : null}
      {status === "CanLoadMore" || status === "LoadingMore" ? (
        <Button
          className="mt-4"
          variant="outline"
          disabled={status === "LoadingMore"}
          aria-busy={status === "LoadingMore"}
          onClick={() => loadMore(30)}
        >
          {status === "LoadingMore" && (
            <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
          )}
          {t("loadMore")}
        </Button>
      ) : null}
    </>
  );
}
