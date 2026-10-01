import { LoadingLayout } from "@/components/loading-layouts";

// Root loading can render before the layout's translation/auth providers exist.
export default function Loading() {
  return <LoadingLayout label="Loading…" />;
}
