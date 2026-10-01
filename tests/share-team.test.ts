import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { shareTeamLink } from "../src/lib/share-team";

const url = "https://example.com/teams/123";
const share = vi.fn();
const writeText = vi.fn();
let mobile = false;

beforeEach(() => {
  mobile = false;
  share.mockReset().mockResolvedValue(undefined);
  writeText.mockReset().mockResolvedValue(undefined);
  vi.stubGlobal("window", { matchMedia: () => ({ matches: mobile }) });
  vi.stubGlobal("navigator", { share, clipboard: { writeText } });
});
afterEach(() => vi.unstubAllGlobals());

describe("team link sharing", () => {
  it("copies the link on desktop even when native sharing is supported", async () => {
    expect(await shareTeamLink(url)).toBe("copied");
    expect(writeText).toHaveBeenCalledExactlyOnceWith(url);
    expect(share).not.toHaveBeenCalled();
  });
  it("opens the mobile share sheet with only the team URL", async () => {
    mobile = true;
    expect(await shareTeamLink(url)).toBe("shared");
    expect(share).toHaveBeenCalledExactlyOnceWith({ url });
    expect(writeText).not.toHaveBeenCalled();
  });
  it("does not copy or report failure when mobile sharing is cancelled", async () => {
    mobile = true;
    share.mockRejectedValue(new DOMException("Cancelled", "AbortError"));
    expect(await shareTeamLink(url)).toBe("cancelled");
    expect(writeText).not.toHaveBeenCalled();
  });
  it("copies on mobile browsers without Web Share support", async () => {
    mobile = true;
    vi.stubGlobal("navigator", { clipboard: { writeText } });
    expect(await shareTeamLink(url)).toBe("copied");
    expect(writeText).toHaveBeenCalledExactlyOnceWith(url);
  });
  it("falls back to copying if the share sheet is unavailable", async () => {
    mobile = true;
    share.mockRejectedValue(new DOMException("Unsupported", "NotAllowedError"));
    expect(await shareTeamLink(url)).toBe("copied");
    expect(writeText).toHaveBeenCalledExactlyOnceWith(url);
  });
  it("propagates clipboard failure so the UI can report it", async () => {
    writeText.mockRejectedValue(new Error("Clipboard unavailable"));
    await expect(shareTeamLink(url)).rejects.toThrow("Clipboard unavailable");
  });
});
