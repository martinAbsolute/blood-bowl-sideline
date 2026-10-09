import type { FunctionReturnType } from "convex/server";
import type { api } from "../../convex/_generated/api";
import { summarize } from "@/domain/rules";
import {
  serializeTeamStructuredData,
  teamStructuredData,
} from "./team-structured-data";

const escapeHtml = (value: string | number) =>
  String(value).replace(
    /[&<>"']/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[character]!,
  );
const amount = ({ value, unit }: { value: number; unit: string }) =>
  `${value.toLocaleString("en")} ${unit}`;
const definition = (name: string, value: string | number) =>
  `<dt>${escapeHtml(name)}</dt><dd>${escapeHtml(value)}</dd>`;
const skills = (entries: { name: string }[]) =>
  entries.map((entry) => entry.name).join(", ") || "None";

/** Complete HTML, with no streaming containers or JavaScript needed to read it. */
export function teamReaderHtml(
  data: NonNullable<FunctionReturnType<typeof api.teams.getByUuid>>,
) {
  const structured = teamStructuredData(data);
  const snapshot = structured.mainEntity.teamSnapshot;
  const playerRows = snapshot.players.map((player) => {
    const skillText = [
      `Built-in: ${skills(player.builtInSkills)}`,
      `Added: ${skills(player.addedSkills)}`,
      ...(player.captain
        ? [`Team captain: ${skills(player.captainSkills)}`]
        : []),
      ...(player.veteran ? ["Sevens veteran"] : []),
    ].join("; ");
    return `<tr><td>${player.number}</td><th scope="row">${escapeHtml(player.name || player.position.name)}</th><td>${escapeHtml(player.position.name)}</td>${Object.values(
      player.attributes,
    )
      .map((value) => `<td>${escapeHtml(value)}</td>`)
      .join(
        "",
      )}<td>${escapeHtml(skillText)}</td><td>${escapeHtml(amount(player.cost))}</td></tr>`;
  });
  const starRows = snapshot.starPlayers.map(
    (star) =>
      `<tr><td>${star.number}</td><th scope="row">${escapeHtml(star.name)}</th><td>Star player</td>${Object.values(
        star.attributes,
      )
        .map((value) => `<td>${escapeHtml(value)}</td>`)
        .join(
          "",
        )}<td>${escapeHtml(skills(star.builtInSkills))}</td><td>${escapeHtml(amount(star.cost))}</td></tr>`,
  );
  const totals = summarize(data.team);
  const treasury =
    data.draftLeagueId || data.leagueExperienced
      ? "<p>League-specific treasury allowances and current league progression are not included in this saved builder snapshot.</p>"
      : `<dl>${definition("Ruleset treasury allowance", amount({ value: totals.budget.teamBudget, unit: "gold pieces" }))}${definition("Remaining treasury", amount({ value: totals.remaining, unit: "gold pieces" }))}</dl>`;
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escapeHtml(snapshot.name)} | Blood Bowl Sideline.</title><meta name="robots" content="noindex, nofollow"><link rel="canonical" href="${escapeHtml(structured.url)}"><script id="team-structured-data" type="application/ld+json">${serializeTeamStructuredData(data)}</script></head>
<body><main><article>
<header><h1>${escapeHtml(snapshot.name)}</h1><p>Saved Blood Bowl tabletop game roster. Players are fictional game characters.</p><p>Last saved: <time datetime="${structured.dateModified}">${structured.dateModified}</time>. Revision ${snapshot.revision}.</p></header>
<section><h2>Team overview</h2><dl>${definition("Roster", snapshot.roster.name)}${definition("Ruleset", snapshot.ruleset.name)}${definition("Rules version", snapshot.rulesVersion)}${definition("Ruleset tier", snapshot.roster.tier)}${definition("Player count", snapshot.summary.playerCount)}${definition("Validation", snapshot.legal ? "Legal saved roster" : "Incomplete or invalid saved roster")}${definition("Roster affiliations", snapshot.roster.leagues.join(", "))}${definition("Special rules", snapshot.roster.specialRules.join(", ") || "None")}</dl></section>
<section><h2>Purchased players and star players</h2><table><caption>${escapeHtml(snapshot.name)} player roster</caption><thead><tr>${["Number", "Player", "Position", "Movement allowance", "Strength", "Agility", "Passing ability", "Armour value", "Skills", "Cost"].map((name) => `<th scope="col">${name}</th>`).join("")}</tr></thead><tbody>${[...playerRows, ...starRows].join("")}</tbody></table>${snapshot.summary.playerCount ? "" : "<p>No players purchased.</p>"}</section>
<section><h2>Staff</h2><dl>${snapshot.staff.map((staff) => definition(staff.name, `${staff.count}${staff.count !== staff.purchased ? ` (${staff.purchased} purchased)` : ""}; ${amount(staff.cost)}`)).join("")}</dl></section>
<section><h2>Selected inducements</h2>${snapshot.inducements.length ? `<dl>${snapshot.inducements.map((item) => definition(item.name, `${item.count}; ${amount(item.cost)}`)).join("")}</dl>` : "<p>None purchased.</p>"}</section>
<section><h2>Costs and treasury</h2><dl>${definition("Players cost", amount(snapshot.summary.playersCost))}${definition("Star players cost", amount(snapshot.summary.starPlayersCost))}${definition("Staff cost", amount(snapshot.summary.staffCost))}${definition("Inducements cost", amount(snapshot.summary.inducementsCost))}${definition("Skills cost, including star-player skill tax", amount(snapshot.summary.skillsCost))}${definition("Team value", amount(snapshot.summary.teamValue))}</dl>${treasury}<p>All costs are in-game currency. Skill costs can use gold pieces, SP or SPP depending on the ruleset.</p></section>
<footer><p><a href="${escapeHtml(structured.url)}">Open this team in Blood Bowl Sideline.</a></p></footer>
</article></main></body></html>`;
}
