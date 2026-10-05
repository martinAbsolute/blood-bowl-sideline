import { describe, expect, it } from "vitest";
import { calculateSpp, emptyPlayerStats } from "../src/domain/league-rules";
import {
  newMatchEvent,
  projectMatchEvents,
  sortMatchEvents,
  type MatchEvent,
} from "../src/domain/match-events";

const players = ["passer", "receiver", "victim"].map((playerId, index) => ({
  playerId,
  entryId: index === 2 ? "away" : "home",
  participated: true,
  stats: emptyPlayerStats(),
  statusAfter: "active" as const,
  casualtyRoll: null,
  lastingRoll: null,
  injuryNotes: "",
}));
const event = (patch: Partial<MatchEvent> = {}): MatchEvent => ({
  ...newMatchEvent("passer"),
  id: "event",
  ...patch,
});

describe("match event projection", () => {
  it("credits the passer, interceptor and both participants in a Superb Throw", () => {
    const result = projectMatchEvents(
      players,
      [
        event({ id: "pass", kind: "completion", targetId: "receiver" }),
        event({ id: "int", kind: "interception", targetId: "victim" }),
        event({
          id: "throw",
          kind: "throw-team-mate",
          targetId: "receiver",
          superb: true,
        }),
      ],
      "home",
    );
    expect(calculateSpp("human", result.players[0].stats)).toBe(4);
    expect(calculateSpp("human", result.players[1].stats)).toBe(1);
    expect(result.scoreHome).toBe(0);
  });
  it("keeps block SPP after an Apothecary turns death into a recovery", () => {
    const result = projectMatchEvents(
      players,
      [
        event({
          kind: "casualty",
          targetId: "victim",
          casualtyRoll: 16,
          apothecary: true,
          apothecaryRoll: 3,
        }),
      ],
      "home",
    );
    expect(result.players[0].stats).toMatchObject({ cas: 1, sppCas: 1 });
    expect(result.players[2]).toMatchObject({
      statusAfter: "active",
      casualtyRoll: null,
      stats: { inj: 1, dth: 0 },
    });
  });
  it("respects the coach's original choice and failed Regeneration", () => {
    const result = projectMatchEvents(
      players,
      [
        event({
          kind: "casualty",
          targetId: "victim",
          casualtyRoll: 13,
          lastingRoll: 3,
          apothecary: true,
          apothecaryRoll: 16,
          keepOriginal: true,
          regeneration: "failed",
        }),
      ],
      "home",
    );
    expect(result.players[2]).toMatchObject({
      statusAfter: "missing-next-game",
      casualtyRoll: 13,
      lastingRoll: 3,
    });
  });
  it("allows another casualty after Regeneration, but no second unrecovered casualty", () => {
    const first = event({
      kind: "casualty",
      targetId: "victim",
      casualtyRoll: 16,
      regeneration: "succeeded",
    });
    const second = event({ ...first, id: "second", regeneration: "not-used" });
    expect(
      projectMatchEvents(players, [first, second], "home").players[2].stats,
    ).toMatchObject({ inj: 2, dth: 1 });
    expect(() =>
      projectMatchEvents(
        players,
        [{ ...first, regeneration: "not-used" }, second],
        "home",
      ),
    ).toThrow("EVENT_DUPLICATE_INJURY");
  });
  it("records crowd and foul casualties without awarding SPP; removals do not imply injuries", () => {
    const result = projectMatchEvents(
      players,
      [
        event({
          id: "foul",
          kind: "casualty",
          cause: "foul",
          targetId: "victim",
          casualtyRoll: 16,
        }),
        event({
          id: "crowd",
          playerId: "receiver",
          kind: "casualty",
          cause: "crowd",
          casualtyRoll: 10,
        }),
        event({ id: "ko", kind: "knockout" }),
        event({ id: "off", kind: "sent-off" }),
      ],
      "home",
    );
    expect(result.players[0].stats).toMatchObject({
      cas: 1,
      sppCas: 0,
      inj: 0,
      sof: 1,
    });
    expect(result.players[1].statusAfter).toBe("missing-next-game");
    expect(calculateSpp("human", result.players[0].stats)).toBe(0);
  });
  it("rejects invalid relationships, missing lasting injury rolls and duplicate MVPs", () => {
    expect(() =>
      projectMatchEvents(
        players,
        [event({ kind: "completion", targetId: "victim" })],
        "home",
      ),
    ).toThrow("EVENT_TEAM_MISMATCH");
    expect(() =>
      projectMatchEvents(players, [event({ kind: "interception" })], "home"),
    ).toThrow("EVENT_TARGET_REQUIRED");
    expect(() =>
      projectMatchEvents(
        players,
        [event({ kind: "casualty", targetId: "victim", casualtyRoll: 14 })],
        "home",
      ),
    ).toThrow();
    expect(() =>
      projectMatchEvents(
        players,
        [
          event({ kind: "mvp" }),
          event({ id: "second", kind: "mvp", playerId: "receiver" }),
        ],
        "home",
      ),
    ).toThrow("ONE_MVP_PER_TEAM_REQUIRED");
  });
  it("sorts late entries by half and turn, preserving untimed order and ending with MVP", () => {
    const events = [
      event({ id: "mvp", kind: "mvp" }),
      event({ id: "untimed" }),
      event({ id: "second", half: 2, turn: 1 }),
      event({ id: "first", half: 1, turn: 8 }),
    ];
    expect(sortMatchEvents(events).map((row) => row.id)).toEqual([
      "first",
      "second",
      "untimed",
      "mvp",
    ]);
  });
  it("removing an event reverses its score and SPP effects", () => {
    const td = event();
    const rows = projectMatchEvents(players, [td], "home").players;
    expect(calculateSpp("human", rows[0].stats)).toBe(3);
    expect(projectMatchEvents(rows, [], "home")).toMatchObject({
      scoreHome: 0,
      players: [{ stats: { td: 0 } }, {}, {}],
    });
  });
});
