# BB2025 regular player roster audit

Verified on 9 October 2026. This audit covers **all 163 positional profiles across all 31 supported rosters**: MA, ST, AG, PA, AV, cost, quantity limits, starting skills, and primary/secondary skill access. Stable positional IDs and names are retained so saved teams continue to resolve their players.

## Sources and method

The requested [FUMBBL BB2025 race strategy index](https://fumbbl.com/help:BB25RaceStrategy) and all 30 linked team tables were opened in Chrome. All **159 FUMBBL positional profiles** were compared for the five characteristics, cost, quantity, and both skill-access columns. Initial HTTP retrieval was blocked, but browser access succeeded. The actual FUMBBL values and every resolved disagreement are retained separately in `tests/fixtures/fumbbl-roster-profiles-bb2025.json`.

Every profile was also compared against the current [Blood Bowl Team Creator BB2025 roster tables](https://bbtc.pl/roster/bb2025), including starting skills, with all 159 non-Slann profiles independently compared against the corresponding [Blood Bowl Base BB2025 team tables](https://bloodbowlbase.ru/bb2025/teams/). FUMBBL corroborates 14 of the 15 corrected profile fields; its remaining Orc Goblin PA value predates an official correction.

The four Slann profiles were confirmed against the NAF's authoritative [2026 regulations, section 4.3.4](https://www.thenaf.net/tournaments/nafdocs/naf-regulations-for-tournaments/), including Kroxigor PA 6+. The NAF explicitly gives its current online version precedence over older PDF copies. Secondary sites still showing Kroxigor PA unavailable are stale.

The independently extracted expected profiles and their individual source links are retained in `tests/fixtures/roster-profiles-bb2025.json`. Regression tests require full positional coverage and compare every audited field, with skill order ignored. These are source-derived expectations, not a snapshot generated from the app's roster data.

## Corrected characteristics

Both comparison sources agree on all nine corrected characteristics:

| Roster            | Position         | Field | Previous    | Confirmed |
| ----------------- | ---------------- | ----- | ----------- | --------- |
| Chaos Chosen      | Beastmen Lineman | PA    | 4+          | 3+        |
| Imperial Nobility | Bodyguard        | PA    | unavailable | 4+        |
| Orc               | Goblin Lineman   | PA    | 3+          | 4+        |
| Snotling          | Snotling Lineman | AV    | 8+          | 6+        |
| Snotling          | Fun-hoppa        | AV    | 8+          | 6+        |
| Snotling          | Stilty Runna     | AV    | 8+          | 6+        |
| Snotling          | Fungus Flinga    | AV    | 8+          | 6+        |
| Snotling          | Pump Wagon       | AV    | unavailable | 9+        |
| Snotling          | Trained Troll    | AV    | unavailable | 10+       |

## Corrected skill access

Both comparison sources also agree on these six corrections:

| Roster         | Position               | Secondary access before | Confirmed secondary access |
| -------------- | ---------------------- | ----------------------- | -------------------------- |
| Chaos Renegade | Renegade Human Thrower | S                       | A, S                       |
| Chaos Renegade | Minotaur               | A, G                    | A, G, M                    |
| High Elf       | High Elf Lineman       | P, S                    | S                          |
| High Elf       | White Lion             | M, S                    | P, S                       |
| High Elf       | Dragon Prince          | P, S                    | S                          |
| Vampire        | Vampire Blitzer        | S                       | none                       |

The High Elf roster is the current 2026 Phoenix Warrior / White Lion / Dragon Prince roster, confirmed against [Blood Bowl Base](https://bloodbowlbase.ru/bb2025/teams/High_Elf/) and [BBTC](https://bbtc.pl/roster/bb2025/high-elf). It is not replaced with the superseded November 2025 Teams of Legend roster. Games Workshop's [January 2026 announcement](https://www.warhammer-community.com/en-gb/articles/nqqvkxjd/the-new-year-preview-show-off-your-blood-bowl-skills-with-the-superlative-high-elf-team/) confirms the new positional lineup.

## Legitimately unavailable passing

Six regular positional profiles correctly retain PA `-`: Dwarf Deathroller, Gnome Woodland Fox, Goblin Loony, Goblin Fanatic, Necromantic Wraith, and Norse Beer Boar. An unavailable passing characteristic is a rules value, not missing data. All 163 regular positional profiles now have a numeric armour target.

## Team-level checks

Re-roll costs and Apothecary access were checked for all 31 teams against BBTC; the 30 FUMBBL teams independently confirm those values and the catalog's default tiers. Two additional catalog errors were corrected:

- **Gnome re-rolls cost 50,000**, previously 60,000. [FUMBBL](https://fumbbl.com/help:BB25GnomeSetUp), [Blood Bowl Base](https://bloodbowlbase.ru/bb2025/teams/Gnome/), [BBTC](https://bbtc.pl/roster/bb2025/gnome), and [Blood Bowl Tactics](https://bbtactics.com/gnome-teams/) agree.
- **Vampire teams may hire an Apothecary**, previously disabled. [FUMBBL](https://fumbbl.com/help:BB25VampireSetUp), [Blood Bowl Base](https://bloodbowlbase.ru/bb2025/teams/Vampire/), [BBTC](https://bbtc.pl/roster/bb2025/vampire), and [Blood Bowl Tactics](https://bbtactics.com/vampire-teams/) agree. Masters of Undeath does not itself prohibit hiring an Apothecary; hiring permission comes from the team roster.

The independently captured team values are retained alongside the positional fixtures. Tournament-specific tier overrides remain separate from these catalog defaults.

## Source conflicts retained for review

Three Blood Bowl Base skill-access cells disagree with BBTC and independent BB2025 references. Existing app values are preserved in these cases:

| Position                                 | Blood Bowl Base | Retained value | Corroborating reference                                                                                                                |
| ---------------------------------------- | --------------- | -------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Halfling Altern Forest Treeman secondary | A, D, G, P      | A, G, P        | [Blood Bowl Tactics](https://bbtactics.com/halfling-teams/) and [Mordorbihan](https://mordorbihan.fr/en/bloodbowl/2025/team/Halflings) |
| Underworld Skaven Blitzer secondary      | A, P            | A, D           | [Blood Bowl Tactics](https://bbtactics.com/underworld-denizen-teams-bb2025/)                                                           |
| Wood Elf Loren Forest Treeman secondary  | A, G            | A, G, P        | [Mordorbihan](https://mordorbihan.fr/en/bloodbowl/2025/team/Wood-Elves)                                                                |

The Chrome FUMBBL comparison also confirms all three retained values above.

FUMBBL has 12 conflicting positional cells. The app retains the following independently corroborated values rather than copying those cells:

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

Source typography such as Looney/Loony, Beastman/Beastmen, Side Step/Sidestep, Pogo/Pogo Stick, and the legacy Ooligan Dirty Player (+1) spelling was normalized to existing skill IDs rather than treated as roster changes. Cost, quantity limits, and starting skill sets otherwise match the BBTC comparison for every profile.

This is a complete comparison of the listed fields against the cited public references, with disagreements disclosed. The paid official core rulebook was not available for a page-by-page independent check, so community corroboration is not represented as primary-source verification.
