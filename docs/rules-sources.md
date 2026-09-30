# Rules snapshot and provenance

Snapshot: `bb2025-2026-09-30`. Blood Bowl Third Season (2025). This is an independent community builder, not an organiser certification tool.

## References

- [BBTC](https://bbtc.pl/): public BB2025 roster and tournament builder pages, including [EuroBowl Human](https://bbtc.pl/team/bb2025/human?ruleset=EB2026_04) and [World Cup Human](https://bbtc.pl/team/bb2025/human?ruleset=WC2027_03), inspected 29 September 2026.
- [Ukrainian community rules and builder](https://bb-rules-g2p.pages.dev/): public factual roster, player, skill-category, star, inducement, and preset data, inspected 29 September 2026. Skill definitions were refreshed from the complete [English](https://bb-rules-g2p.pages.dev/en/skills) and [Ukrainian](https://bb-rules-g2p.pages.dev/uk/skills) reference on 30 September 2026 (reference v0.5.3). All 108 skills and traits have full definitions in both languages, including paragraph breaks and English skill/action names where used by the Ukrainian reference. This replaces the previous Ukrainian summaries. The user explicitly selected this reference when definitions conflicted with the earlier English import, including Really Stupid (+2) and Monstrous Mouth (3+). Existing skill identifiers, categories, elite flags, and costs are preserved.
- [Mordorbihan BB2025 skills API](https://mordorbihan.fr/api/skills/public/ruleset/BB2025): the user supplied its JSON export on 30 September 2026. This established the skill and trait catalog, but its English definitions have since been superseded by the bilingual community reference above at the user's request. The export's inactive characteristic increases (with empty descriptions) and hidden Team Captain entry are outside the selectable skill catalog.
- [EuroBowl 2026 organiser](https://www.eurobowl.eu/entrance-options/): links BBTC as its roster builder. Event rules and organiser decisions take precedence.

Catalog fields and numerical restrictions are based on the references above. Full skill definitions in both languages follow the community reference. Third-party application code and research downloads are not distributed. FUMBBL player artwork is attributed separately in `public/assets/fumbbl/README.md`. Temporary research downloads are ignored by Git and Vercel. Our implementation and presentation are original.

## Presets

Team special-rule help uses factual paraphrases of the BB2025 effects, cross-checked against [Blood Bowl Base: The Teams](https://bloodbowlbase.ru/bb2025/core_rules/the_teams/) and [Nuffle Zone: Special Rules](https://nufflezone.com/en/blood-bowl-news-en/special-rules-blood-bowl/). The Team Captain replacement timing follows the corrected commentary shown in the former reference. These descriptions and league reference pages do not change the saved ruleset validators, costs, or roster snapshot. League pages show league-affiliated and universal stars; god-specific eligibility remains in the shared team validator.

- **Default:** initial 1,000,000 GP draft budget, with additional skills priced at player-value costs. This is an editable exhibition draft; additional skills, stars, and inducements need organiser agreement for ordinary league recruitment. It does not establish a league team's match history or earned SPP.
- **Matched Play:** 1,150,000 GP; tier-based SP; one extra skill per player; four elite skills; tier-dependent secondary and star allowances.
- **EuroBowl 2026:** BBTC revision `EB2026_04`, cross-checked with the Ukrainian builder: tier-based roster and skill-gold budgets, shared Flowing Funds, primary-only two-skill stacking, secondary and stack limits, restricted veteran/legend stars and advancement exclusions.
- **NAF World Cup 2027 v2.1:** BBTC identifier `WC2027_03` and Ukrainian builder v2.1. The requested “World Cup 2026 v2.1” is labelled **2027** on both reference builders. Tier-based gold and SPP, ordered advancement costs, roster-specific stacking/star permissions, cumulative star tax, 11 regular players before stars, and the Secret Weapon bribe cap are implemented. The official World Cup site was unavailable during this inspection; validate against the organiser's published pack before tournament submission.

## What the checks cover

Position limits, total players, Insignificant balance, shared Big Guy limits, skill access/categories/elite flags, duplicated skills, free Team Captain Pro, star affiliations and paired hires, roster-specific inducements, rerolls/staff, gold, skill currency, and preset restrictions. An incomplete or invalid roster can be saved as a **draft**; the server computes its legal status independently.

Squad-wide uniqueness, event registration, match-day inducements, special-play cards, variable-price mercenaries, and organiser rulings are outside scope. No league progression is implemented. Use an explicit snapshot version when changing factual rules. This app is in development: obsolete data can be discarded, and preserving old snapshots does not require migrations.
