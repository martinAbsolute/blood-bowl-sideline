"use client";

export const positionLabel = (position: string) =>
  position.replace(/\s*\([^()]+\)$/, "");

export function PositionName({ position }: { position: string }) {
  return <span>{positionLabel(position)}</span>;
}
