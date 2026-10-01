# Blood Bowl league play design

This implementation extends the existing Teams and Telegram accounts into a playable standard Blood Bowl league. The first acceptance scenario is two coaches, with one also serving as commissioner: register teams, launch a single round-robin phase, receive a fixture, record a match from both accounts, finalize its report, and spend earned player SPP. The commissioner can inspect match and team progression history.

Research date: 1 October 2026. This records the implementation architecture and acceptance plan. The user has requested a working league workflow, beginning with standard BB2025 only. The supplied [commissioner requirements](../requirements.md) remain the original source and have not been edited.

The user's clarifications take precedence over the original document: the app is the official record and replaces Google Sheets. Both coaches fill one shared report during or after play, without a required timer. Each confirms the same report revision; this locks it, and only the commissioner can correct it afterward. Coaches make validated SPP and roster changes directly, with commissioner review and correction. Standings treat coach and team as one unit. BHZ is Buchholz, SBR is Sonneborn–Berger, and CU is cumulative score; these are calculated standings metrics rather than player event counters.

## Requirements established by the commissioner

| Subject          | Season 1 requirement                                                                                     |
| ---------------- | -------------------------------------------------------------------------------------------------------- |
| Competition      | Lviv Blood Bowl League, one team per coach                                                               |
| Rules            | Standard BB2025, applicable official FAQ and Spike publications; Slann additionally allowed              |
| Format           | Single round robin, one game against each opponent, no playoffs                                          |
| Team creation    | 1,000,000 GP initial budget                                                                              |
| Registration     | Deadline 8 October 2026; final entrants decided by commissioner                                          |
| Season start     | Planned for 11 October 2026                                                                              |
| Rounds           | Two weeks; commissioner may open the next round early or extend a deadline                               |
| Points           | Win 3, draw 1, loss 0                                                                                    |
| Tiebreakers      | Summary specifies TD difference, then CAS difference; section 15 retains an unresolved head-to-head edit |
| Odd attendance   | Balanced byes; no played match, points, or automatic bonuses                                             |
| Team replacement | Allowed before the coach's first official match, including after season launch                           |
| Reporting        | Score, MVP and required team/player statistics; photographic evidence for games outside the main venue   |
| Team development | Normal advancement, recruitment, dismissal, injuries and deaths under the rules                          |
| Administration   | Commissioner maintains schedule/statistics, handles disputes and corrects administrative errors          |
| Communication    | Telegram                                                                                                 |
| Official record  | The app, per the user's clarification; standings and history replace Google Sheets                       |

Keep the real league dates configurable. A two-person test league must be able to start immediately without waiting for the published season dates. Use the league timezone for displayed deadlines and store instants consistently.

## What Tourplay establishes

Tourplay is a workflow reference. Its public documentation does not establish every permission or confirmation policy proposed for Sideline.

