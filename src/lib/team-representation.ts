/** Explicit JSON-LD negotiation takes precedence over bot compatibility routing. */
export function prefersTeamJsonLd(accept: string) {
  const entries = accept
    .toLowerCase()
    .split(",")
    .map((entry) => {
      const [type, ...parameters] = entry.trim().split(";");
      const quality = parameters.find((parameter) =>
        parameter.trim().startsWith("q="),
      );
      const q = quality ? Number(quality.trim().slice(2)) : 1;
      return {
        type: type.trim(),
        q: Number.isFinite(q) && q >= 0 && q <= 1 ? q : 0,
      };
    });
  const json =
    entries.find((entry) => entry.type === "application/ld+json")?.q ?? 0;
  const html =
    entries.find((entry) => entry.type === "text/html")?.q ??
    entries.find((entry) => entry.type === "text/*")?.q ??
    entries.find((entry) => entry.type === "*/*")?.q ??
    0;
  return json > 0 && json >= html;
}

// A convenience for known readers, not the public representation's contract.
// Every client can access /roster directly or negotiate application/ld+json.
// Keep social preview bots on the page with its Open Graph/Twitter metadata.
export const teamReaderUserAgent =
  /ChatGPT-User|OAI-SearchBot|GPTBot|ClaudeBot|Claude-User|Claude-SearchBot|PerplexityBot|Perplexity-User|curl\/|Wget\/|python-requests\/|^node$/i;
