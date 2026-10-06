"use client";
import { ConvexAuthProvider } from "@convex-dev/auth/react";
import { ConvexReactClient } from "convex/react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/toast";
import { useState } from "react";
import { DraftSignInProvider } from "./draft-sign-in-provider";
import { DraftSyncProvider } from "./draft-sync-provider";
import { NavigationPrewarm } from "./navigation-prewarm";

export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = useState(
    () => new ConvexReactClient(process.env.NEXT_PUBLIC_CONVEX_URL!),
  );
  return (
    <ConvexAuthProvider client={client}>
      <NavigationPrewarm />
      <DraftSignInProvider>
        <DraftSyncProvider>
          <TooltipProvider>
            {children}
            <Toaster />
          </TooltipProvider>
        </DraftSyncProvider>
      </DraftSignInProvider>
    </ConvexAuthProvider>
  );
}
