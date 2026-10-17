import { TeamLibrary } from "@/components/team-library";
import { homeTitle, pageMetadata, siteDescription } from "@/lib/site-metadata";

const homeMetadata = pageMetadata("Blood Bowl Team Builder", "/", siteDescription);
export const metadata = {
  ...homeMetadata,
  title: { absolute: homeTitle },
  openGraph: { ...homeMetadata.openGraph, title: homeTitle },
  twitter: { ...homeMetadata.twitter, title: homeTitle },
};

export default function Page() {
  return <TeamLibrary />;
}
