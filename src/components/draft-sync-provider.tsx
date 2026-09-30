"use client";
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import {
  draftAccount,
  draftSnapshot,
  parseDrafts,
  readRevision,
  storeDraft,
  subscribeDrafts,
} from "@/lib/drafts";
import { saveCloudDraft } from "@/lib/cloud-save";
import { finishDraftSignIn } from "@/lib/draft-sign-in";

type Sync = {
  account: string | null;
  coachName?: string;
  ready: boolean;
  editing: (uuid: string) => () => void;
  failed: ReadonlySet<string>;
  retry: () => void;
};
const Context = createContext<Sync | null>(null);
const fallback: Sync = {
  account: null,
  ready: true,
  editing: () => () => {},
  failed: new Set(),
  retry: () => {},
};
export function useDraftSync() {
  return useContext(Context) ?? fallback;
}

export function DraftSyncProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useConvexAuth();
  const viewer = useQuery(api.teams.viewer, isAuthenticated ? {} : "skip");
  const account = viewer?.id ?? null;
  const save = useMutation(api.teams.save);
  const raw = useSyncExternalStore(subscribeDrafts, draftSnapshot, () => "[]");
  const active = useRef(new Set<string>());
  const inFlight = useRef(false);
  const failures = useRef(new Map<string, string>());
  const [epoch, wake] = useState(0);
  const [failed, setFailed] = useState<ReadonlySet<string>>(new Set());
  const controls = useMemo(
    () => ({
      editing(uuid: string) {
        active.current.add(uuid);
        return () => {
          active.current.delete(uuid);
          queueMicrotask(() => wake((n) => n + 1));
        };
      },
      retry() {
        failures.current.clear();
        setFailed(new Set());
        wake((n) => n + 1);
      },
    }),
    [],
  );
  useEffect(() => {
    window.addEventListener("online", controls.retry);
    return () => window.removeEventListener("online", controls.retry);
  }, [controls]);
  useEffect(() => {
    if (!account || inFlight.current) return;
    const team = parseDrafts(raw).find((draft) => {
      const owner = draftAccount(draft.uuid);
      return (
        (!owner || owner === account) &&
        !active.current.has(draft.uuid) &&
        !!draft.name.trim() &&
        failures.current.get(draft.uuid) !== JSON.stringify(draft)
      );
    });
    if (!team) return;
    // Wait a frame so the mounted editor can reserve its own autosave queue.
    const timer = window.setTimeout(() => {
      if (active.current.has(team.uuid) || inFlight.current) return;
      inFlight.current = true;
      void (async () => {
        try {
          storeDraft(team, account);
          await saveCloudDraft(team, readRevision(team.uuid), save);
          finishDraftSignIn(team.uuid);
          failures.current.delete(team.uuid);
        } catch {
          failures.current.set(team.uuid, JSON.stringify(team));
        } finally {
          inFlight.current = false;
          setFailed(new Set(failures.current.keys()));
          wake((n) => n + 1);
        }
      })();
    }, 50);
    return () => window.clearTimeout(timer);
  }, [account, raw, save, epoch]);
  return (
    <Context.Provider
      value={{
        account,
        coachName: viewer?.name,
        ready: !isAuthenticated || viewer !== undefined,
        failed,
        ...controls,
      }}
    >
      {children}
    </Context.Provider>
  );
}
