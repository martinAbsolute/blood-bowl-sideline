import type { Metadata } from "next";
import { Geist, Roboto_Condensed } from "next/font/google";
import { GTProvider } from "gt-next";
import { Suspense } from "react";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import {
  isPreview,
  siteDescription,
  siteName,
  siteUrl,
  shareImage,
} from "@/lib/site-metadata";
import { Providers } from "@/components/providers";
import { SiteShell } from "@/components/site-shell";
import { ShellLoading } from "@/components/loading-layouts";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const display = Roboto_Condensed({
  subsets: ["latin", "cyrillic"],
  weight: ["600", "700", "800"],
  variable: "--font-display",
});

export const metadata: Metadata = {
  metadataBase: siteUrl,
  applicationName: siteName,
  authors: [
    { name: "Martin Bahniuk", url: "https://github.com/martinAbsolute/" },
  ],
  title: {
    default: "Blood Bowl Sideline — Teams, Leagues & Tournaments",
    template: `%s | ${siteName}`,
  },
  description: siteDescription,
  robots: isPreview
    ? { index: false, follow: false }
    : { index: true, follow: true },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any", type: "image/x-icon" },
      { url: "/icon.svg", sizes: "any", type: "image/svg+xml" },
    ],
    apple: [{ url: "/apple-icon.png", sizes: "180x180", type: "image/png" }],
    shortcut: "/favicon.ico",
  },
  openGraph: {
    type: "website",
    siteName,
    title: "Blood Bowl Sideline — Teams, Leagues & Tournaments",
    description: siteDescription,
    locale: "en_US",
    alternateLocale: ["uk_UA"],
    images: [shareImage],
  },
  twitter: {
    card: "summary_large_image",
    title: "Blood Bowl Sideline — Teams, Leagues & Tournaments",
    description: siteDescription,
    images: [shareImage],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${display.variable}`}>
      <body className="bg-background font-sans text-foreground antialiased">
        <Suspense fallback={<ShellLoading />}>
          <GTProvider>
            <Providers>
              <SiteShell>{children}</SiteShell>
            </Providers>
          </GTProvider>
        </Suspense>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
