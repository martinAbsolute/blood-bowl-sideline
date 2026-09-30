import { z } from "zod";
import type { Team } from "@/domain/types";
import { storeDraft } from "./drafts";

export const PENDING_SAVE = "bbsideline:pending-login-save:v1";
const pendingSchema = z.object({
  uuid: z.uuid(),
  revision: z.number().int().nonnegative(),
});

export function prepareDraftSignIn(team: Team, revision: number) {
  // Both writes must succeed before navigation; otherwise stay in the editor.
  storeDraft(team);
  sessionStorage.setItem(
    PENDING_SAVE,
    JSON.stringify({ uuid: team.uuid, revision }),
  );
  return `/builder?draft=${team.uuid}`;
}

export function pendingDraftSave(uuid: string) {
  try {
    const parsed = pendingSchema.safeParse(
      JSON.parse(sessionStorage.getItem(PENDING_SAVE) ?? "null"),
    );
    return parsed.success && parsed.data.uuid === uuid ? parsed.data : null;
  } catch {
    return null;
  }
}

export function finishDraftSignIn(uuid: string) {
  if (pendingDraftSave(uuid)) sessionStorage.removeItem(PENDING_SAVE);
}

export function signInReturnPath(
  location: Pick<Location, "pathname" | "search" | "hash">,
) {
  const params = new URLSearchParams(location.search);
  params.delete("code");
  const search = params.toString();
  return `${location.pathname}${search ? `?${search}` : ""}${location.hash}`;
}
