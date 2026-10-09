# Shared team structured data

`GET /teams/[uuid]` includes a native `script#team-structured-data` with
`type="application/ld+json"` in the server-rendered HTML. Fetch the complete
response body (Next.js can stream it), find this script, and parse its text as
JSON. No JavaScript execution or sign-in is needed to read the saved roster.

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

The script has no visual output; the editor and its HTML/CSS are unchanged.
User text is serialized with `<` escaped to prevent script-tag injection.

References: [Next.js JSON-LD guide](https://nextjs.org/docs/app/guides/json-ld),
[Schema.org SportsTeam](https://schema.org/SportsTeam), and
[JSON-LD JSON literals](https://www.w3.org/TR/json-ld11/#json-literals).
