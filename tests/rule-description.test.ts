import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { RuleDescription } from "../src/components/rule-help";
import en from "../src/i18n/en.json";
import uk from "../src/i18n/uk.json";

describe("full inducement rule formatting", () => {
  for (const dictionary of [en, uk]) {
    it("separates the wizard spells and preserves the frog profile", () => {
      const html = renderToStaticMarkup(
        createElement(RuleDescription, {
          description:
            dictionary.inducementDescriptions["wizard-sports-wizard"],
        }),
      );
      expect(html).toContain(
        '<strong class="font-semibold">Fireball:</strong>',
      );
      expect(html).toContain('<strong class="font-semibold">Zap!:</strong>');
      expect(html).toContain("</p><p");
      expect(html).toContain("MA 5, ST 1, AG 2+, PA -, AV 5+");
    });

    it("renders all sixteen Prayers to Nuffle as a numbered list", () => {
      const html = renderToStaticMarkup(
        createElement(RuleDescription, {
          description: dictionary.inducementDescriptions["prayers-to-nuffle"],
        }),
      );
      expect(html.match(/<li /g)).toHaveLength(16);
      expect(html).toContain("<ol ");
      expect(html).toContain("Treacherous Trapdoor:");
      expect(html).toContain("Intensive Training:");
    });
  }
});
