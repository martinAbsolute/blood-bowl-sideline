# FUMBBL player icons

Source: https://fumbbl.com/p/icons, retrieved 2026-09-30. Artwork by the FUMBBL
community; original player labels and individual image source URLs are preserved
in `manifest.json`. This attribution does not assert a new license for the artwork.
Player artwork is excluded from the project's AGPL license; see
[third-party notices](../../../THIRD_PARTY_NOTICES.md).

All 227 player-icon images on that page are included (including historical stars
and Prize Players). Navigation/site-decoration images are excluded.

- `sheets/<source-roster>/`: byte-identical original PNG/GIF sheets, named with
  source player label, FUMBBL image ID, and actual width × height in pixels.
- `players/<source-roster>/`: 2,308 lossless PNG cells. Filenames identify source
  label, image ID, variant row, team color, pose, and actual width × height.
- `manifest.json`: source URLs, source labels, dimensions, SHA-256 checksums,
  variant counts, and every crop's coordinates/dimensions.

Columns are red front, red side, blue front, blue side. Rows are visual variants,
not animation frames. Cells are square (sheet width / 4), except Hubris Rakarth
(436462), which uses 28×32 cells. The Sand Skeleton original is a GIF; its cells
are PNGs. Transparent padding is retained; crops are not resized or auto-trimmed.

The UI uses red front poses at native pixel sizes with pixelated rendering.
Repeated players use different source variants. The small client catalog at
`src/domain/data/player-icons.json` contains only dimensions and preview paths;
the complete manifest is not shipped as JavaScript.

## Rebuilding

With dependencies installed, run `node scripts/import-fumbbl-icons.mjs` to re-slice
the checked-in originals. To import a fresh browser `pageAssets` bundle, pass its
manifest path. The script checks that all 227 source IDs have labels in
`scripts/fumbbl-icon-labels.txt` and rejects unrecognized layouts.

## Current catalog artwork substitutions

Presentation mappings live in `src/domain/player-icons.ts`. They do not change
roster names, stats, skills, eligibility, or ruleset snapshots. Source filenames
always retain their original labels, even when artwork represents a newer role.

The source page predates several positions in this app's BB2025 catalog:

- Amazon uses historical linewoman/thrower/catcher/blitzer artwork for the current
  Eagle/Python/Piranha/Jaguar roles.
- Black Orc uses Orc goblin, Black Orc blocker, and troll artwork.
- Bretonnian uses Human lineman/catcher/thrower and Bo Gallanté artwork.
- Imperial Nobility uses Human and Old World Alliance human/ogre artwork.
- Khorne uses Renegade human, Beastman, Chosen blocker, and Scyla artwork.
- Chaos Dwarf Sneaky Stabba and Flamesmith reuse Hobgoblin and blocker artwork.
- Necromantic Wraith uses historical Wight artwork. Norse Valkyrie and Yhetee use
  historical Catcher and Snow Troll artwork. High Elf White Lion and Dragon Prince
  use historical Blitzer and Catcher artwork.
- Added big guys, halflings, and snotlings use the same creature's artwork from
  another source roster where necessary. Vampire runner/thrower/blitzer share
  historical Vampire variants.
- Gnome roster cards show their Treeman. Gnome players, Woodland Fox, Beer Boar,
  and Vargheist have no suitable image on this page and use a neutral player icon.
- Stars absent from the source page use a neutral star icon. Star matching handles
  punctuation, accents, and recorded historical spelling/name differences (Count
  Luthor, Rumbelow, Varag, Gretchen, Mighty Zug, and Wilhelm).

No artwork is relabeled as an official depiction of a newer position.
