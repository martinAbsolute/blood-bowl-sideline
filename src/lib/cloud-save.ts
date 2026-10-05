import type { Team } from "@/domain/types";
import { acknowledgeDraft, readRevision } from "./drafts";

type Result = { revision: number };
type Save = (args: { team: Team; expectedRevision: number }) => Promise<Result>;
const pending = new Map<
  string,
  { snapshot: string; promise: Promise<Result> }
>();

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
      expectedRevision: Math.max(
        expectedRevision,
        readRevision(team.uuid),
        acknowledged?.revision ?? 0,
      ),
    });
    acknowledgeDraft(team, result.revision);
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
