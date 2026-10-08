// Editors can coexist, but a background uploader must not race any open editor.
// Web Locks are origin-scoped and released automatically when a tab closes.
export const DRAFT_EDITOR_RELEASED = "bbsideline:editor-released";
const lockName = (uuid: string) => `bbsideline:editor:${uuid}`;

// Wait for another tab's background upload before changing draft metadata.
// A shared editor lock then prevents it from deleting that metadata mid-change.
export async function withDraftPreferenceLock(
  uuid: string,
  update: () => Promise<void>,
) {
  if (!navigator.locks) return update();
  return navigator.locks.request(lockName(uuid), { mode: "shared" }, update);
}

export function holdDraftEditor(uuid: string) {
  let release = () => {};
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  void navigator.locks
    ?.request(lockName(uuid), { mode: "shared" }, () => held)
    .catch(() => {});
  return () => {
    release();
    try {
      localStorage.setItem(DRAFT_EDITOR_RELEASED, crypto.randomUUID());
    } catch {
      /* The local provider also wakes on editor release. */
    }
  };
}

export async function uploadWithoutEditor(
  uuid: string,
  upload: () => Promise<void>,
) {
  if (!navigator.locks) {
    await upload();
    return true;
  }
  return navigator.locks.request(
    lockName(uuid),
    { ifAvailable: true },
    async (lock) => {
      if (!lock) return false;
      await upload();
      return true;
    },
  );
}
