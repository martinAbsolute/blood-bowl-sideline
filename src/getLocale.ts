import { cookies } from "next/headers";
export default async function getLocale() {
  return (await cookies()).get("bbs_locale")?.value === "uk" ? "uk" : "en";
}
