import { Fragment } from "react";
import {
  getRoster,
  getRuleset,
  inducements,
  skillName,
  sortSkillIds,
  stars,
} from "@/domain/catalog";
import {
  affiliation,
  inducementInfo,
  playerSkillCost,
  summarize,
} from "@/domain/rules";
import { specialRuleKey } from "@/domain/team-reference";
import type { Team } from "@/domain/types";
import { positionLabel } from "./position-name";

type Translate = (key: string) => string;
export type PrintOrientation = "portrait" | "landscape";
const gold = (value: number) => `${(value / 1000).toLocaleString("en")}k`;

export function printStyles(orientation: PrintOrientation) {
  return `
    @page { size: A4 ${orientation}; margin: 10mm; }
    * { box-sizing: border-box; }
    body { margin: 0; color: #000; background: #fff; font: 10pt Arial, sans-serif; }
    h1 { font: bold 20pt Georgia, serif; margin: 0 0 3mm; overflow-wrap: anywhere; }
    h2 { font-size: 11pt; margin: 0 0 3mm; }
    h3 { font-size: 9pt; margin: 0 0 2mm; border-bottom: 1px solid; padding-bottom: 1mm; }
    p { margin: 0; }
    .identity { margin-bottom: 4mm; }
    .identity p { margin-top: 1mm; }
    .summary { display: grid; align-items: start; grid-template-columns: repeat(${orientation === "portrait" ? 2 : 4}, minmax(0,1fr)); gap: 3mm; margin-bottom: 4mm; }
    .summary section { border: 1px solid; padding: 2mm; break-inside: avoid; }
    dl { margin: 0; }
    dl div { display: flex; justify-content: space-between; gap: 2mm; margin-bottom: 1mm; }
    dt, dd { margin: 0; }
    dd { text-align: right; font-variant-numeric: tabular-nums; }
    table { width: 100%; border-collapse: collapse; font-size: ${orientation === "portrait" ? "9" : "10"}pt; table-layout: fixed; }
    th, td { border: 1px solid; padding: 1.3mm; vertical-align: top; overflow-wrap: anywhere; }
    th { text-align: left; }
    .number { width: 7mm; text-align: center; }
    .position { width: ${orientation === "portrait" ? "32" : "43"}mm; }
    .stat { width: 9mm; text-align: center; white-space: nowrap; overflow-wrap: normal; }
    .cost { width: 16mm; text-align: right; }
    tr { break-inside: avoid; }
    thead { display: table-header-group; }
    .added { text-decoration: underline dashed; text-underline-offset: 2px; }
    .captain { text-decoration: underline dotted; text-underline-offset: 2px; }
    .legend, .notes { margin-top: 3mm; font-size: 9pt; white-space: pre-wrap; overflow-wrap: anywhere; }
    .reference { break-before: page; }
    .reference h2 { border-bottom: 1px solid; padding-bottom: 2mm; }
    .rules { columns: ${orientation === "portrait" ? 2 : 3}; column-gap: 5mm; font-size: 9pt; line-height: 1.3; }
    .rule { margin-bottom: 3mm; }
    .rule p { white-space: pre-wrap; overflow-wrap: anywhere; }
    .rule strong { display: block; break-after: avoid; margin-bottom: 1mm; }
  `;
}

function PrintedSkills({
  builtIn,
  added = [],
  captain = false,
  t,
}: {
  builtIn: string[];
  added?: string[];
  captain?: boolean;
  t: Translate;
}) {
  const entries = [
    ...sortSkillIds(builtIn).map((id) => ({
      name: skillName(id),
      className: undefined,
    })),
    ...sortSkillIds(added).map((id) => ({
      name: skillName(id),
      className: "added",
    })),
    ...(captain ? [{ name: t("proCaptain"), className: "captain" }] : []),
  ];
  return entries.map((entry, index) => (
    <Fragment key={`${index}-${entry.name}`}>
      {index > 0 && ", "}
      <span className={entry.className}>{entry.name}</span>
    </Fragment>
  ));
}

