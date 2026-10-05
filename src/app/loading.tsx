import { InitialLoading } from "@/components/initial-loading";

// Root loading can render before the layout's translation/auth providers exist.
export default function Loading() {
  return <InitialLoading />;
}
