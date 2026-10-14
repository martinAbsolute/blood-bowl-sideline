# Roster source precedence

BB2025 positional profiles use [BBTC](https://bbtc.pl/roster/bb2025) and [Blood Bowl Base](https://bloodbowlbase.ru/bb2025/teams/), with [FUMBBL](https://fumbbl.com/help:BB25RaceStrategy) as an additional reference. The four Slann profiles follow [NAF regulations, section 4.3.4](https://www.thenaf.net/tournaments/nafdocs/naf-regulations-for-tournaments/), including Kroxigor PA 6+.

Source URLs and expected fields for all 163 positions are retained in `tests/fixtures/roster-profiles-bb2025.json`. The independent FUMBBL comparison is in `tests/fixtures/fumbbl-roster-profiles-bb2025.json`. Preserve stable catalog IDs when normalizing source spellings.

## Conflicting source values

Use these corroborated values where FUMBBL differs:

| Position / field                   | FUMBBL | Retained | Additional evidence beyond BBTC and Blood Bowl Base                                                                                                                            |
| ---------------------------------- | ------ | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Chaos Chosen secondary             | A      | AD       | [Blood Bowl Tactics](https://bbtactics.com/chaos-chosen-teams/)                                                                                                                |
| Chaos Chosen Troll secondary       | AG     | AGP      | [Blood Bowl Tactics](https://bbtactics.com/chaos-chosen-teams/)                                                                                                                |
| Renegade Dark Elf secondary        | PS     | S        | [Blood Bowl Tactics](https://bbtactics.com/chaos-renegade-teams/)                                                                                                              |
| Elven Union Lineman quantity       | 0–12   | 0–16     | [Blood Bowl Tactics](https://bbtactics.com/elven-union-teams/)                                                                                                                 |
| Goblin Ooligan secondary           | GPS    | GS       | [Blood Bowl Tactics](https://bbtactics.com/goblin-teams/)                                                                                                                      |
| Norse Raider quantity              | 0–12   | 0–16     | [Blood Bowl Tactics](https://bbtactics.com/norse-teams/)                                                                                                                       |
| Norse Berserker secondary          | A      | AP       | [Blood Bowl Tactics](https://bbtactics.com/norse-teams/)                                                                                                                       |
| Old World Alliance Troll Slayer AG | 5+     | 4+       | [Blood Bowl Tactics](https://bbtactics.com/old-world-alliance-teams/)                                                                                                          |
| Orc Goblin PA                      | 3+     | 4+       | **[Official May 2026 errata, page 1](https://assets.warhammer-community.com/eng_20-05_blood_bowl_faq_errata-gytvlserev-ngihd3chox.pdf)** explicitly corrects rulebook page 181 |
| Orc Blitzer secondary              | AP     | AD       | [Blood Bowl Tactics](https://bbtactics.com/orc-teams/)                                                                                                                         |
| Tomb Kings Blitzer PA              | 6+     | 5+       | [Blood Bowl Tactics](https://bbtactics.com/tomb-king-teams/)                                                                                                                   |
| Wood Elf Lineman quantity          | 0–12   | 0–16     | [Blood Bowl Tactics](https://bbtactics.com/wood-elf-teams/)                                                                                                                    |

These exceptions are explicit in the FUMBBL fixture and regression tests. Eleven rely on agreement among independent community transcriptions; the Orc Goblin correction is directly verified against the publisher's errata.
