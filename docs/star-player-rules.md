# Star Player rules and sources

| Preset                         | Star Player availability                                                                                                                                                                                      |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| BB2025 Default                 | Up to two choices in this app's exhibition draft. Ordinary league recruitment does not permanently hire Stars; they are match inducements.                                                                    |
| BB2025 Matched Play            | Every roster can hire eligible Stars. Tier 1 permits one choice; tiers 2–4 permit two. At most one Mega-star; ordinary Stars cost 2 SP and Mega-stars 4 SP, in addition to gold.                              |
| Blood Bowl Sevens 2025 Edition | No Stars. They are absent from the permitted Sevens inducements.                                                                                                                                              |
| Kyiv Seven Sins Sevens         | No Stars under organiser rules.                                                                                                                                                                               |
| EuroBowl 2026                  | Tiers 1–4 cannot hire Stars. Tiers 5–7 may hire two Veterans or one Legend, without mixing. Published named lists and bans also apply.                                                                        |
| World Cup 2027 v2.1            | Only Black Orc, Bretonnian, Chaos Renegade, Gnome, Goblin, Halfling, Norse, Ogre and Snotling. Up to two choices, the preset's banned list and SPP tax apply, and eleven regular players must be hired first. |

All permitted hires remain subject to the Star's team/league/god affiliations, available roster spaces and budget. Mandatory pairs count as one choice and two roster places. Existing selections are validated even when their hiring controls are hidden.

## Source precedence

Official Games Workshop cards and errata take precedence over community transcriptions. Individual profile URLs and expected values are retained in `tests/fixtures/bb2025-star-stats.json` and `tests/fixtures/bb2025-star-skills.json`.

- [Official Star Player cards](https://assets.warhammer-community.com/eng_31-10_bb_starplayerslegends_2025-x9a5vmukgj-voazbjmkxq.pdf) cover 49 profiles. The remaining 17 use [Blood Bowl Base](https://bloodbowlbase.ru/bb2025/starplayers/) and [Dadi di Merda](https://dadidimerda.it/starplayers.php?ruleset=bb25).
- [Official Team Tiers and Mega-stars, page 2](https://assets.warhammer-community.com/eng_27-03_blood_bowl_additional_rules_teamtiers-sv0gorfdcq-7azg2fljjr.pdf) lists Griff Oberwald, Hakflem Skuttlespike, H'thark the Unstoppable, Ivan Deathshroud and Morg 'n' Thorg. The [Matched Play transcription](https://bloodbowlbase.ru/bb2025/core_rules/matched_play/#star-players) supplies the rulebook hiring details and total limits.
- [EuroBowl organiser rules](https://www.eurobowl.eu/entrance-options/) govern named Veteran/Legend lists and bans. Stars exclude secondary and stacked advancements. Tier 5 pays 50,000 skill gold per Veteran or 100,000 per Legend; tiers 6–7 pay 40,000 or 80,000. Eleven players are required after hiring Stars.
- [World Cup 2027 v2.1](https://nafwc.com/app/uploads/NAF-World-Cup-Rules-V2.1.pdf), pages 2–4, governs allowances, advancement costs, elite surcharge, inducements and cumulative 18/24/32 SPP Star tax. Eleven regular players must be hired before Stars. Squad-wide Star uniqueness requires organiser checks across all six coaches.

## Profile exceptions

Black Gobbo retains Stunty; H'thark and Zug retain Unsteady; Nobbla retains Saboteur; Ivar retains Loner (4+); Karina has PA 3+. Official cards override conflicting community tables. Eldril's special rule is Mesmerising Dance; Ivan's is Dwarven Scourge. Zolcath causes Distracted under the current card.

The seven unavailable PA values belong to Akhorne, Fungus, Gretchen, Helmut, Kreek, Max and Nobbla, all with No Ball. Combined hire prices are 230,000 GP for Dribl & Drull, 250,000 for Grak & Crumbleberry, and 300,000 for the Swift Twins. Dribl and Drull use 115,000 GP per stored profile and must be hired together. Morg costs 340,000 GP, Grim 190,000 and Puggy 130,000 under BB2025.

## Special rules

Star abilities belong to the `special` skill category. Mandatory pairs share one rule entry; Grak & Crumbleberry and Swift Twins explanations cover both partners. Special rules display first, followed by other starting skills, additional skills and captain/Veteran designations. Each group uses English alphabetical ordering regardless of interface language. Special rules cannot be purchased as advancements.
