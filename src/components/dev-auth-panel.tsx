"use client";

import { useEffect, useId, useState } from "react";
import { useAuthActions } from "@convex-dev/auth/react";
import {
  useConvexAuth,
  useMutation,
  usePaginatedQuery,
  useQuery,
} from "convex/react";
import { useTranslations } from "gt-next";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { EditorSelect } from "./editor-select";
import { Button } from "./ui/button";

export function DevAuthPanel({
  currentUserId,
  onSignedIn,
}: {
  currentUserId?: string;
  onSignedIn?: () => void;
}) {
  const [serverEnabled, setServerEnabled] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      try {
        const response = await fetch("/api/dev-auth", {
          cache: "no-store",
          signal: controller.signal,
        });
        if (!response.ok) return;
        const body: unknown = await response.json();
        if (
          !controller.signal.aborted &&
          typeof body === "object" &&
          body !== null &&
          "enabled" in body &&
          body.enabled === true
        ) {
          setServerEnabled(true);
        }
      } catch {
        // An unavailable or disabled gate leaves the normal sign-in UI intact.
      }
    })();
    return () => controller.abort();
  }, []);
  const backend = useQuery(api.devAuth.status, serverEnabled ? {} : "skip");
  if (!serverEnabled || !backend?.enabled) return null;
  return (
    <EnabledDevAuthPanel
      currentUserId={currentUserId}
      onSignedIn={onSignedIn}
    />
  );
}

function EnabledDevAuthPanel({
  currentUserId,
  onSignedIn,
}: {
  currentUserId?: string;
  onSignedIn?: () => void;
}) {
  const t = useTranslations();
  const selectId = useId();
  const { isAuthenticated, isLoading } = useConvexAuth();
  const { signIn, signOut } = useAuthActions();
  const ensureTestUsers = useMutation(api.devAuth.ensureTestUsers);
  const {
    results: users,
    status,
    loadMore,
  } = usePaginatedQuery(api.devAuth.listUsers, {}, { initialNumItems: 30 });
  const [selectedId, setSelectedId] = useState<Id<"users"> | "">("");
  const [preparedUsers, setPreparedUsers] = useState<
    { id: Id<"users">; name: string }[]
  >([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const choices = [
    ...users,
    ...preparedUsers.filter(
      (prepared) => !users.some((user) => user.id === prepared.id),
    ),
  ];
  const selected = selectedId || choices[0]?.id || "";
  const testCoaches = preparedUsers.length
    ? preparedUsers
    : users.filter((user) =>
        ["Dev Coach A", "Dev Coach B"].includes(user.name),
      );

  async function createTestCoaches() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const result = await ensureTestUsers({});
      setPreparedUsers(result.users);
      setSelectedId(result.users[0]?.id ?? "");
    } catch {
      setError(t("devAuth.createFailed"));
    } finally {
      setBusy(false);
    }
  }

  async function login(userId: Id<"users">) {
    if (busy || isLoading || userId === currentUserId) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/dev-auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
        cache: "no-store",
      });
      if (!response.ok) throw new Error("Development sign-in unavailable");
      const body: unknown = await response.json();
      if (
        typeof body !== "object" ||
        body === null ||
        !("token" in body) ||
        typeof body.token !== "string" ||
        !body.token
      ) {
        throw new Error("Development sign-in unavailable");
      }
      // Ordinary auth transitions preserve the existing per-account draft keys.
      if (isAuthenticated) await signOut();
      await signIn("dev-impersonation", { token: body.token });
      onSignedIn?.();
    } catch {
      setError(t("devAuth.signInFailed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section
      aria-label={t("devAuth.title")}
      aria-busy={busy}
      className="min-w-0 space-y-2 rounded-lg border border-dashed border-primary/40 bg-primary/5 p-3"
    >
      <h2 className="text-sm font-semibold">{t("devAuth.title")}</h2>
      <p className="text-xs text-muted-foreground">
        {t("devAuth.description")}
      </p>
      <Button
        variant="outline"
        size="sm"
        className="h-auto min-h-9 w-full whitespace-normal"
        disabled={busy || isLoading}
        onClick={() => void createTestCoaches()}
      >
        {t("devAuth.createTestCoaches")}
      </Button>
      {testCoaches.map((user) => (
        <Button
          key={user.id}
          variant="outline"
          size="sm"
          className="h-auto min-h-9 w-full whitespace-normal"
          disabled={busy || isLoading || user.id === currentUserId}
          onClick={() => void login(user.id)}
        >
          {user.name}
          {user.id === currentUserId ? ` · ${t("devAuth.current")}` : ""}
        </Button>
      ))}
      <label htmlFor={selectId} className="block text-xs font-medium">
        {t("devAuth.user")}
        <EditorSelect
          id={selectId}
          value={selected}
          disabled={busy || isLoading || !choices.length}
          onChange={(event) => setSelectedId(event.target.value as Id<"users">)}
        >
          {!choices.length ? (
            <option value="">{t("devAuth.noUsers")}</option>
          ) : null}
          {choices.map((user) => (
            <option key={user.id} value={user.id}>
              {user.name}
              {user.id === currentUserId ? ` · ${t("devAuth.current")}` : ""}
            </option>
          ))}
        </EditorSelect>
      </label>
      {status === "CanLoadMore" || status === "LoadingMore" ? (
        <Button
          variant="ghost"
          size="sm"
          className="w-full"
          disabled={busy || status === "LoadingMore"}
          onClick={() => loadMore(30)}
        >
          {t("devAuth.loadMore")}
        </Button>
      ) : null}
      <Button
        size="sm"
        className="w-full"
        disabled={busy || isLoading || !selected || selected === currentUserId}
        onClick={() => selected && void login(selected)}
      >
        {t(busy ? "devAuth.working" : "devAuth.signIn")}
      </Button>
      {error ? (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      ) : null}
    </section>
  );
}
