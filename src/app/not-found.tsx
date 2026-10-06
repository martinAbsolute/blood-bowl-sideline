import Link from "next/link";
import { getTranslations } from "gt-next/server";
import { Button } from "@/components/ui/button";
import { PageStatus } from "@/components/page-status";
import { House } from "lucide-react";
export default async function NotFound() {
  const t = await getTranslations();
  return (
    <PageStatus
      code="404"
      title={t("notFound")}
      description={t("notFoundHint")}
      accent={false}
      action={
        <Button size="lg" nativeButton={false} render={<Link href="/" />}>
          <House aria-hidden="true" className="size-4" />
          {t("backHome")}
        </Button>
      }
    />
  );
}
