# BB2025 Star Player skills and special rules audit

Checked 14 October 2026. All 66 existing Star Player profiles now include their named special rule in `skills`, using 63 unique entries in the `special` category. Mandatory pairs share a badge; the explanations for Grak & Crumbleberry and the Swift Twins describe both partners' effects.

## Sources and comparison

The requested [BBTactics Season 3 table](https://bbtactics.com/blood-bowl-star-players-list/) was checked against all 63 [Blood Bowl Base BB2025 profile pages](https://bloodbowlbase.ru/bb2025/starplayers/), including both profiles on each paired page. The source URLs, ordinary starting skills and special-rule IDs are recorded independently in `tests/fixtures/bb2025-star-skills.json`. All five characteristics were rechecked against these profiles and the existing independent stat fixture. No characteristic or ordinary starting-skill corrections were needed.

The [official Games Workshop Star Player cards currently linked on the downloads page](https://assets.warhammer-community.com/eng_31-10_bb_starplayerslegends_2025-x9a5vmukgj-voazbjmkxq.pdf) take precedence over community transcriptions. The previously audited official PDF was rendered and inspected across all 13 pages; the currently linked PDF was also downloaded, and its final page was inspected to confirm the revised Zolcath wording. The remaining 17 catalog profiles rely on community transcriptions rather than a directly inspected core book or individual card. Descriptions in the app are paraphrases of the mechanics, with Ukrainian translations using the existing community skill terminology.

Specific discrepancies were resolved as follows:

- Black Gobbo retains **Stunty**, explicitly present on his official card but omitted by Blood Bowl Base.
- H'thark retains **Unsteady**, Nobbla retains **Saboteur**, and Zug retains **Unsteady**, all present on the official cards but absent from the linked BBTactics table.
- Ivar retains **Loner (4+)**, confirmed by his official card. Karina retains **PA 3+**, also confirmed by her card.
- Eldril's ability uses the official name **Mesmerising Dance**; Ivan's uses **Dwarven Scourge**.
- Zolcath's ability causes **Distracted**, confirmed by the currently linked official card. The older PDF described losing the Tackle Zone.
- BBTactics mixes older prices into its table. The app retains the BB2025 profile prices: [Morg 340,000](https://bloodbowlbase.ru/bb2025/starplayers/Morg_%27n%27_Thorg/), [Grim 190,000](https://bloodbowlbase.ru/bb2025/starplayers/Grim_Ironjaw/) and [Puggy 130,000](https://bloodbowlbase.ru/bb2025/starplayers/Puggy_Baconbreath/).

The [official May 2026 FAQ](https://assets.warhammer-community.com/eng_20-05_blood_bowl_faq_errata-gytvlserev-ngihd3chox.pdf) was checked for Star Player updates; it does not replace these profile characteristics or abilities. This audit covers the existing BB2025 catalog; it does not add the legacy Bryce or Frank entries shown as missing from Season 3 in BBTactics.

## Display and eligibility

The dedicated teal `.skill-special` color distinguishes unique star abilities from ordinary skill categories and traits. Existing `SkillList` and `SkillBox` consumers display the new badges and localized rule help in recruitment, player dialogs and reference tables. The shared catalog also supplies the print appendix and structured roster exports.

The category is intentionally absent from purchasable category access. These rules cannot be selected as ordinary player advancements. Saved Star Player IDs, characteristic values, costs, normal skills, hiring rules and the saved-team schema remain unchanged.

## Verification

`tests/star-special-skills.test.ts` checks complete coverage, exact ordinary and special skill sets, localized names and explanations, paired rules, rendered badge/help metadata and exclusion from league advancements across every roster position. Existing stat, translation, print and roster-reader tests also run against the updated catalog.

All 1,011 tests, typechecking, ESLint, full project formatting and the production build passed. Local browser inspection confirmed the teal badge and localized rule dialogs. The initial globe type errors were traced to a stale local COBE 0.6.5 installation; installing the declared stable 2.0.1 resolved them without component changes. See [the stable dependency update audit](dependency-update-2026-10-14.md) for the subsequent package updates and production bundle analysis.
