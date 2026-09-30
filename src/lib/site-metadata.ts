import type { Metadata } from "next";

export const siteName = "Blood Bowl Sideline";
export const siteUrl = new URL(
  process.env.NEXT_PUBLIC_SITE_URL || "https://blood-bowl-sideline.vercel.app",
);
export const siteDescription =
  "Your Blood Bowl hub for teams, leagues and tournaments. Build and share rosters, manage advancements and track games in English and Ukrainian.";
export const isPreview = process.env.VERCEL_ENV === "preview";
export const shareImage = {
  url: new URL("/opengraph-image.png", siteUrl).href,
  width: 1200,
  height: 630,
  alt: "Blood Bowl Sideline — orange and forest green logo on a warm cream background",
};

export function pageMetadata(
  title: string,
  path: string | undefined,
  description: string,
): Metadata {
  const shareTitle = `${title} | ${siteName}`;
  return {
    title,
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
