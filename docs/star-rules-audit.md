# Star Player rules audit

Checked 9 October 2026 for snapshot `bb2025-2026-10-09`.

| Preset                         | Star Player availability                                                                                                                                                                                      |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| BB2025 Default                 | Up to two choices in this app's exhibition draft. Ordinary league recruitment does not permanently hire Stars; they are match inducements.                                                                    |
| BB2025 Matched Play            | Every roster can hire eligible Stars. Tier 1 permits one choice; tiers 2–4 permit two. At most one Mega-star; ordinary Stars cost 2 SP and Mega-stars 4 SP, in addition to gold.                              |
| Blood Bowl Sevens 2025 Edition | No Stars. They are absent from the permitted Sevens inducements.                                                                                                                                              |
| Kyiv Seven Sins Sevens         | No Stars, under the organiser requirements already supplied for this preset.                                                                                                                                  |
| EuroBowl 2026                  | Tiers 1–4 cannot hire Stars. Tiers 5–7 may hire two Veterans or one Legend, without mixing. Published named lists and bans also apply.                                                                        |
| World Cup 2027 v2.1            | Only Black Orc, Bretonnian, Chaos Renegade, Gnome, Goblin, Halfling, Norse, Ogre and Snotling. Up to two choices, the preset's banned list and SPP tax apply, and eleven regular players must be hired first. |

All permitted hires remain subject to the Star's team/league/god affiliations, available roster spaces and budget. Mandatory pairs count as one choice and two roster places. Existing selections are validated even when their hiring controls are hidden.

## Confirmed correction

Matched Play previously treated every Star as ordinary: its Mega-star list was empty, every hire cost 2 SP, and two Mega-stars could be combined. It now uses the five names in [GW's official 2026 Team Tiers and Mega-stars document, page 2](https://assets.warhammer-community.com/eng_27-03_blood_bowl_additional_rules_teamtiers-sv0gorfdcq-7azg2fljjr.pdf): Griff Oberwald, Hakflem Skuttlespike, H'thark the Unstoppable, Ivan Deathshroud and Morg 'n' Thorg. [GW's May 2026 designer notes](https://www.warhammer-community.com/en-gb/articles/wqewdcvv/blood-bowl-faqs-games-designers-notes/) explicitly confirm that the Mega-star list did not change in that update.

The 4 SP price, maximum of one Mega-star, tier-specific total limit and paired-hire treatment are cross-checked against the [community transcription of Third Season Matched Play, Star Players section (rulebook page 113)](https://bloodbowlbase.ru/bb2025/core_rules/matched_play/#star-players). The additional total limit is necessary because a tier-one team cannot combine one ordinary Star with one Mega-star despite separately satisfying each class limit. This transcription is secondary evidence for the rulebook wording; the names themselves have a directly inspected official source.

## Event provenance and limits

The [EuroBowl organiser's rules page](https://www.eurobowl.eu/entrance-options/) endorses BBTC as its builder and links a [final rules image](https://81ccd0e8d4.clvaw-cdnwnd.com/5c60ea6ad06557d471522410634695d3/200000050-a23e1a23e2/rules%20final.png?ph=81ccd0e8d4). This image was downloaded and visually inspected on 9 October. All 33 Veteran names, 13 Legend profile IDs (11 choices, including two pairs), and 13 banned profile IDs (12 choices, including Dribl & Drull) match the catalog. The tier permissions, no-mixing rule, prohibition on secondary/stacked advancements with Stars, and minimum of eleven players **after** hiring Stars also match. Tier 5 pays an additional 50,000 skill gold per Veteran or 100,000 per Legend; tiers 6–7 pay 40,000 or 80,000 respectively. A [NAF-hosted EuroBowl 2026 PDF](https://www.thenaf.net/tournament_files/11880/Eurobowl2026.pdf) is also linked by the August 2026 H.4.0.S. Cup event.

The [World Cup organiser's v2.1 PDF](https://nafwc.com/app/uploads/NAF-World-Cup-Rules-V2.1.pdf), pages 2–4, was visually inspected in the task browser on 9 October. All 31 roster budgets, SPP allowances and stacking permissions match the catalog, as do all nine Star-eligible rosters and all 16 banned profile IDs (15 choices, including Grak & Crumbleberry). The published advancement costs, elite surcharge, permitted inducements, cumulative 18/24/32 SPP Star tax bands, eleven regular hires before Stars, and Secret Weapon bribe cap also match. Earlier BBTC `WC2027_03` and Ukrainian v2.1 provenance is now corroborated directly by the organiser's pack.

The PDF also limits each named Star to one hire across an entire six-coach squad. This individual-roster builder cannot enforce squad-wide uniqueness; organisers must check it across the submitted squad. The audit confirms this v2.1 pack, not any future revision.

For Sevens sources and the distinction between NAF Matched Play, league advancement and the Kyiv organiser overrides, see [sevens-rules-audit.md](sevens-rules-audit.md). Individual Star characteristic corrections are documented separately in [star-stat-audit.md](star-stat-audit.md).

## Validation

`tests/star-rules.test.ts` covers both Sevens presets across all rosters, forbidden imported hires, exhibition affiliations, Mega-star costs and combinations, tier-one totals, paired hires, EuroBowl tier/class restrictions, the World Cup roster allowlist and eleven regular hires. Existing general rules tests additionally exercise star affiliations, pairs, budgets and event restrictions.
