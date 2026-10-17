import { expect, it } from "vitest";
import { newTeam } from "../src/domain/catalog";
import { teamSchema } from "../src/domain/types";
import { numberedPlayers, nextPlayerNumber } from "../src/domain/player-number";
import { duplicateTeam } from "../src/lib/duplicate-team";

it("preserves numbers through sorting, removal, recruitment, and duplication", () => {
  const team = newTeam(crypto.randomUUID(), "human");
  team.players = Array.from({ length: 3 }, () => ({
    id: crypto.randomUUID(),
    positionId: "human-0",
    name: "",
    skills: [],
  }));
  const players = numberedPlayers(team.players);
  const changed = numberedPlayers(players.map((player, index) => (index === 0 ? { ...player, number: "9" } : player)));
  expect(changed.map((player) => player.number)).toEqual(["02", "03", "9"]);
  const remaining = changed.filter((player) => player.number !== "02");
  expect(numberedPlayers(remaining).map((player) => player.number)).toEqual(["03", "9"]);
  expect(nextPlayerNumber(remaining)).toBe("01");
  const saved = teamSchema.parse({ ...team, players: remaining });
  expect(duplicateTeam(saved, "Copy").players.map((player) => player.number)).toEqual(["03", "9"]);
});

it("rejects numerically equivalent player numbers in saved or imported teams", () => {
  const team = newTeam(crypto.randomUUID(), "human");
  team.players = ["7", "07"].map((number) => ({
    id: crypto.randomUUID(),
    positionId: "human-0",
    name: "",
    skills: [],
    number,
  }));
  expect(teamSchema.safeParse(team).success).toBe(false);
  team.players[1].number = "08";
  expect(teamSchema.parse(team).players.map((player) => player.number)).toEqual(["7", "08"]);
});
