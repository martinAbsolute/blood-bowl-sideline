# Sevens rules audit

Checked 9 October 2026. The `bb2025-sevens` preset represents Spike! Journal 22 Matched Play with the NAF clarifications documented in [rules-sources.md](rules-sources.md). The Kyiv preset retains the organiser requirements supplied by the user.

## Pro and Leader

The [NAF BB2025 Sevens clarification](https://www.thenaf.net/naf-recommendations-and-clarifications-for-bb2025/), revised 26 September 2026, expressly permits purchasing both skills in Matched Play. Captaincy grants starting Pro, and the captain can also be the Veteran. NAF rulings are optional for organisers; this preset adopts them.

Spike! Journal 22, page 16, instead prohibits gaining either skill through **Sevens league advancement**. That is not a prohibition on having both skills. The [community transcription's Leader & Pro section](https://bloodbowlbase.ru/bb2025/spike_journal/issue_22/#leader-pro) preserves this distinction. This app's Sevens presets do not model league progression.

- Standard Matched Play can have a captain with free Pro and purchased Leader. Purchasing both as additional skills on one player fails the one-additional-skill limit.
- Kyiv bans purchased Leader by organiser instruction. It retains starting captain Pro and otherwise permitted Pro purchases.
- Reroll restrictions during an activation are separate from roster eligibility. NAF specifically disallows combining a Veteran reroll with Pro or another reroll on the same dice. The roster builder does not resolve dice.

## Draft checks

[GW's designer notes](https://www.warhammer-community.com/en-gb/articles/f0owm2ar/designers-notes-on-blood-bowl-sevens/) confirm four non-Linemen maximum, 100,000 GP rerolls and a mandatory Lineman Veteran. Detailed costs and limits were cross-checked against the [Spike! Journal 22 transcription](https://bloodbowlbase.ru/bb2025/spike_journal/issue_22/); it is a secondary transcription, not a newly inspected official PDF.

Existing validation correctly enforces 7–11 players, positional limits, Veteran selection, budget, staff and inducement caps, and the restricted inducement list. Standard Matched Play grants 1/2/3/4 SP by tier, charges 1 SP per primary or 2 per secondary, and caps added skills at one per player, one secondary and two elite skills per team. Star Players are absent from the Sevens inducement list; both presets reject them. Kyiv keeps its separate 650,000 GP budget and skill package.

## Corrected enforcement gap

Category access alone previously allowed additions whose skill text forbids them. The draft validator now shares the league advancement compatibility checks: Frenzy conflicts, trait prerequisites, Pogo/Leap, and Ball & Chain exclusions. These were checked against the [BB2025 Skills & Traits transcription](https://bloodbowlbase.ru/bb2025/core_rules/skills_and_traits/). NAF also explicitly confirms the Bullseye requirement for Throw Team-mate. No invented Pro/Leader incompatibility was added.

Regression tests cover legal captain Pro plus Leader, separate Pro/Leader purchases, stacking, elite limits and missing prerequisites. Cloud tests reject forged standard Sevens saves for specialist, Veteran, skill, staff, fan, inducement and star violations and verify the previous shared snapshot survives rejection.

## Separate elite limits for standard Matched Play

The official [GW May 2026 FAQ](https://assets.warhammer-community.com/eng_20-05_blood_bowl_faq_errata-gytvlserev-ngihd3chox.pdf), PDF page 3, clarifies rulebook page 112: standard Matched Play allows four additions of **each individual elite skill**. The previous aggregate-four check was incorrect. It now counts copies by skill, so four Block plus two Dodge is permitted if the remaining draft rules are met.

This does not replace Sevens' separate Spike! Journal 22 purchasing rule, which limits the roster to two additional elite skills in any combination. A regression with two Block plus one Guard confirms that Sevens still enforces its aggregate cap. Starting skills do not consume either allowance.
