"use client";

import usePresence from "@convex-dev/presence/react";
import { api } from "../../convex/_generated/api";

export function UserPresence({ userId }: { userId: string }) {
  usePresence(api.presence, "sideline", userId, 30_000);
  return null;
}
