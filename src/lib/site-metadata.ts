import type { Metadata } from "next";

export const siteName = "Blood Bowl Sideline.";
export const siteUrl = new URL(
  process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : "https://sideline.com.ua",
);
export const siteDescription =
  "Build, save and share your Blood Bowl teams. Plan rosters and player advancements with BB2025 rules.";
export const isPreview = process.env.VERCEL_ENV === "preview";
export const shareImage = {
  url: new URL("/opengraph-image.png", siteUrl).href,
  width: 1200,
  height: 630,
  alt: "Blood Bowl Sideline. — orange and forest green logo on a warm cream background",
};

export const homeTitle = `${siteName} Blood Bowl Team Builder`;

export function pageTitle(title: string) {
  return `${title.trim().replace(/[.。]+$/, "")}. ${siteName}`;
}

export function pageMetadata(
  title: string,
  path: string | undefined,
  description: string,
): Metadata {
  const shareTitle = pageTitle(title);
  return {
    title: title.trim().replace(/[.。]+$/, ""),
    description,
    ...(path ? { alternates: { canonical: path } } : {}),
    openGraph: {
      type: "website",
      siteName,
      title: shareTitle,
      description,
      url: path,
      locale: "en_US",
      alternateLocale: ["uk_UA"],
      images: [shareImage],
    },
    twitter: {
      card: "summary_large_image",
      title: shareTitle,
      description,
      images: [shareImage],
    },
  };
}
