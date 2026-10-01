export function sortUsers<
  T extends {
    id: string;
    online: boolean;
    lastSeenAt: number | null;
    joinedAt: number;
  },
>(users: T[]): T[] {
  return users.toSorted(
    (a, b) =>
      Number(b.online) - Number(a.online) ||
      (b.lastSeenAt ?? b.joinedAt) - (a.lastSeenAt ?? a.joinedAt) ||
      a.id.localeCompare(b.id),
  );
}
