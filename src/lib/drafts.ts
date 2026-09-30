import { teamSchema, type Team } from "@/domain/types";
import { z } from "zod";
// Preserve work even while the coach has cleared the team name. Account saves
// still use the stricter shared server validator.
const localDraftSchema = teamSchema.extend({
  name: z.string().max(80),
  coach: z.string().max(80),
  players: z
    .array(
      teamSchema.shape.players.element.extend({ name: z.string().max(80) }),
    )
    .max(16),
});
export const DRAFTS_KEY = "bbsideline:drafts:v1";
const KEY = DRAFTS_KEY;
const accountKey = (uuid: string) => `bbsideline:draft-account:${uuid}`;
export function draftAccount(uuid: string): string | null {
  try {
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
export function readRevision(uuid: string) {
  try {
    return Number(localStorage.getItem(`bbsideline:revision:${uuid}`)) || 0;
  } catch {
    return 0;
  }
}
export function storeRevision(uuid: string, revision: number) {
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
export function storeDraft(team: Team, account?: string | null) {
  const all = readDrafts(),
    index = all.findIndex((t) => t.uuid === team.uuid);
  if (index < 0) all.unshift(team);
  else all[index] = team;
  localStorage.setItem(KEY, JSON.stringify(all));
  if (account) localStorage.setItem(accountKey(team.uuid), account);
  localStorage.setItem(ACTIVE, team.uuid);
  window.dispatchEvent(new Event("bbs-drafts-changed"));
}
export function removeDraft(uuid: string) {
  localStorage.setItem(
    KEY,
    JSON.stringify(readDrafts().filter((t) => t.uuid !== uuid)),
  );
  if (localStorage.getItem(ACTIVE) === uuid) localStorage.removeItem(ACTIVE);
  localStorage.removeItem(accountKey(uuid));
  window.dispatchEvent(new Event("bbs-drafts-changed"));
}
export function acknowledgeDraft(team: Team, revision: number) {
  storeRevision(team.uuid, revision);
  const local = readDrafts().find((draft) => draft.uuid === team.uuid);
  // A response must never discard edits made while the request was in flight.
  if (local && JSON.stringify(local) === JSON.stringify(team))
    removeDraft(team.uuid);
}
export function exportTeam(team: Team) {
  const blob = new Blob([JSON.stringify(team, null, 2)], {
      type: "application/json",
    }),
    url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${team.name.replace(/[^\p{L}\p{N} -]/gu, "").slice(0, 60) || "team"}.json`;
  a.click();
  URL.revokeObjectURL(url);
}
