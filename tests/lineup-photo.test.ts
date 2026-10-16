import { expect, it } from "vitest";
import { lineupPhoto } from "../src/lib/lineup-photo";

it.each(Array.from({ length: 16 }, (_, index) => index + 1))(
  "keeps player one centred in front for a %i-player squad, in at most two rows",
  (count) => {
    const slots = lineupPhoto(count);
    expect(slots).toHaveLength(count);
    expect(slots[0].offset).toBe(0);
    expect(slots[0].row).toBe("front");
    expect(slots[0].top).toBe(Math.max(...slots.map((slot) => slot.top)));
    expect(slots[0].zIndex).toBe(Math.max(...slots.map((slot) => slot.zIndex)));
    expect(new Set(slots.map((slot) => slot.top)).size).toBeLessThanOrEqual(2);
    expect(
      new Set(slots.map((slot) => `${slot.row}:${slot.offset}`)).size,
    ).toBe(count);
    for (const row of ["front", "back"]) {
      const members = slots.filter((slot) => slot.row === row);
      expect(members.reduce((sum, slot) => sum + slot.offset, 0)).toBe(0);
    }
    for (const slot of slots) {
      expect(Math.abs(slot.offset) * 34 + 18).toBeLessThanOrEqual(
        slot.width / 2,
      );
      if (slot.row === "back")
        expect(slot.zIndex).toBeLessThan(slots[0].zIndex);
    }
  },
);

it("leaves an empty squad empty", () => {
  expect(lineupPhoto(0)).toEqual([]);
});
