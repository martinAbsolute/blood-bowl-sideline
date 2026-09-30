import type { Metadata } from "next";
import { Geist, Roboto_Condensed } from "next/font/google";
import { GTProvider } from "gt-next";
import getLocale from "@/getLocale";
import { Providers } from "@/components/providers";
import { SiteShell } from "@/components/site-shell";
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
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ??
      "https://blood-bowl-sideline.vercel.app",
  ),
  title: {
    default: "Blood Bowl Sideline",
    template: "%s | Blood Bowl Sideline",
  },
  description:
    "Build BB2025 teams for the Ukrainian Blood Bowl community. English and Ukrainian. Default, Matched Play, EuroBowl 2026 and World Cup 2027 v2.1.",
  openGraph: {
    type: "website",
    siteName: "Blood Bowl Sideline",
    title: "Blood Bowl Sideline",
    description:
      "Build your next Blood Bowl team. Roster planning for the Ukrainian Blood Bowl community, in English and Ukrainian.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Blood Bowl Sideline",
    description:
      "Build your next Blood Bowl team. Roster planning in English and Ukrainian.",
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang={await getLocale()}
      className={`${geistSans.variable} ${display.variable}`}
    >
      <body className="bg-background font-sans text-foreground antialiased">
        <GTProvider>
          <Providers>
            <SiteShell>{children}</SiteShell>
          </Providers>
        </GTProvider>
      </body>
    </html>
  );
}
