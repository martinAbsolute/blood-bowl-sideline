# Test a two-coach league

Enable [development sign-in](development-auth.md), create Dev Coach A and Dev Coach B from the account menu, and use them in separate browser profiles or switch accounts in one browser. One account is both commissioner and coach. Production uses Telegram; automated tests use distinct mocked authenticated identities.

1. Sign in with account A. In Teams, save a legal BB2025 Default rookie team: at least eleven players, no purchased skills, stars or inducements, and a captain if the roster requires one. Paid Dedicated Fans must be at most two; registration adds the initial free fan. Repeat with account B and its own team.
2. A opens `/leagues`, creates a test league with an immediate start and registers A's team. B opens the same league link and registers B's team. Registration copies an official career; subsequent builder edits must leave that career unchanged.
3. A launches the phase. The first round opens and contains one fixture, with A and B matched automatically. Refresh both browsers and check that the fixture persists.
4. Open the report from both accounts and start it. Record a 1–0 result. Give the scorer one TD and one MVP, and give an eligible opposing player one MVP. Enter each team's fan attendance roll and the Dedicated Fans progression rolls required by the win/loss. Both accounts can edit the same report during or after the tabletop game.
5. Save each section. A confirms the report. Edit a saved total from B's browser: A's confirmation must disappear. Restore and save the agreed report, then confirm from A and B. After the second confirmation, the report locks and the standings show one win, one loss and the TD totals.
6. Open the scorer's official career. On a team without Brawlin' Brutes, one TD plus MVP earns seven SPP. Choose an available primary advancement costing six SPP. Check that earned SPP remains seven, spent SPP becomes six and available SPP becomes one. The chosen skill and its displayed value increase persist after reload.
7. Complete both post-game sequences. Make any purchases before dismissals and record Expensive Mistakes dice if the remaining treasury requires them. A subsequent fixture is blocked until that career's post-game sequence is complete.
8. As commissioner, inspect standings, individual player statistics, the locked report and audit history. Export either statistics table to CSV. Confirm the history records both coaches' edits, confirmations and the SPP spend.

Use a separate test match to exercise a commissioner correction immediately after finalization, before either career progresses. A correction must include a reason, adjust player totals and score consistently, and update SPP, injuries, Dedicated Fans, winnings and standings together. After a later career action or match depends on the result, a result correction is rejected with a reconciliation explanation; interactive historical replay is outside the initial release.

During an unfinished post-game sequence, the commissioner can undo the latest advancement bought after that match. The recorded correction refunds its SPP and value increase. An advancement already captured in a subsequent match cannot be undone through this control.

For a longer test, register three coaches. Each gets one bye with no points, SPP or MNG recovery. Complete a round, then use the commissioner's controls to open the next round or extend its deadline. Resolve an unplayed fixture through the explicit commissioner outcome workflow instead of inventing a normal played report. Withdrawal retains completed match records.

The first release supports chosen skill advancements. Random skills, characteristic advancement, automated concession consequences, season redrafting and mandatory venue-specific photo validation remain outside this initial test. Evidence can be recorded as an HTTPS link.

## Verified development run — 1 October 2026

The browser test used Dev Coach A and Dev Coach B with separate legal eleven-player Human teams. A created the league and registered as commissioner and coach; B registered its own team. Launch generated one round with their fixture automatically.

Both coaches edited the same 1–0 report. Editing after B's confirmation cleared the confirmation; confirming the revised report as A and B finalized and locked it. The commissioner correction control appeared only for A. The scorer received seven SPP, bought Block for six, and retained one. Commissioner reversal refunded the advancement, recorded its reason, and the legal advancement was bought again. B received four MVP SPP. Both postgame sequences were completed with recorded Expensive Mistakes dice.

Standings showed A with three points, one win and 1:0 touchdowns, and B with zero points, one loss and 0:1 touchdowns. The league history contained report edits, confirmations, finalization, SPP advancement, commissioner reversal and both postgame completions. The official career survived reload, used readable numbered labels for unnamed players, and had no horizontal overflow at a 390px phone viewport.

Final verification passed 323 tests across 29 files (`pnpm test -- --maxWorkers=4`), TypeScript, ESLint, formatting and the production build. The built frontend was also run locally in production mode with the local opt-in variables present: the bypass status remained disabled and impersonation returned HTTP 404. Automated tests independently cover both Vercel production flags and matching preview configuration.
