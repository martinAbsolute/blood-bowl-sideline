import { expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { newTeam } from "../src/domain/catalog";
import { api } from "../convex/_generated/api";
import { optimisticallySaveTeam } from "../src/lib/use-team-save";

it("previews team edits without mutating cached data or inventing revisions and ownership", () => {
  const team = newTeam(randomUUID());
  const current = Object.freeze({
    team,
    revision: 7,
    updatedAt: 123,
    legal: false,
    canEdit: true,
  });
  const store = {
    getQuery: vi.fn(() => current),
    setQuery: vi.fn(),
    getAllQueries: vi.fn(() => []),
  };
  const edited = { ...team, name: "Immediate edit" };
  optimisticallySaveTeam(store, { team: edited });
  expect(store.setQuery).toHaveBeenCalledExactlyOnceWith(
    api.teams.getByUuid,
    { uuid: team.uuid },
    { ...current, team: edited },
  );
  expect(current.team).toBe(team);
  expect(current.team.name).not.toBe(edited.name);
});

it("never turns an unloaded, missing, or public team into an owned optimistic team", () => {
  const team = newTeam(randomUUID());
  for (const current of [
    undefined,
    null,
    { team, revision: 1, updatedAt: 1, legal: false, canEdit: false },
  ]) {
    const store = {
      getQuery: vi.fn(() => current),
      setQuery: vi.fn(),
      getAllQueries: vi.fn(() => []),
    };
    optimisticallySaveTeam(store, { team });
    expect(store.setQuery).not.toHaveBeenCalled();
  }
});
