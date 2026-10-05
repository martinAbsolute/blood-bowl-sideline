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
import { useConvexAuth, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import {
  draftAccount,
  draftSnapshot,
  parseDrafts,
  normalizeStoredDrafts,
  readDraftRevision,
  storeDraft,
  subscribeDrafts,
  readDrafts,
} from "@/lib/drafts";
import {
  DRAFT_EDITOR_RELEASED,
  holdDraftEditor,
  uploadWithoutEditor,
} from "@/lib/draft-lock";
import { saveCloudDraft } from "@/lib/cloud-save";
import { useTeamSave } from "@/lib/use-team-save";
import { useBeforeUnload } from "@/lib/use-before-unload";
import { finishDraftSignIn } from "@/lib/draft-sign-in";
import type { Team } from "@/domain/types";

function recoveryVersion(team: Team) {
  return JSON.stringify([
    draftAccount(team.uuid),
    readDraftRevision(team.uuid),
    team,
  ]);
}

type Sync = {
  account: string | null;
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
  const { isAuthenticated, isLoading } = useConvexAuth();
  const viewer = useQuery(api.teams.viewer, isAuthenticated ? {} : "skip");
  const account = viewer?.id ?? null;
  const save = useTeamSave();
  const raw = useSyncExternalStore(subscribeDrafts, draftSnapshot, () => "[]");
  const [acknowledged, setAcknowledged] = useState<ReadonlyMap<string, string>>(
    new Map(),
  );
  // This provider outlives route changes, so queued recovery saves remain
  // protected even after the editor has unmounted.
  useBeforeUnload(
    !!account &&
      parseDrafts(raw).some((team) => {
        const owner = draftAccount(team.uuid);
        return (
          (!owner || owner === account) &&
          acknowledged.get(team.uuid) !== recoveryVersion(team)
        );
      }),
  );
  const active = useRef(new Set<string>());
  const inFlight = useRef(false);
  const failures = useRef(new Map<string, string>());
  const blocked = useRef(new Set<string>());
  const [epoch, wake] = useState(0);
  const [failed, setFailed] = useState<ReadonlySet<string>>(new Set());
  const controls = useMemo(
    () => ({
      editing(uuid: string) {
        active.current.add(uuid);
        const release = holdDraftEditor(uuid);
        return () => {
          release();
          active.current.delete(uuid);
          blocked.current.delete(uuid);
          queueMicrotask(() => wake((n) => n + 1));
        };
      },
      retry() {
        failures.current.clear();
        blocked.current.clear();
        setFailed(new Set());
        wake((n) => n + 1);
      },
    }),
    [],
  );
  useEffect(() => {
    try {
      normalizeStoredDrafts();
    } catch {
      // Browsers that block storage still allow the editor to work in memory.
    }
  }, []);
  useEffect(() => {
    window.addEventListener("online", controls.retry);
    return () => window.removeEventListener("online", controls.retry);
  }, [controls]);
  useEffect(() => {
    const resume = () => {
      blocked.current.clear();
      wake((n) => n + 1);
    };
    const released = (event: StorageEvent) => {
      if (event.key !== DRAFT_EDITOR_RELEASED) return;
      resume();
    };
    window.addEventListener("storage", released);
    window.addEventListener("focus", resume);
    return () => {
      window.removeEventListener("storage", released);
      window.removeEventListener("focus", resume);
    };
  }, []);
  useEffect(() => {
    if (!account || inFlight.current) return;
    const team = parseDrafts(raw).find((draft) => {
      const owner = draftAccount(draft.uuid);
      return (
        (!owner || owner === account) &&
        !active.current.has(draft.uuid) &&
        !blocked.current.has(draft.uuid) &&
        !!draft.name.trim() &&
        acknowledged.get(draft.uuid) !== recoveryVersion(draft) &&
        failures.current.get(draft.uuid) !== recoveryVersion(draft)
      );
    });
    if (!team) return;
    // Wait a frame so the mounted editor can reserve its own autosave queue.
    const timer = window.setTimeout(() => {
      if (active.current.has(team.uuid) || inFlight.current) return;
      inFlight.current = true;
      void (async () => {
        try {
          const uploaded = await uploadWithoutEditor(team.uuid, async () => {
            // A tab may discard or edit the draft before the lock is granted.
            const current = readDrafts().find(
              (draft) => draft.uuid === team.uuid,
            );
            if (!current || JSON.stringify(current) !== JSON.stringify(team))
              return;
            const owner = draftAccount(team.uuid);
            if (owner && owner !== account) return;
            const revision = readDraftRevision(team.uuid);
            storeDraft(team, account, revision);
            const version = recoveryVersion(team);
            await saveCloudDraft(team, revision, save);
            setAcknowledged((previous) =>
              new Map(previous).set(team.uuid, version),
            );
            finishDraftSignIn(team.uuid);
            failures.current.delete(team.uuid);
          });
          if (!uploaded) blocked.current.add(team.uuid);
        } catch {
          failures.current.set(team.uuid, recoveryVersion(team));
        } finally {
          inFlight.current = false;
          setFailed(new Set(failures.current.keys()));
          wake((n) => n + 1);
        }
      })();
    }, 50);
    return () => window.clearTimeout(timer);
  }, [account, raw, save, epoch, acknowledged]);
  return (
    <Context.Provider
      value={{
        account,
        ready: !isLoading && (!isAuthenticated || viewer !== undefined),
        failed,
        ...controls,
      }}
    >
      {children}
    </Context.Provider>
  );
}
