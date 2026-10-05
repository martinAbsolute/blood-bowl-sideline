# Event-based match reports

New reports started through the league UI use a shared event ledger. The timeline is also shown in Review & finances, alongside each team's earned SPP and MVP. Both coaches must confirm the same report revision. Any change clears both confirmations. Commissioners can edit the live report or stage a correction to a completed report, review its timeline, and apply it with a reason.

## What to record

| Event           | Participants                                                                           | League effect                                                    |
| --------------- | -------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| Touchdown       | Scorer                                                                                 | Score and captured roster-specific SPP                           |
| Completion      | Passer and receiving team-mate                                                         | Passer SPP; no separate catch award                              |
| Interception    | Interceptor and opposing passer                                                        | Interceptor SPP                                                  |
| Block casualty  | Causing player and opposing victim                                                     | Casualty SPP even after recovery; final injury applies to victim |
| Other casualty  | Opposing culprit for foul/special action, or injured player for crowd/dodge/rush/other | Final injury; no casualty SPP                                    |
| Throw Team-mate | Thrower and safely landed team-mate                                                    | Landing SPP; thrower SPP only for a Superb Throw                 |
| Knockout        | Removed player; optional Apothecary                                                    | Timeline only; no permanent injury or SPP                        |
| Sent off        | Removed player                                                                         | Removal record; no SPP                                           |
| MVP             | One participating player per team                                                      | MVP SPP                                                          |

Do not record routine movement, blocks without a casualty, hand-offs, ordinary catches, failed passes or stuns. They do not affect league advancement or remove a player from the match. Stalling remains a team-level financial input. Inducement purchasing and concession automation remain outside this report's scope.

For casualties, record the original modified D16, any lasting-injury D6, the Apothecary reroll and lasting-injury roll, which result the coach kept, and whether Regeneration succeeded. Successful Regeneration or an Apothecary's chosen Badly Hurt result removes lasting effects without removing the attacker's block SPP. A player can suffer another casualty after recovery, but cannot have two unrecovered casualty removals in one match. KO treatment records use of the Apothecary (Stunned on the pitch, or Reserves after a crowd injury). Getting Even rolls and chosen Hatred keywords can be recorded in the event notes; automatic trait grants are not part of this projection.

Half and turn are optional. Timed events sort into play order; untimed events retain their entry order; MVPs appear last. Corrections can change timing, participants, injury resolution or event kind, or remove an event entirely. The roster tab shows the captured match profiles, skills and derived TD/SPP alongside player availability.

## Persistence

`leaguePlayEvents` contains one bounded event per document, its client-generated id, edit version and last editor. Appends from different coaches merge transactionally. Updating/removing an event compares its version. Retrying the same operation is idempotent; deleted records retain a tombstone. Limit: 256 active events, 512 total including tombstones per match.

`projectMatchEvents` derives player contributions, score and final injury inputs. Event reports reject direct player-counter and score writes. Existing SPP rates captured with the roster remain authoritative, including Brawlin' Brutes. Official report revisions retain the complete before/after event ledger. Commissioner correction reuses the existing career, treasury and standings replay, including spent-SPP and later-availability safeguards.

All match reports use the event timeline. Scores and player statistics are derived from events; there is no totals editor or compatibility mode. Standings count only SPP-eligible casualties. Disposable data must be reset before deploying incompatible schema changes.

Rules were checked against the project's [BB2025 League Play reference](https://bloodbowlbase.ru/bb2025/core_rules/league_play/), [injury and Apothecary rules](https://bloodbowlbase.ru/bb2025/core_rules/the_game_of_blood_bowl/#apothecaries), and [official May 2026 FAQ](https://assets.warhammer-community.com/eng_20-05_blood_bowl_faq_errata-gytvlserev-ngihd3chox.pdf). See [rules provenance](league-rules-sources.md) for the existing career rules.

## Verification

- `tests/match-events.test.ts`: participant relationships, SPP allocation, recovery, lasting injuries, removals, ordering, deletion and duplicate awards.
- `tests/leagues.test.ts`, shared event reports: concurrent authenticated coaches, retry and stale-write handling, confirmation invalidation, counter bypass protection, official career and event-history correction, unauthorized/foreign-player rejection and rollback.
- `tests/league-match-render.test.ts`: event submission, review timeline, removal of total controls, and local commissioner drafts that cancel without writes.

Manual acceptance: open the same fresh development fixture in separate coach sessions. Record a TD, a completion with a named recipient, and a fatal block casualty recovered by an Apothecary. Confirm that both screens update, the attacker keeps SPP, the victim remains available, and the mobile page has no horizontal overflow. Record both MVPs and fan rolls. Confirm once, edit an event from the other session, and verify confirmation clears. Review and confirm as both coaches; check official careers. Stage and cancel a commissioner event correction, then apply one with a reason and check the retained history.
