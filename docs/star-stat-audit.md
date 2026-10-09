# BB2025 Star Player characteristic audit

Checked 9 October 2026. Covers all 66 existing catalog stars and all five characteristics (MA, ST, AG, PA, AV). The independent source snapshot is `tests/fixtures/bb2025-star-stats.json`; every entry includes its profile URL. Regression tests require complete catalog coverage and compare every characteristic.

## Evidence

- [Games Workshop's BB2025 Star Player download](https://assets.warhammer-community.com/eng_31-10_bb_starplayerslegends_2025-8matmsj7hl-4fjzukneyd.pdf): all 49 cards across its 13 pages were rendered and visually inspected. All five characteristics agree with the audited values. The PDF explains that these supplement the core rulebook stars.
- [Blood Bowl Base BB2025 profiles](https://bloodbowlbase.ru/bb2025/starplayers/): all 63 linked profile pages, covering 66 players including paired hires, were compared programmatically.
- [Dadi di Merda BB2025 star table](https://dadidimerda.it/starplayers.php?ruleset=bb25): all 66 stat lines were independently compared with the profile pages. No characteristic disagreements remained.

The 17 stars outside that GW PDF were confirmed against the two community transcriptions; direct inspection of their core-book or separate published cards is not claimed. No third-party artwork, rule prose or downloaded PDFs are redistributed by this audit.

The FUMBBL race wiki's linked [generic Elven Kingdoms Star Player page](https://fumbbl.com/p/stars?for=Elven+Kingdoms+League) was also inspected in Chrome. It contains older-edition values, including Eldril PA 5+, the Swift Twins at 340,000, and No Hands terminology. Those generic league links are not reliable BB2025 Star Player references; they do not override the dated official cards above.

## Corrections

Thirty characteristic fields changed across 25 Star Players. Twenty-one PA dashes were erroneous. Count Luthor's display-name typo was also corrected to **Count Luthor von Drakenborg**; the stored identifier remains stable.

| Star                     | Corrected characteristics |
| ------------------------ | ------------------------- |
| Captain Karina von Riesz | PA – → 3+                 |
| Dribl                    | PA – → 4+                 |
| Drull                    | MA 6 → 8                  |
| Estelle la Veneaux       | PA – → 4+; AV 9+ → 8+     |
| Grashnak Blackhoof       | PA – → 6+                 |
| Gretchen Wächter         | AG 3+ → 2+                |
| Grombrindal              | PA – → 4+                 |
| Guffle Pusmaw            | PA – → 6+; AV 9+ → 10+    |
| Ivar Eriksson            | PA – → 4+                 |
| Jordell Freshbreeze      | PA – → 3+                 |
| Karla von Kill           | PA – → 3+                 |
| Kiroth Krakeneye         | PA – → 3+                 |
| Maple Highgrove          | PA – → 5+                 |
| Rashnak Backstabber      | PA – → 5+                 |
| Ripper Bolgrot           | AG 4+ → 5+                |
| Rowana Forestfoot        | PA – → 4+                 |
| Roxanna Darknail         | PA – → 3+                 |
| Scrappa Sorehead         | PA – → 4+                 |
| Scyla Anfingrimm         | PA – → 6+                 |
| Skrorg Snowpelt          | PA – → 6+; AV 10+ → 9+    |
| Skrull Halfheight        | MA 5 → 6; PA 2+ → 3+      |
| Swiftvine Glimmershard   | PA – → 5+                 |
| Thorsson Stoutmead       | PA – → 3+; AV 9+ → 8+     |
| Willow Rosebark          | PA – → 5+                 |
| Zzharg Madeye            | PA – → 3+                 |

The seven genuine PA dashes are Akhorne, Fungus, Gretchen, Helmut, Kreek, Max and Nobbla. All seven have No Ball. The audit does not invent a passing characteristic for them.

## Additional cost and skill checks

All 66 starting-skill sets and all 60 single-star hire prices were compared against the downloaded Blood Bowl Base profile pages. The only starting-skill disagreement was The Black Gobbo: Blood Bowl Base omits Stunty, but the official Games Workshop PDF on page 2 explicitly includes it. The app correctly retains Stunty.

The three combined hire prices were checked separately. **Dribl and Drull cost 230,000 gold pieces for both**, confirmed directly on the official Games Workshop PDF, page 3, and the [Blood Bowl Base paired profile](https://bloodbowlbase.ru/bb2025/starplayers/Dribl_and_Drull/). Their app entries previously totalled 270,000. Both are now stored as 115,000 in the existing split-cost representation; they must still be hired together. Grak and Crumbleberry total 250,000, and the Swift Twins total 300,000; those totals were already correct. Regression tests exercise the team cost calculation for all three pairs.

Affiliations and special abilities are outside this audit. Star hiring policy is documented separately in `star-rules-audit.md`.
