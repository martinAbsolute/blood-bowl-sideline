/** Use the native share sheet on mobile; desktop and unsupported browsers copy. */
export async function shareTeamLink(
  url: string,
): Promise<"shared" | "copied" | "cancelled"> {
  const mobile = window.matchMedia("(pointer: coarse)").matches;
  if (mobile && typeof navigator.share === "function") {
    try {
      await navigator.share({ url });
      return "shared";
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError")
        return "cancelled";
      // Some browsers expose Web Share but cannot open a share sheet.
    }
  }
  await navigator.clipboard.writeText(url);
  return "copied";
}
