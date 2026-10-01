import { UsersPage } from "@/components/users-page";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Users",
  robots: { index: false, follow: false },
};

export default function Page() {
  return <UsersPage />;
}
