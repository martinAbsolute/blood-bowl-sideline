import { LeaguesPage } from "@/components/leagues-page";
import { pageMetadata } from "@/lib/site-metadata";

export const metadata = pageMetadata(
  "Leagues",
  "/leagues",
  "Ongoing Blood Bowl leagues in the Sideline community.",
);

export default function Page() {
  return <LeaguesPage />;
}
