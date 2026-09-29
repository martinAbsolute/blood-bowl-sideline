import { getTranslations } from "gt-next/server";
import { rulesets } from "@/domain/catalog";
export const metadata = { title: "Rules & sources" };
export default async function Page() {
  const t = await getTranslations();
  return (
    <div className="page-width max-w-4xl py-14">
      <p className="eyebrow">{t("rulesAsOf")}</p>
      <h1 className="display-font mt-3 text-5xl">{t("rulesSources")}</h1>
      <p className="mt-5 max-w-2xl text-sm leading-relaxed text-muted-foreground">
        {t("rulesIntro")}
      </p>
      <div className="mt-9 grid gap-4 sm:grid-cols-2">
        {rulesets.map((r, i) => (
          <article key={r.id} className="rounded-xl border bg-card p-6">
            <h2 className="display-font text-2xl">{r.name}</h2>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              {t(
                [
                  "defaultDescription",
                  "matchedDescription",
                  "euroDescription",
                  "worldDescription",
                ][i],
              )}
            </p>
          </article>
        ))}
      </div>
      <p className="mt-8 text-sm leading-relaxed text-muted-foreground">
        {t("rulesScope")}
      </p>
      <div className="mt-6 flex flex-wrap gap-5 text-sm text-primary underline underline-offset-4">
        <a href="https://bbtc.pl/" target="_blank" rel="noreferrer">
          BBTC
        </a>
        <a
          href="https://bb-rules-g2p.pages.dev/"
          target="_blank"
          rel="noreferrer"
        >
          Blood Bowl · Українські правила
        </a>
        <a href="https://www.eurobowl.eu/" target="_blank" rel="noreferrer">
          EuroBowl 2026
        </a>
      </div>
    </div>
  );
}
