import en from "./i18n/en.json";
import uk from "./i18n/uk.json";
export default async function loadDictionary(locale: string) {
  return locale.startsWith("uk") ? uk : en;
}
