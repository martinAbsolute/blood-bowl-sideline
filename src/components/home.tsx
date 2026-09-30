"use client";
import { useTranslations } from "gt-next";
import Link from "next/link";
import {
  ArrowRight,
  Check,
  ClipboardList,
  Dices,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { BlurFade } from "@/components/magic-ui/blur-fade";
import { PitchArt } from "./brand";
import { RosterExplorer } from "./roster-explorer";
export function Home() {
  const t = useTranslations();
  return (
    <div className="page-width pb-20">
      <section className="hero-grid py-10 md:py-16">
        <BlurFade
          className="flex flex-col items-start justify-center"
          delay={0.1}
        >
          <Badge
            variant="outline"
            className="mb-6 gap-2 rounded-full border-primary/20 px-3 py-1.5 text-[10px] font-semibold tracking-[.14em] text-primary"
          >
            <span className="size-1.5 rounded-full bg-orange-500" />
            {t("edition")}
          </Badge>
          <h1 className="display-font max-w-2xl text-[clamp(3.5rem,7vw,6.8rem)] leading-[.94] tracking-[-.035em] text-primary">
            {t("heroTitle")}
          </h1>
          <p className="mt-6 max-w-md text-base leading-7 text-muted-foreground">
            {t("heroText")}
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button
              size="lg"
              className="h-12 rounded-full px-6"
              nativeButton={false}
              render={<Link href="/rosters" />}
            >
              {t("createTeam")}
              <ArrowRight className="size-4" />
            </Button>
            <Button
              variant="outline"
              size="lg"
              className="h-12 rounded-full px-6"
              nativeButton={false}
              render={<Link href="/rosters" />}
            >
              {t("browseRosters")}
            </Button>
          </div>
          <p className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
            <Check className="size-3 text-primary" />
            {t("noAccountNeeded")}
          </p>
        </BlurFade>
        <BlurFade delay={0.2} className="hero-art-container">
          <PitchArt />
        </BlurFade>
      </section>
      <div className="mb-14 grid grid-cols-1 gap-4 border-y border-border py-5 sm:grid-cols-3">
        {[
          { Icon: ClipboardList, value: "31", label: "rosters" },
          { Icon: ShieldCheck, value: "4", label: "rulesets" },
          { Icon: Dices, value: "BB2025", label: "teamBuilder" },
        ].map(({ Icon, value, label }) => (
          <div key={label} className="flex items-center gap-3">
            <span className="rounded-full bg-secondary p-2.5 text-primary">
              <Icon className="size-4" />
            </span>
            <span className="text-sm font-bold text-primary">{value}</span>
            <span className="text-sm text-muted-foreground">{t(label)}</span>
          </div>
        ))}
      </div>
      <section>
        <p className="eyebrow">{t("rosters")}</p>
        <h2 className="display-font mt-2 text-4xl text-primary">
          {t("rosterCount")}
        </h2>
        <p className="mb-7 mt-2 text-sm text-muted-foreground">
          {t("rosterIntro")}
        </p>
        <RosterExplorer />
      </section>
    </div>
  );
}
