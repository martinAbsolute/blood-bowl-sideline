"use client";
import { ConvexAuthProvider } from "@convex-dev/auth/react";
import { ConvexReactClient } from "convex/react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { useState } from "react";
import { DraftSignInProvider } from "./draft-sign-in-provider";
import { DraftSyncProvider } from "./draft-sync-provider";

export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = useState(
    () => new ConvexReactClient(process.env.NEXT_PUBLIC_CONVEX_URL!),
  );
  return (
    <ConvexAuthProvider client={client}>
      <DraftSignInProvider>
        <DraftSyncProvider>
          <TooltipProvider>
            {children}
            <Toaster richColors position="bottom-right" />
          </TooltipProvider>
        </DraftSyncProvider>
      </DraftSignInProvider>
    </ConvexAuthProvider>
  );
}
