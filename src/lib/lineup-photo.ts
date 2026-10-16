/** A symmetric front row led by player #1, with the rest behind it. */
export function lineupPhoto(count: number) {
  if (count < 1) return [];
  const half = Math.floor(count / 2);
  const frontCount = half % 2 === 0 ? half + 1 : half;
  const backCount = count - frontCount;
  const columns = Math.max(frontCount, backCount);
  return Array.from({ length: count }, (_, index) => {
    const front = index < frontCount;
    const position = front ? index : index - frontCount;
    // Center out: 0, -1, +1, -2, +2 (half steps for an even back row).
    const offset =
      front || backCount % 2 === 1
        ? position === 0
          ? 0
          : Math.ceil(position / 2) * (position % 2 ? -1 : 1)
        : (Math.floor(position / 2) + 0.5) * (position % 2 ? 1 : -1);
    return {
      row: front ? "front" : "back",
      offset,
      width: 36 + (columns - 1) * 34,
      left: `calc(50% - 18px + (100% - 36px) * ${offset / Math.max(1, columns - 1)})`,
      top: front ? 26 : 0,
      zIndex: (front ? 100 : 50) - position,
    };
  });
}
