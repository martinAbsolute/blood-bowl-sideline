import Link from "next/link";
import { getTranslations } from "gt-next/server";
import { Button } from "@/components/ui/button";
export default async function NotFound() {
  const t = await getTranslations();
  return (
    <div className="page-width py-24">
      <p className="eyebrow">404</p>
      <h1 className="display-font mt-3 text-5xl">{t("notFound")}</h1>
      <p className="mt-4 text-muted-foreground">{t("notFoundHint")}</p>
      <Button className="mt-8" nativeButton={false} render={<Link href="/" />}>
        {t("backHome")}
      </Button>
    </div>
  );
}
