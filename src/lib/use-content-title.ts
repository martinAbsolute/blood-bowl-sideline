"use client";

import { useEffect } from "react";
import { siteName } from "./site-metadata";

// Keep the browser title current for local drafts and live Convex renames.
// Social crawlers receive generateMetadata's server-rendered title instead.
export function useContentTitle(title: string | undefined) {
  useEffect(() => {
    if (title !== undefined) document.title = `${title} | ${siteName}`;
  }, [title]);
}
