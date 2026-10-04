# FUMBBL player sprites

Retrieved 2026-10-04 from the [BB2025 team roster index](https://fumbbl.com/help:BB25RaceStrategy)
and every linked Team Roster page, followed by all 24 Star Player league links on
[Roster Special Rules](https://fumbbl.com/help:Rosters+Special+Rules). The unlinked
Woodland League was checked too. Slann is absent from the BB2025 index, so its
sprites come from the [separate Slann roster](https://fumbbl.com/help:BB20SlannSetUp).

Artwork is by the FUMBBL community. Attribution does not assert a new license for
these images. Player artwork is excluded from the project's AGPL license; see
[third-party notices](../../../THIRD_PARTY_NOTICES.md).

The manifest records every original image's URL, dimensions and SHA-256, each
player's source label and page, and the coordinates of every lossless PNG crop.
Original PNG/GIF files are byte-identical downloads. Native dimensions and
transparent padding are retained; images are never resized or auto-trimmed.

Roster pages provide individual sprites. Star pages provide four-pose strips:
red front, red side, blue front, blue side. FUMBBL's league-page CSS clips the strip
to its first quarter. Our UI likewise displays the red front pose. All four poses
are preserved in the asset library. Each position uses the sprite from its own
roster row, including distinct roster-specific depictions of shared creatures.

Every position in all 31 application rosters and every one of its 66 Star Players
has artwork. The library also preserves Frank 'n' Stein and Bryce 'the Slice'
Cambuel from the source league lists, without adding them to the rules catalog.

## Supplemental Bugman source

Josef Bugman is absent from FUMBBL's official Star Player league lists and complete
Star Player page. To cover the existing application entry, sprite
[693925](https://fumbbl.com/i/693925) comes from a
[FUMBBL community roster](https://fumbbl.com/p/notes?id=9260&op=view) explicitly
labeling it "Josef Bugman the brewer". This exception is also recorded in the
source map and manifest; it is not presented as canonical league-list artwork.

## Rebuilding

`scripts/fumbbl-sprite-sources.json` is the reviewed player-ID-to-source map. Source
labels remain verbatim even where FUMBBL and the rules catalog spell names
differently. Goblin Doom Diver/Ooligan and Norse Valkyrie/Berserker rows are mapped
by identity, not their differing order on the source pages. Changing rules-catalog
IDs requires updating this map; the importer rejects incomplete coverage.

Run `node scripts/import-fumbbl-icons.mjs` to rebuild offline from the checked-in
originals. Use `--download` to refresh the recorded URLs, or `--cache <directory>`
for previously downloaded files named by the SHA-256 of their HTTPS source URL.
The importer validates every source and builds the replacement in a temporary
directory before removing the previous library.

`src/domain/data/player-icons.json` is the small runtime catalog keyed directly by
position and star IDs. It contains only source labels, groups, native dimensions,
preview paths and roster representatives. Source auditing data stays out of the
client bundle. Artwork changes do not modify player rules, stats or eligibility.
