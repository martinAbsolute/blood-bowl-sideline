import { TeamLibrary } from "@/components/team-library";
import { pageMetadata, siteDescription } from "@/lib/site-metadata";
export const metadata = pageMetadata("My teams", "/teams", siteDescription);
export default function Page() {
  return <TeamLibrary />;
}
