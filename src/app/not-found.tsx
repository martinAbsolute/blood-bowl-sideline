import Link from "next/link";
import { getTranslations } from "gt-next/server";
import { Button } from "@/components/ui/button";
import { PageStatus } from "@/components/page-status";
export default async function NotFound() {
  const t = await getTranslations();
  return (
    <PageStatus
      code="404"
      title={t("notFound")}
      description={t("notFoundHint")}
      action={
        <Button nativeButton={false} render={<Link href="/" />}>
          {t("backHome")}
        </Button>
      }
    />
  );
}
