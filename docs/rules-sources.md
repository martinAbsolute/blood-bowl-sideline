# Rules snapshot and provenance

Snapshot: `bb2025-2026-09-29`. Blood Bowl Third Season (2025). This is an independent community builder, not an organiser certification tool.

## References

- [BBTC](https://bbtc.pl/): public BB2025 roster and tournament builder pages, including [EuroBowl Human](https://bbtc.pl/team/bb2025/human?ruleset=EB2026_04) and [World Cup Human](https://bbtc.pl/team/bb2025/human?ruleset=WC2027_03), inspected 29 September 2026.
- [Ukrainian community rules and builder](https://bb-rules-g2p.pages.dev/): public factual roster, player, skill-category, star, inducement, and preset data, inspected 29 September 2026. Ukrainian UI terminology is based on this reference. Skill and positional proper names remain English.
- [Mordorbihan BB2025 skills API](https://mordorbihan.fr/api/skills/public/ruleset/BB2025): the user supplied its JSON export on 30 September 2026. All 108 catalog skill and trait names and English definitions match the supplied `name_EN` and `description_EN` strings verbatim, including punctuation, spelling, and paragraph breaks. Existing skill identifiers, categories, elite flags, and Ukrainian descriptions are preserved. The export's inactive characteristic increases (with empty descriptions) and hidden Team Captain entry are outside the selectable skill catalog.
- [EuroBowl 2026 organiser](https://www.eurobowl.eu/entrance-options/): links BBTC as its roster builder. Event rules and organiser decisions take precedence.

Catalog fields and numerical restrictions are based on the references above. English skill definitions are preserved from the user-supplied export. Third-party application code, illustrations, and client assets are not distributed. Temporary research downloads are ignored by Git and Vercel. Our implementation and presentation are original.

## Presets

- **Default:** initial 1,000,000 GP draft budget, with additional skills priced at player-value costs. This is an editable exhibition draft; additional skills, stars, and inducements need organiser agreement for ordinary league recruitment. It does not establish a league team's match history or earned SPP.
- **Matched Play:** 1,150,000 GP; tier-based SP; one extra skill per player; four elite skills; tier-dependent secondary and star allowances.
- **EuroBowl 2026:** BBTC revision `EB2026_04`, cross-checked with the Ukrainian builder: tier-based roster and skill-gold budgets, shared Flowing Funds, primary-only two-skill stacking, secondary and stack limits, restricted veteran/legend stars and advancement exclusions.
- **NAF World Cup 2027 v2.1:** BBTC identifier `WC2027_03` and Ukrainian builder v2.1. The requested “World Cup 2026 v2.1” is labelled **2027** on both reference builders. Tier-based gold and SPP, ordered advancement costs, roster-specific stacking/star permissions, cumulative star tax, 11 regular players before stars, and the Secret Weapon bribe cap are implemented. The official World Cup site was unavailable during this inspection; validate against the organiser's published pack before tournament submission.

## What the checks cover

Position limits, total players, Insignificant balance, shared Big Guy limits, skill access/categories/elite flags, duplicated skills, free Team Captain Pro, star affiliations and paired hires, roster-specific inducements, rerolls/staff, gold, skill currency, and preset restrictions. An incomplete or invalid roster can be saved as a **draft**; the server computes its legal status independently.

Squad-wide uniqueness, event registration, match-day inducements, special-play cards, variable-price mercenaries, and organiser rulings are outside scope. No league progression is implemented. Rule changes require a new snapshot version and an explicit migration strategy; do not mutate the meaning of saved snapshots.

## Components

52 current free shadcn primitives and 67 free Magic UI registry entries are installed. Registry entries unavailable upstream at installation: `script-copy-btn`, `box-reveal`, `arc-timeline`, `flip-text`, `iphone-15-pro`, `grid-beams`, `scratch-to-reveal`, `animated-subscribe-button`. Do not hand-patch vendor folders.
