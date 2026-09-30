import type { MetadataRoute } from "next";
import { rosters } from "@/domain/catalog";
import { leagues, leagueSlug } from "@/domain/team-reference";
import { isPreview, siteUrl } from "@/lib/site-metadata";

export default function sitemap(): MetadataRoute.Sitemap {
  if (isPreview) return [];
  return [
    "/teams",
    "/rosters",
    ...rosters.map(({ id }) => `/rosters/${id}`),
    ...leagues.map((name) => `/leagues/${leagueSlug(name)}`),
  ].map((path) => ({ url: new URL(path, siteUrl).href }));
}
