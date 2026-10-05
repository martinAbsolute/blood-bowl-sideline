import randomName from "@scaleway/random-name";

/** Proof-of-concept name source; replace this helper to change the generator. */
export function generatePlayerName(): string {
  return randomName("", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}
