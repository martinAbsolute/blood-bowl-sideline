import type { MetadataRoute } from "next";
import { siteDescription, siteName } from "@/lib/site-metadata";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: siteName,
    short_name: "Sideline",
    description: siteDescription,
    start_url: "/teams",
    scope: "/",
    display: "standalone",
    background_color: "#F6F4ED",
    theme_color: "#26362E",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
    ],
  };
}
