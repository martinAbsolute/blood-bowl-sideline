"use client";

import { useEffect } from "react";

export function useBeforeUnload(pending: boolean) {
  useEffect(() => {
    if (!pending) return;
    function warn(event: BeforeUnloadEvent) {
      event.preventDefault();
      // Browsers provide their own localized text and ignore custom messages.
      event.returnValue = "";
    }
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [pending]);
}