export function TeamPrint({ team, t }: { team: Team; t: Translate }) {
  const roster = getRoster(team.rosterId)!;
  const ruleset = getRuleset(team.rulesetId);
  const totals = summarize(team);
  const selectedStars = team.stars.flatMap(
    (id) => stars.find((star) => star.id === id) ?? [],
  );
  const selectedInducements = inducements.filter(
    (item) => team.inducements[item.id] > 0,
  );
  const specialRules = roster.specialRules.flatMap((name) =>
    name.startsWith("Favoured of") || name.startsWith("If Chaos Clash")
      ? (affiliation(team) ?? [])
      : name,
  );
  const skillIds = [
    ...new Set([
      ...team.players.flatMap((player) => [
        ...(roster.players.find((p) => p.id === player.positionId)?.skills ??
          []),
        ...player.skills,
      ]),
      ...selectedStars.flatMap((star) => star.skills),
      ...(team.captainId ? ["pro"] : []),
    ]),
  ].sort((a, b) => skillName(a).localeCompare(skillName(b)));
  const appendix = [
    ...skillIds.map((id) => ({
      name: skillName(id),
      text: t(`skillDescriptions.${id.split(":")[0]}`),
    })),
    ...specialRules.map((name) => ({
      name,
      text: t(`teamSpecialRules.${specialRuleKey(name)}`),
    })),
    ...selectedInducements.map((item) => ({
      name: item.name,
      text: t(`inducementDescriptions.${item.id}`),
    })),
    ...Object.entries(team.staff)
      .filter(([, count]) => count > 0)
      .map(([key]) => ({ name: t(key), text: t(`staffDescriptions.${key}`) })),
  ];
  return (
    <>
      <section className="roster-sheet">
        <header className="identity">
          <h1>{team.name || t("untitled")}</h1>
          <p>
            {roster.name} · {ruleset.name} · {t("tier")} {totals.tier}
          </p>
          {team.coach && (
            <p>
              {t("coachName")}: {team.coach}
            </p>
          )}
        </header>
        <div className="summary">
          <section>
            <h3>{t("staff")}</h3>
            <dl>
              {Object.entries(team.staff).map(([key, count]) => (
                <div key={key}>
                  <dt>{t(key)}</dt>
                  <dd>{count}</dd>
                </div>
              ))}
            </dl>
          </section>
          <section>
            <h3>{t("inducements")}</h3>
            <dl>
              {selectedInducements.map((item) => (
                <div key={item.id}>
                  <dt>
                    {team.inducements[item.id]} × {item.name}
                  </dt>
                  <dd>
                    {gold(
                      inducementInfo(team, item).cost *
                        team.inducements[item.id],
                    )}
                  </dd>
                </div>
              ))}
              {!selectedInducements.length && <p>—</p>}
            </dl>
          </section>
          <section>
            <h3>{t("specialRules")}</h3>
            {specialRules.map((name) => (
              <p key={name}>{name}</p>
            ))}
          </section>
          <section>
            <h3>{t("summary")}</h3>
            <dl>
              {[
                [t("players"), gold(totals.players + totals.starGold)],
                [t("staff"), gold(totals.staff)],
                [t("inducements"), gold(totals.inducements)],
                [
                  t("skills"),
                  ruleset.skillCurrency
                    ? `${totals.skills} ${ruleset.skillCurrency.toUpperCase()}`
                    : gold(totals.skills),
                ],
                [t("teamValue"), `${gold(totals.teamGold)} GP`],
                [t("remaining"), `${gold(totals.remaining)} GP`],
              ].map(([label, value]) => (
                <div key={label}>
                  <dt>{label}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
          </section>
        </div>
        <table>
          <thead>
            <tr>
              <th className="number">#</th>
              <th className="position">{t("position")}</th>
              {["MA", "ST", "AG", "PA", "AV"].map((stat) => (
                <th className="stat" key={stat}>
                  {stat}
                </th>
              ))}
              <th>{t("skills")}</th>
              <th className="cost">{t("cost")}</th>
            </tr>
          </thead>
          <tbody>
            {team.players.map((player, index) => {
              const position = roster.players.find(
                (p) => p.id === player.positionId,
              )!;
              const cost =
                position.cost +
                (ruleset.id === "bb2025-default"
                  ? playerSkillCost(team, position, player.skills)
                  : 0);
              return (
                <tr key={player.id}>
                  <td className="number">{index + 1}</td>
                  <td>
                    {positionLabel(position.position)}
                    {player.name && <div>{player.name}</div>}
                  </td>
                  {[
                    position.ma,
                    position.st,
                    position.ag,
                    position.pa,
                    position.av,
                  ].map((stat, i) => (
                    <td className="stat" key={i}>
                      {stat}
                    </td>
                  ))}
                  <td>
                    <PrintedSkills
                      builtIn={position.skills}
                      added={player.skills}
                      captain={team.captainId === player.id}
                      t={t}
                    />
                  </td>
                  <td className="cost">{gold(cost)}</td>
                </tr>
              );
            })}
            {selectedStars.map((star, index) => (
              <tr key={star.id}>
                <td className="number">{team.players.length + index + 1}</td>
                <td>{star.name}</td>
                {[star.ma, star.st, star.ag, star.pa, star.av].map(
                  (stat, i) => (
                    <td className="stat" key={i}>
                      {stat}
                    </td>
                  ),
                )}
                <td>
                  <PrintedSkills builtIn={star.skills} t={t} />
                </td>
                <td className="cost">{gold(star.cost)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="legend">
          {t("builtInSkills")} ·{" "}
          <span className="added">{t("addedSkills")}</span> ·{" "}
          <span className="captain">{t("proCaptain")}</span>
        </p>
        {team.notes && (
          <p className="notes">
            {t("notes")}: {team.notes}
          </p>
        )}
      </section>
      <section className="reference">
        <h2>{t("printRules")}</h2>
        <div className="rules">
          {appendix.map((rule) => (
            <article className="rule" key={rule.name}>
              <strong>{rule.name}</strong>
              <p>{rule.text}</p>
            </article>
          ))}
        </div>
      </section>
    </>
  );
}

export async function printTeam(
  team: Team,
  orientation: PrintOrientation,
  t: Translate,
  locale: string,
) {
  const { renderToStaticMarkup } = await import("react-dom/server");
  // This is a standalone iframe document, outside Next.js's page and head manager.
  const markup = renderToStaticMarkup(
    <html lang={locale}>
      {/* eslint-disable-next-line @next/next/no-head-element */}
      <head>
        <meta charSet="utf-8" />
        <title>{team.name}</title>
        <style>{printStyles(orientation)}</style>
      </head>
      <body>
        <TeamPrint team={team} t={t} />
      </body>
    </html>,
  );
  const frame = document.createElement("iframe");
  frame.title = t("print");
  frame.style.cssText =
    "position:fixed;left:-10000px;top:0;width:1px;height:1px;border:0";
  await new Promise<void>((resolve, reject) => {
    frame.onload = () => {
      try {
        const target = frame.contentWindow;
        if (!target) throw new Error("Print window unavailable");
        target.addEventListener("afterprint", () => frame.remove(), {
          once: true,
        });
        target.focus();
        target.print();
        resolve();
      } catch (error) {
        frame.remove();
        reject(error);
      }
    };
    frame.onerror = () => {
      frame.remove();
      reject(new Error("Print document unavailable"));
    };
    frame.srcdoc = `<!doctype html>${markup}`;
    document.body.append(frame);
  });
}
