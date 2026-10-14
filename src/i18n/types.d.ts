import type en from "./en.json";
import type { AppLocale, formats } from "./config";

type CatalogMessages = {
  [
    Key in
      | "skillNames"
      | "skillDescriptions"
      | "inducementNames"
      | "inducementDescriptions"
      | "skillCategories"
      | "teamSpecialRules"
      | "issues"
      | "leagueStatus"
  ]: Record<string, string>;
};
type LeagueMessages = {
  [
    Key in
      | "errors"
      | "audit"
      | "status"
      | "stats"
      | "statDescriptions"
      | "rookieIssues"
  ]: Record<string, string>;
};

declare module "next-intl" {
  interface AppConfig {
    Locale: AppLocale;
    Messages: Omit<typeof en, keyof CatalogMessages | "leagueUi" | "leagueUx"> &
      CatalogMessages & {
        leagueUx: Omit<typeof en.leagueUx, "profileHelp"> & {
          profileHelp: Record<string, string>;
        };
        leagueUi: Omit<typeof en.leagueUi, keyof LeagueMessages> &
          LeagueMessages;
      };
    Formats: typeof formats;
  }
}
