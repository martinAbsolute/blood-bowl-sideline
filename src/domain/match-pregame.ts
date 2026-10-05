/** Season 3 standard Weather table: the combined result of both coaches' D6. */
export const WEATHER_RESULTS = [
  { value: 2, range: "2" },
  { value: 3, range: "3" },
  { value: 4, range: "4–10" },
  { value: 11, range: "11" },
  { value: 12, range: "12" },
] as const;

export function weatherResult(roll?: number | null) {
  if (roll == null || !Number.isInteger(roll) || roll < 2 || roll > 12)
    return null;
  return roll >= 4 && roll <= 10 ? 4 : roll;
}

export function isPreGameComplete(match: {
  weather?: number | null;
  homeFanRoll: number | null;
  awayFanRoll: number | null;
}) {
  return (
    weatherResult(match.weather) !== null &&
    [match.homeFanRoll, match.awayFanRoll].every(
      (roll) =>
        roll != null && Number.isInteger(roll) && roll >= 1 && roll <= 3,
    )
  );
}
