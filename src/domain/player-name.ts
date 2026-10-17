/** Limit new edits without rejecting older saved names (up to 80 characters). */
export const PLAYER_NAME_MAX_LENGTH = 40;

export function hasPlayerName(name: string, designation: string) {
  return !!name.trim() && name.trim() !== designation;
}