| Source reviewed                                                                                             | Relevant behavior                                                                                                                                                           |
| ----------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Support directory](<https://tourplay.net/en/support/content/(supportContent:index)>)                       | Entry point for commissioner and coach guides                                                                                                                               |
| [Quick guide](<https://tourplay.net/en/support/content/(supportContent:manage-championships/quick-guide)>)  | Competition setup includes phases with pairing/scoring/calendar settings, team registration, generated rounds and published fixtures; round robin accommodates odd entrants |
| [FAQ](https://tourplay.net/en/help)                                                                         | Draw a complete eligible phase or rounds gradually; coaches enter league reports and administrators can edit entered reports; undo is described with a 15-day limit         |
| [Turn timer](<https://tourplay.net/en/support/content/(supportContent:manage-coaches/turn-timer)>)          | Events can retain a turn association and coaches control their own turns                                                                                                    |
| [Tiebreakers](<https://tourplay.net/en/support/content/(supportContent:manage-championships/tie-breakers)>) | Points followed by configured criteria, including TD and CAS differences                                                                                                    |
| [Exports](<https://tourplay.net/en/support/content/(supportContent:manage-championships/export-data)>)      | Competition data can be exported as CSV for spreadsheet tools                                                                                                               |
| [Current product page](https://tourplay.net/en)                                                             | Advertises shared live reports, roster management, statistics, commissioner corrections and BB2025 support                                                                  |

Detailed tracker and roster-maintenance links encountered during research resolved to the support index, so exact Tourplay joint confirmation and advancement approval behavior could not be verified. The [BB2020 improvements article](<https://tourplay.net/en/support/content/(supportContent:novelties/new-bloodbowl2020-rules)>) describes chosen/random progression and guided match steps, but its older edition cannot supply BB2025 numerical rules.

Accepted adaptation: give both coaches a shared match workspace, derive official results from an agreed revision, and allow commissioner corrections with a recorded reason. These are Sideline design choices, not claims that Tourplay uses precisely this protocol.

## Existing foundations and integration

The app already has authenticated Telegram accounts, owner-scoped cloud teams, revision checks, roster/skill/star/inducement catalogs, bilingual UI, player icons, skill explanations, sharing and printing. Reuse those foundations.

The current [Team schema](../src/domain/types.ts) stores draft roster choices. [Team saving](../convex/teams.ts) replaces that editable payload, including skills and players. As documented in [rules provenance](rules-sources.md), Default is an exhibition draft, and tournament SPP allowances are not earned league SPP. Initial-budget validation also cannot validate a developed league team.

Retain `teams._id`, its UUID and `ownerId` as the canonical team identity. Attach official league career records to that document, rather than creating unrelated teams or letting builder autosave overwrite progression. A team in the Teams library should expose its builder and official league roster/history. Registration records the source revision and creates the sanctioned rookie roster. The source builder is locked while the team participates. Enrollment permanently marks that source team as experienced and prevents entry into another rookie league. Withdrawal, replacement or completion releases the builder lock without resetting experience; later planning edits do not change the official roster.

Official state changes through commands such as hiring a player, buying an advancement, recording a casualty outcome or applying a commissioner correction. Generic owner/admin draft saves and archives must not change or hide league history. Developed rosters use league eligibility and value rules, not the builder's initial-budget check.

The existing `/leagues` landing page can become the competition list. `/leagues/[league]` already serves roster-affiliation references. Proposed competition routes use `/leagues/manage/[leagueId]`, with season and match screens beneath that namespace, preserving existing reference URLs. Official rosters should also be reachable from existing team URLs.

## Competition and roster records

These are logical records; implementation may combine small bounded records where appropriate. Histories and match events belong in indexed tables, not growing arrays.

| Record                      | Purpose                                                                                            |
| --------------------------- | -------------------------------------------------------------------------------------------------- |
| League                      | Name, commissioner ownership, optional additional officials, visibility                            |
| Season                      | Registration, starting budget, rule profile, scoring/tiebreakers and lifecycle                     |
| Entry                       | Stable coach participation and current official team career; one entry per coach per season        |
| Team career                 | Link to the existing team, official staff/treasury/roster revision and match lock                  |
| Career player               | Stable identity, position, characteristics, SPP totals, availability, death or retirement          |
| Phase and round             | Regular-season pairing format, opening state, deadlines and completion                             |
| Fixture                     | Home/away entries, round, schedule/venue and match lifecycle                                       |
| Match snapshot              | Captured players, characteristics, value, rules, staff and temporary hires at match start          |
| Match event                 | Action, author, player/counterparty, relevant turn, factual outcome, revision and retry identifier |
| Report and confirmation     | Versioned combined match summary and each coach's confirmation of that version                     |
| Progression and audit event | SPP awards/spends, injuries, purchases and reasoned administrative changes                         |
| Standings                   | Official per-entry results and TD/CAS totals, updated with official result changes                 |
| Evidence                    | Storage reference and access policy for required photos or dispute material                        |

Identity comes from the existing server authentication, never a client-supplied acting user ID or mutable Telegram username. Coach membership and commissioner authority are independent. A commissioner may also be a participant; that account still supplies only its own coach confirmation. Commissioner queries expose permitted participant information without exposing private auth records or using the site-admin user directory.

Start with one regular-season phase. Its launch freezes the participant set and generates the complete round robin once. Fixtures reference entries so an allowed team replacement updates unstarted fixtures while captured match snapshots remain intact. Prevent replacement during an active match; define first-match eligibility for exceptional administrative outcomes explicitly.

For `n` teams, generate `n(n-1)/2` fixtures. An even number needs `n-1` rounds; an odd number needs `n` rounds with one bye per team. Two coaches produce exactly one round and one fixture. Retry or concurrent launch must not duplicate fixtures. Opening a round is a commissioner action; an expired deadline creates an administrative case rather than an automatic invented result.

## Shared match workflow

1. Both coaches open their fixture. The commissioner can view it. Coaches arrange the actual time and venue through Telegram, with optional schedule details recorded in the app.
2. Starting the match checks that its round is open and neither official team has another active match. Capture each roster and rules revision and prevent conflicting career changes.
3. Both coaches can edit the same report, including either team's player totals. Both see the same live Convex report. Field patches merge against the current document so simultaneous edits to unrelated fields or counters do not overwrite each other. Caused casualties and suffered injuries are distinct counters; eligible casualties are separately identified for SPP.
4. The event types must cover the verified BB2025 SPP events, MVP and casualty outcomes. Temporary stars, inducements and journeymen have match-local identities and appropriate progression eligibility. Recording every movement or dice roll is unnecessary for this flow.
5. Complete the report and post-game facts. The report accepts a venue and an HTTPS evidence link. Edits sync automatically in the Pre-game → Game → Post-game stepper. Lock-ins acknowledge an exact persisted revision; confirmation retries do not duplicate awards. Venue-specific photo enforcement remains a later addition.
6. Both distinct coaches confirm the same combined report revision under the recommended policy. Any semantic change invalidates earlier confirmations. A disputed match remains pending until corrected or adjudicated.
7. Finalization validates the report against the captured rosters and pinned rules. One Convex transaction records the official result, credits derived SPP, applies agreed roster/economy effects, updates standings, appends audit history and advances career revisions. A repeated finalization cannot award again.
8. Coaches complete allowed post-game changes in the verified rules sequence. They can spend available SPP and make legal roster changes under the selected approval policy. The commissioner sees pending and completed changes.

If post-match totals are supported as an alternative to live logging, they must produce the same report model and replace the relevant draft totals. They must never be added on top of already recorded events as duplicate awards. Reconnection behavior should preserve unsent drafts or clearly identify unsaved work before claiming offline support.

Suggested status progression is scheduled, active, awaiting confirmation, finalized. Disputed reports and administrative outcomes need explicit branches. Byes, unplayed awards and concessions are different outcomes with separate rule handling; do not simulate all of them as ordinary scored matches.

## Player progression and rules verification

Display lifetime earned SPP, spent SPP and currently available SPP separately. Record each award and each ordered advancement, including its method, outcome, cost, value adjustment, rules revision and author. Effective characteristics include permanent changes and injuries. Death or dismissal removes availability while preserving the player and its history.

The server calculates SPP, advancement cost, eligibility, treasury and team value. Client arguments describe requested choices and observed facts; they do not supply trusted resulting balances. Check affordability, legal category access, duplicate skills, advancement limits and current career revision atomically. The free-form exhibition skill picker cannot be the spending API.

Random/chosen skill and characteristic advancements need the actual BB2025 tables and a decision about physical or digital dice. If an outcome is rolled physically, record the roll and result for review; if rolled digitally, persist one result so retries cannot reroll. The first acceptance scenario can use a chosen legal skill once its cost is verified.

Several official edition changes affect this implementation: [the BB2025 launch announcement](https://www.warhammer-community.com/en-gb/articles/gikf8db9/blood-bowl-returns-for-a-new-season-of-mayhem/) mentions SPP for throwing team-mates and being thrown; [the designer interview](https://www.warhammer-community.com/en-gb/articles/euo6nxbn/tokens-skills-and-roster-changes-whats-new-in-blood-bowl/) describes removed deflections, Arm Bar casualty SPP and Devious skill access. [May 2026 designer notes](https://www.warhammer-community.com/en-gb/articles/wqewdcvv/blood-bowl-faqs-games-designers-notes/) explain the hiring/firing sequence and the delay before replacing a dismissed positional. Consult the [official downloads](https://www.warhammer-community.com/en-gb/downloads/blood-bowl/) for the applicable errata.

The user supplied the [BB2025 League Play chapter](https://bloodbowlbase.ru/bb2025/core_rules/league_play/), [injury and casualty reference](https://bloodbowlbase.ru/bb2025/core_rules/cheat_sheet/) and [official May 2026 FAQ and errata](https://assets.warhammer-community.com/eng_20-05_blood_bowl_faq_errata-gytvlserev-ngihd3chox.pdf) as the rules authority. Implement factual tables from this chapter with the official FAQ layered on top, recording provenance and a versioned league profile. Account for team special rules such as Brawlin Brutes and Low Cost Linemen. Keep standings CAS counts distinct from SPP-eligible casualties.

Pin the factual league profile, FAQ publication and Slann roster at season start. Later commissioner-adopted updates create an explicit new profile revision; previous match snapshots retain their original inputs. Existing catalog IDs alone are insufficient if their characteristics later change. Missing-next-game recovery follows the applicable eligible-match rules and must not clear simply because a deadline passes or the team receives a bye.

## Commissioner oversight and corrections

The commissioner workspace should show entrants and roster readiness, current rounds and outstanding fixtures, active match logs, pending/disputed reports, standings, player statistics, SPP spending and all roster/treasury changes. Permit deadline changes, exceptional outcomes, withdrawals and corrections only with resource-scoped authority. Record the actor, timestamp, reason and before/after revision for administrative actions, including actions concerning the commissioner's own team.

A finalized-report correction creates a new official revision and updates standings by the changed contribution. Progression corrections must inspect later dependent events. Removing SPP already spent, winnings already used, or an injury already reflected in another played match cannot silently rewrite history.

Each official report produces an immutable `leagueMatchEvents` revision in the same transaction as its projections. A commissioner or global admin correction appends a compensating revision with a reason, reverses the previous report contribution and applies the replacement. Later player injury effects, fan progression, winnings, purchases and Expensive Mistakes are replayed from captured inputs. Valid later skills, purchases and original roster snapshots survive. Spent-SPP deficits, incompatible later participation, active-match dependencies and newly required missing treasury rolls reject the entire transaction; they must be reconciled first.

Withdrawn coaches retain completed results. Future fixtures remain visible and receive commissioner-decided outcomes. Public visibility of fixtures/stats is a league setting; private drafts and evidence require explicit access rules.

## Delivery sequence

| Delivery                                    | Concrete outcome and verification                                                                                            |
| ------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| 1. Rules and decisions                      | Resolve questions below and capture verified BB2025 league tables with provenance                                            |
| 2. Registration and official teams          | Create a league/season, commissioner self-registers, second Telegram user joins, valid rookie teams attach to existing Teams |
| 3. Phase and fixtures                       | Launch single round robin, generate exactly one two-person fixture, open rounds and show standings/deadlines                 |
| 4. Shared match and finalization            | Both coaches log/submit/confirm; result, statistics and SPP apply once; commissioner sees and can adjudicate                 |
| 5. Progression and standard team management | Spend SPP, update value, handle verified injuries/recovery, treasury, recruitment and dismissal sequence                     |
| 6. Corrections and league operations        | Audited changes, dependency cases, concessions/withdrawals, required evidence, exports and permission coverage               |

The two-person fixture-to-SPP scenario is the first end-to-end milestone. Calling the app a complete standard league manager additionally requires the ordinary pre/post-game roster and economy consequences; SPP alone does not cover a full season.

The app exposes standings, player statistics, finalized game reports and team change history so the commissioner can reconstruct an external sheet if desired. Google Sheets synchronization is outside this delivery. Telegram remains the identity and communication platform; automatic posting requires a separate instruction. Multi-format tournament engines, playoffs, Sevens, table booking, awards and multi-season redrafting can follow the standard league flow rather than expanding the first delivery.

Implementation should follow the project Convex guidelines, use validated commands and indexed/paginated queries, and keep external integrations outside result transactions. Existing Teams, authentication and translation checks must continue to pass.

## Acceptance scenario and safety checks

The following is the minimum usable test, driven with two independent Telegram accounts in separate browser sessions:

1. A creates a test league as commissioner and registers A's valid starting team. B joins and registers B's team.
2. A launches the regular-season phase and opens its first round. Both accounts see one fixture against each other; a repeated launch leaves one fixture.
3. Both open the match and fill the shared player totals. An unrelated coach cannot edit it. The commissioner sees the full report and its edit history.
4. Submit and confirm the combined report. A cannot provide B's confirmation, including when A has commissioner authority. Editing a confirmed draft requires confirmation again.
5. Finalize. Both teams' relevant stats and SPP persist after reload; standings match the final result. Retry/concurrent finalization leaves every award unchanged.
6. Give a player sufficient legitimately earned SPP in the test report for a verified chosen advancement. Spend it, verify the new skill/value and remaining balance, and see the transaction in the commissioner history. An unaffordable or foreign-player spend fails.
7. Check injuries or availability and applicable economy outcomes. Make an audited correction before either career has progressed, then test that a correction affecting already spent SPP is rejected with a dependency explanation.

Automated tests should also cover unauthorized/anonymous writes, resource scope, stale revisions, invalid player references, concurrent event retries, no partial finalization after validation failure, builder/admin bypass attempts, and archive/history preservation. Round-robin checks should cover two, six, seven and eight entrants, unique pairings, no double booking and balanced byes. Unit/Convex tests can mock identities; the manual acceptance flow must separately prove real Telegram authentication and two-session behavior.

## Initial implementation choices

The first release uses fresh rookie teams, one default BB2025 rules profile, one regular-season round-robin phase and TD difference followed by CAS difference. Preserve the original head-to-head editorial note in the source requirements, but document the implemented ordering for commissioner review. Coach and team are the combined standings row, with individual roster players shown separately.

Show Buchholz as the sum of official opponents' points and Sonneborn–Berger as opponents' points weighted by win 1 and draw 0.5. Cumulative score sums running points for each completed round, including byes; a coach's finalized result in the current round contributes immediately. Show the combined performance fraction as `(wins + 0.5 × draws) / official results`, with zero when there are no results. Label formulas in the interface. Administrative wins or draws contribute an official result and points without invented touchdowns, casualties, player appearances, SPP or finances; void fixtures contribute none.

The shared report accepts totals during or after play; entering post-match totals does not add a second set of awards. Initial SPP spending supports chosen legal skills. Physical roll outcomes can be recorded where required by the rules. Random skills, characteristic advancement, progressed-team import, wider tournament formats and season redrafting can be added through the same official career and audit model.
