import { TeamLibrary } from "@/components/team-library";
import { pageMetadata } from "@/lib/site-metadata";
export const metadata = pageMetadata(
  "Blood Bowl Team Builder",
  "/teams",
  "Build, save and share your Blood Bowl teams. Plan rosters and player advancements with BB2025 rules, in English and Ukrainian.",
);
export default function Page() {
  return <TeamLibrary />;
}
