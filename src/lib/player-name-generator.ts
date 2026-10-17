import randomName from "@scaleway/random-name";

export function generatePlayerName(): string {
  return randomName("", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}
