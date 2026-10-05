import type { Team } from "@/domain/types";
import { acknowledgeDraft } from "./drafts";

type Result = { revision: number };
type Save = (args: { team: Team; expectedRevision: number }) => Promise<Result>;
const pending = new Map<
  string,
  { snapshot: string; promise: Promise<Result> }
>();

export async function waitForTeamSave(uuid: string) {
  await pending.get(uuid)?.promise.catch(() => null);
}

// The library uploader and editor share a queue, including across navigation.
export function saveCloudDraft(
  team: Team,
  expectedRevision: number,
  save: Save,
): Promise<Result> {
  const snapshot = JSON.stringify(team);
  const previous = pending.get(team.uuid);
  if (previous?.snapshot === snapshot) return previous.promise;
  const promise = (async () => {
    const acknowledged = previous
      ? await previous.promise.catch(() => null)
      : null;
    const result = await save({
      team,
      expectedRevision: Math.max(expectedRevision, acknowledged?.revision ?? 0),
    });
    // Cleanup is best effort. A quota/privacy error after the server commits
    // must not turn a successful cloud save into a failed save/retry loop.
    try {
      acknowledgeDraft(team, result.revision);
    } catch {
      /* Cloud is saved. */
    }
    return result;
  })();
  const entry = { snapshot, promise };
  pending.set(team.uuid, entry);
  void promise
    .finally(() => {
      if (pending.get(team.uuid) === entry) pending.delete(team.uuid);
    })
    .catch(() => {});
  return promise;
}
