# Shared team structured data

`GET /teams/[uuid]` includes a native `script#team-structured-data` with
`type="application/ld+json"` in the server-rendered HTML. Fetch the complete
response body (Next.js can stream it), find this script, and parse its text as
JSON. No JavaScript execution or sign-in is needed to read the saved roster.

The same snapshot also initializes the existing roster view in read-only mode
on the server. Its headings, player table, skills, staff quantities and treasury
are ordinary HTML text, so readers that discard script tags can read the team
without processing JSON-LD. Hydration waits for authentication, draft recovery
and live permissions before enabling edits; the server snapshot never grants
edit access. A missing live team invalidates the preview. No separate hidden
roster is added to the interactive page.

Next.js may stream that view inside a container revealed by its runtime. To
support readers that cannot execute that runtime, requests from known bot and
text-client user agents (including `ChatGPT-User`, `OAI-SearchBot`, `GPTBot`,
Claude, Perplexity, curl and Node fetch) are internally rewritten to
`/teams/[uuid]/roster`. This route returns a complete semantic HTML document
with headings, definition lists and a player table, plus the same JSON-LD.
It has no loading placeholders, hidden streaming containers or executable
scripts. Browser and React navigation requests retain the interactive page.
The roster route is also directly accessible for unrecognized readers and is
advertised in the page's alternate link metadata.

The complete reader response includes the ruleset treasury allowance and
remaining treasury for standalone teams. If the team has league context, it
states that league-specific allowances are unavailable rather than assuming
the ruleset allowance. Responses use `no-store`, `Vary: User-Agent` and
`noindex, nofollow`; missing or archived teams return 404 and backend outages
return 503. Only the existing anonymous Convex team query is used.

The document is a Schema.org `WebPage` whose `mainEntity` is a `SportsTeam`.
The team identifier, name, canonical URL and fictional athletes use standard
Schema.org properties. `dateModified` identifies the saved snapshot's timestamp.

`mainEntity.teamSnapshot` contains the Blood Bowl details. Its inline context
maps `teamSnapshot` to `https://sideline.com.ua/ns/blood-bowl#teamSnapshot` as a
JSON-LD 1.1 `@json` literal. This is an application-defined extension, not a
Schema.org property; the nested keys are ordinary JSON rather than invented
Schema.org terms. Consumers can read the object directly without expanding
JSON-LD or fetching the extension URI.

The snapshot includes:

- `schemaVersion` (currently 1), `rulesVersion`, UUID, name and saved revision.
- `legal`, the saved roster's validation status; drafts may be incomplete.
- `leagueLocked` and `leagueExperienced`, the builder's participation flags.
  This is the saved builder roster; current league progression lives on league
  entry pages and is not represented here.
- `roster` and `ruleset`, with readable names and stable catalog IDs. Roster tier
  is specific to the selected ruleset. Leagues here are roster affiliations,
  not the team's tournament history.
- `players`, in roster order, with player number, name, position, full attribute
  names, separately named built-in and added skills, captain Pro skills,
  captain/veteran flags, base cost, advancement cost and displayed player cost.
  Sevens veterans' movement penalty is applied. Empty names remain empty in the
  snapshot; the Schema.org athlete name falls back to the position.
- `starPlayers`, following regular players, with names, stats, skills and costs.
- `staff`, including zero counts. `purchased` is the selected quantity; `count`
  includes any free dedicated fan supplied by the ruleset.
- Selected `inducements`, with counts, names and effective unit/total costs.
- `summary`, with player count and the cost breakdown calculated by the editor's
  domain rules. All amounts have an explicit unit: in-game `gold pieces`, `SP`,
  or `SPP`. Skills cost includes any star-player skill tax; team value includes
  advancements only where the ruleset counts them toward team value.

Budget allowances and remaining treasury are omitted because the anonymous team
query does not provide league-specific budget overrides. Notes, owner IDs,
favorites, edit permissions and draft league IDs are never serialized.

The server uses the existing anonymous Convex `teams.getByUuid` query. Metadata
and JSON-LD share a request-scoped React cache; nothing is cached across requests.
Missing/archived teams and backend failures emit no snapshot. Device-only drafts
and the browser's existing retry/edit behavior remain available. Archived links
retain the existing proxy's 404 behavior. Team links retain `noindex, nofollow`.

The script has no visual output. The existing editor layout and styles are used
for the server preview and the hydrated page.
User text is serialized with `<` escaped to prevent script-tag injection.

References: [Next.js JSON-LD guide](https://nextjs.org/docs/app/guides/json-ld),
[Schema.org SportsTeam](https://schema.org/SportsTeam), and
[JSON-LD JSON literals](https://www.w3.org/TR/json-ld11/#json-literals).
