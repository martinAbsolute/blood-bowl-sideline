# League rules provenance

League rules target Blood Bowl Third Season (BB2025), with the May 2026 official FAQ applied. The commissioner and coaches use the official book as the authority; online reproductions are reference material.

- [Blood Bowl Base: League Play](https://bloodbowlbase.ru/bb2025/core_rules/league_play/) is the user-selected reference for earned SPP, advancement, finances and the post-game sequence.
- [Official May 2026 errata and commentary](https://assets.warhammer-community.com/eng_20-05_blood_bowl_faq_errata-gytvlserev-ngihd3chox.pdf) was inspected on 1 October 2026. It confirms random skill selection uses two candidates, hiring precedes firing, and a replacement captain is appointed before the next fixture. It does not replace the league SPP or skill-value tables.
- [Mordorbihan BB2025 SPP](https://mordorbihan.fr/en/bloodbowl/2025/rules/spp) independently agrees on all six advancement levels and skill-value increments. Elite skills increase player value by 10,000 GP; they do not add an SPP surcharge.
- [Blood Bowl Base: Drafting](https://bloodbowlbase.ru/bb2025/core_rules/drafting_a_blood_bowl_team/) supplies rookie recruitment and TV/CTV. The existing exhibition builder stores paid Dedicated Fan increments, so rookie league fans start at `1 + team.staff.dedicatedFans`, with at most two paid increments. Fans are excluded from TV; unspent rookie budget becomes treasury.
- [Blood Bowl Base: Team Special Rules](https://bloodbowlbase.ru/bb2025/core_rules/the_teams/) supplies Brawlin' Brutes and Low Cost Linemen. The roster catalog determines which teams have these rules.
- [Blood Bowl Base: Cheat Sheet](https://bloodbowlbase.ru/bb2025/core_rules/cheat_sheet/) is the user-selected casualty and lasting-injury reference. Injury helpers take the final modified casualty roll after coaches resolve recovery.
- [Blood Bowl Base: Rules and Regulations](https://bloodbowlbase.ru/bb2025/core_rules/rules_and_regulations/) supplies characteristic limits. [The Game of Blood Bowl](https://bloodbowlbase.ru/bb2025/core_rules/the_game_of_blood_bowl/) supplies injury directions and the MNG-only outcome when a reduction cannot apply.
- [Blood Bowl Base: Skills and Traits](https://bloodbowlbase.ru/bb2025/core_rules/skills_and_traits/) supplies skill prerequisites and incompatible combinations. Free captain Pro and earned advancements are counted separately.

The domain stores SPP-eligible casualties separately from total casualties. `superbThrows` means a Superb Throw followed by safe landing; `safeLandings` counts safe landing by the thrown player regardless of throw quality. Both earn one SPP each for their respective players. Foul/sending-off/injury/death counters do not automatically award SPP. Buchholz, Sonneborn–Berger and cumulative score are standings calculations, not player events.

League chosen advancement costs do not reuse tournament SPP budgets. Random and characteristic cost arrays are recorded for future workflows, but choosing a random outcome requires the physical-roll sequence and eligible candidate checks. Characteristic increases require separate workflow validation; they must not be implemented through the chosen-skill API.

The helper calculates winnings from fan attendance, TD and stalling, including possible 5,000 GP increments. It provides fan-roll and expensive-mistake outcomes from recorded dice; it does not invent dice results. Home/away fixture assignment has no game-rule effect under the season regulation.
