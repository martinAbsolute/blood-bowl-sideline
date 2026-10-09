// @vitest-environment happy-dom
import { randomUUID } from "node:crypto";
import { beforeEach, expect, it } from "vitest";
import { newTeam } from "../src/domain/catalog";
import {
  PREVIOUS_RULES_VERSION,
  RULES_VERSION,
  teamSchema,
} from "../src/domain/types";
import {
  DRAFTS_KEY,
  draftAccount,
  normalizeStoredDrafts,
  parseDrafts,
  readDraftFavorite,
  readDraftRevision,
  readDrafts,
  storeDraft,
} from "../src/lib/drafts";

beforeEach(() => localStorage.clear());

it("upgrades the known previous draft snapshot without losing edits or save metadata", () => {
  const team = newTeam(randomUUID());
  team.rulesVersion = PREVIOUS_RULES_VERSION;
  team.name = "  "; // Unfinished names must remain recoverable too.
  team.players = [
    {
      id: randomUUID(),
      positionId: "human-0",
      name: "  Coach's player  ",
      skills: ["bullseye"],
    },
  ];
  const stored = {
    ...team,
    draftOwner: "coach-account",
    baseRevision: 7,
    favorite: true,
  };
  localStorage.setItem(DRAFTS_KEY, JSON.stringify([stored]));
  normalizeStoredDrafts();
  expect(readDrafts()).toEqual([{ ...team, rulesVersion: RULES_VERSION }]);
  expect(draftAccount(team.uuid)).toBe("coach-account");
  expect(readDraftRevision(team.uuid)).toBe(7);
  expect(readDraftFavorite(team.uuid)).toBe(true);
  expect(JSON.parse(localStorage.getItem(DRAFTS_KEY)!)).toEqual([
    { ...stored, rulesVersion: RULES_VERSION },
  ]);
  normalizeStoredDrafts();
  expect(readDrafts()).toHaveLength(1);
});

it("keeps legacy recovery drafts when another draft is saved", () => {
  const previous = {
    ...newTeam(randomUUID()),
    rulesVersion: PREVIOUS_RULES_VERSION,
  };
  localStorage.setItem(
    DRAFTS_KEY,
    JSON.stringify([
      { ...previous, baseRevision: 3, draftOwner: "coach-account" },
    ]),
  );
  const next = newTeam(randomUUID());
  storeDraft(next);
  expect(readDrafts().map((team) => team.uuid)).toEqual([
    next.uuid,
    previous.uuid,
  ]);
  expect(readDraftRevision(previous.uuid)).toBe(3);
  expect(
    readDrafts().every((team) => team.rulesVersion === RULES_VERSION),
  ).toBe(true);
});

it("accepts only the explicitly compatible version, never arbitrary past or future formats", () => {
  const team = newTeam(randomUUID());
  expect(
    teamSchema.safeParse({ ...team, rulesVersion: PREVIOUS_RULES_VERSION })
      .success,
  ).toBe(true);
  for (const rulesVersion of ["old", "bb2025-2099-01-01"])
    expect(parseDrafts(JSON.stringify([{ ...team, rulesVersion }]))).toEqual(
      [],
    );
});
