import { Presence } from "@convex-dev/presence";
import { ConvexError, v } from "convex/values";
import { components } from "./_generated/api";
import { mutation, query } from "./_generated/server";
import { currentUser, requireUser } from "./roles";

export const ROOM_ID = "sideline";
export const presence = new Presence(components.presence);

export const heartbeat = mutation({
  args: {
    roomId: v.string(),
    userId: v.string(),
    sessionId: v.string(),
    interval: v.number(),
  },
  returns: v.object({ roomToken: v.string(), sessionToken: v.string() }),
  handler: async (ctx, { roomId, userId, sessionId, interval }) => {
    const user = await requireUser(ctx);
    if (
      roomId !== ROOM_ID ||
      userId !== user._id ||
      interval !== 30_000 ||
      sessionId.length > 300
    )
      throw new ConvexError("INVALID_INPUT");
    // Derive identity on the server and namespace sessions to prevent collisions.
    return presence.heartbeat(
      ctx,
      ROOM_ID,
      user._id,
      JSON.stringify([user._id, sessionId]),
      30_000,
    );
  },
});

export const list = query({
  args: { roomToken: v.string() },
  returns: v.array(
    v.object({
      userId: v.string(),
      online: v.boolean(),
      lastDisconnected: v.number(),
    }),
  ),
  handler: async (ctx) => {
    // The tracking hook only needs its own state; the directory is admin-only.
    const user = await currentUser(ctx);
    if (!user) return [];
    const states = await presence.listUser(ctx, user._id, false, 1);
    return states.map(({ online, lastDisconnected }) => ({
      userId: user._id,
      online,
      lastDisconnected,
    }));
  },
});

export const disconnect = mutation({
  args: { sessionToken: v.string() },
  returns: v.null(),
  // A secret session token authorizes disconnect, including unload sendBeacon.
  handler: (ctx, { sessionToken }) => presence.disconnect(ctx, sessionToken),
});
