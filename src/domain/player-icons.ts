import iconData from "./data/player-icons.json";

export interface PlayerArtwork {
  label: string;
  group: string;
  width: number;
  height: number;
  variants: string[];
}

// Direct catalog IDs keep artwork independent of position order and spelling.
// Source labels, pages, originals, and lossless crops live in the asset manifest.
const positions: Record<string, PlayerArtwork> = iconData.positions;
const stars: Record<string, PlayerArtwork> = iconData.stars;
const representatives: Record<string, string> = iconData.rosters;

export function getPositionArtwork(positionId: string) {
  return positions[positionId];
}

export function getRosterArtwork(rosterId: string) {
  return positions[representatives[rosterId]];
}

export function getStarArtwork(starId: string) {
  return stars[starId];
}
