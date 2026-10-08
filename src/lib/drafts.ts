import { teamSchema, type Team } from "@/domain/types";
import { z } from "zod";
import { TEAM_NAME_MAX_LENGTH } from "@/domain/team-name";
// Preserve recovery snapshots while team names are being edited. Account saves
// still use the stricter shared server validator.
const localDraftSchema = teamSchema
  .extend({
    name: z.string().max(TEAM_NAME_MAX_LENGTH),
    players: z
      .array(
        teamSchema.shape.players.element.extend({ name: z.string().max(80) }),
      )
      .max(16),
  })
  .strip();
export const DRAFTS_KEY = "bbsideline:drafts:v1";
const KEY = DRAFTS_KEY;
const accountKey = (uuid: string) => `bbsideline:draft-account:${uuid}`;
const storedDraftSchema = localDraftSchema.extend({
  favorite: z.boolean().optional(),
  baseRevision: z.number().int().nonnegative().optional(),
  draftOwner: z.string().nullable().optional(),
});
function storedDrafts() {
  try {
    const data: unknown = JSON.parse(draftSnapshot());
    return Array.isArray(data)
      ? data.flatMap((entry) => {
          const parsed = storedDraftSchema.safeParse(entry);
          return parsed.success ? [parsed.data] : [];
        })
      : [];
  } catch {
    return [];
  }
}
export function draftAccount(uuid: string): string | null {
  try {
    const entry = storedDrafts().find((draft) => draft.uuid === uuid);
    if (entry?.draftOwner !== undefined) return entry.draftOwner;
    return localStorage.getItem(accountKey(uuid));
  } catch {
    return null;
  }
}
export function subscribeDrafts(cb: () => void) {
  window.addEventListener("bbs-drafts-changed", cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener("bbs-drafts-changed", cb);
    window.removeEventListener("storage", cb);
  };
}
export function draftSnapshot() {
  try {
    return localStorage.getItem(KEY) ?? "[]";
  } catch {
    return "[]";
  }
}
export const ACTIVE = "bbsideline:active-draft";
export function parseDrafts(raw: string): Team[] {
  try {
    const data: unknown = JSON.parse(raw);
    return Array.isArray(data)
      ? data.flatMap((t) => {
          const parsed = localDraftSchema.safeParse(t);
          return parsed.success ? [parsed.data] : [];
        })
      : [];
  } catch {
    return [];
  }
}
// Keep only the current model on the device; obsolete fields must not stay
// hidden in local recovery data after they have been removed from teams.
export function normalizeStoredDrafts() {
  const raw = draftSnapshot();
  const normalized = JSON.stringify(
    parseDrafts(raw).map((team) => ({
      ...team,
      baseRevision: readDraftRevision(team.uuid),
      draftOwner: draftAccount(team.uuid),
      favorite: readDraftFavorite(team.uuid),
    })),
  );
  if (raw !== normalized) {
    localStorage.setItem(KEY, normalized);
    window.dispatchEvent(new Event("bbs-drafts-changed"));
  }
}
// The revision belongs to this snapshot, never to the browser's newest save.
// Legacy recovery data has no trustworthy base: revision zero safely conflicts
// with an existing team instead of silently overwriting it.
export function readDraftRevision(uuid: string): number {
  try {
    return (
      storedDrafts().find((entry) => entry.uuid === uuid)?.baseRevision ?? 0
    );
  } catch {
    return 0;
  }
}
export function readRevision(uuid: string) {
  try {
    return Number(localStorage.getItem(`bbsideline:revision:${uuid}`)) || 0;
  } catch {
    return 0;
  }
}
export function storeRevision(uuid: string, revision: number) {
  // An editor mounted before an upload completed may still hold an old value.
  // Never let its next edit roll back the acknowledged server revision.
  if (!Number.isSafeInteger(revision) || revision < readRevision(uuid)) return;
  try {
    localStorage.setItem(`bbsideline:revision:${uuid}`, String(revision));
  } catch {
    /* The saved team remains available from the account library. */
  }
}
export function readDrafts(): Team[] {
  try {
    return parseDrafts(localStorage.getItem(KEY) ?? "[]");
  } catch {
    return [];
  }
}
export function readDraftFavorite(uuid: string): boolean | undefined {
  return storedDrafts().find((draft) => draft.uuid === uuid)?.favorite;
}
export function setDraftFavorite(uuid: string, favorite: boolean) {
  const all = storedDrafts();
  const draft = all.find((entry) => entry.uuid === uuid);
  if (!draft) return false;
  draft.favorite = favorite;
  localStorage.setItem(KEY, JSON.stringify(all));
  window.dispatchEvent(new Event("bbs-drafts-changed"));
  return true;
}
export function storeDraft(
  team: Team,
  account?: string | null,
  revision = readDraftRevision(team.uuid),
) {
  const all = storedDrafts(),
    index = all.findIndex((t) => t.uuid === team.uuid);
  // Ownership and base revision commit atomically with the snapshot.
  const snapshot = {
    ...team,
    baseRevision: revision,
    draftOwner: account ?? draftAccount(team.uuid),
    favorite: index < 0 ? undefined : all[index].favorite,
  };
  if (index < 0) all.unshift(snapshot);
  else all[index] = snapshot;
  localStorage.setItem(KEY, JSON.stringify(all));
  try {
    localStorage.setItem(ACTIVE, team.uuid);
  } catch {
    /* The draft itself is already persisted. */
  }
  window.dispatchEvent(new Event("bbs-drafts-changed"));
}
export function removeDraft(uuid: string) {
  localStorage.setItem(
    KEY,
    JSON.stringify(storedDrafts().filter((t) => t.uuid !== uuid)),
  );
  try {
    if (localStorage.getItem(ACTIVE) === uuid) localStorage.removeItem(ACTIVE);
    localStorage.removeItem(accountKey(uuid));
  } catch {
    /* Obsolete metadata cannot prevent discarding a recovery draft. */
  }
  window.dispatchEvent(new Event("bbs-drafts-changed"));
}
export function acknowledgeDraft(team: Team, revision: number) {
  storeRevision(team.uuid, revision);
  const local = readDrafts().find((draft) => draft.uuid === team.uuid);
  // A response must never discard edits made while the request was in flight.
  // Parsing restores schema field order; object insertion order is not an edit.
  if (
    local &&
    JSON.stringify(local) === JSON.stringify(localDraftSchema.parse(team))
  )
    removeDraft(team.uuid);
}
