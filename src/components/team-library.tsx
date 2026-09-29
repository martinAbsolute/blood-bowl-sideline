"use client";
import { useRef, useState, useSyncExternalStore } from "react";
import { useTranslations } from "gt-next";
import { useConvexAuth, useMutation, usePaginatedQuery } from "convex/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api } from "../../convex/_generated/api";
import { getRoster, getRuleset } from "@/domain/catalog";
import { validateTeam } from "@/domain/rules";
import { teamSchema, type Team } from "@/domain/types";
import { parseDrafts, removeDraft, storeDraft } from "@/lib/drafts";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import {
  Plus,
  Upload,
  Archive,
  ArrowUpRight,
  Trash2,
  Undo2,
} from "lucide-react";
import { LoginButton } from "./site-shell";
import { toast } from "sonner";
const subscribe = (cb: () => void) => {
  window.addEventListener("bbs-drafts-changed", cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener("bbs-drafts-changed", cb);
    window.removeEventListener("storage", cb);
  };
};
const snapshot = () => {
  try {
    return localStorage.getItem("bbsideline:drafts:v1") ?? "[]";
  } catch {
    return "[]";
  }
};
export function TeamLibrary() {
  const t = useTranslations(),
    router = useRouter(),
    input = useRef<HTMLInputElement>(null),
    { isAuthenticated, isLoading } = useConvexAuth();
  const [archived, setArchived] = useState(false),
    archive = useMutation(api.teams.setArchived);
  const { results, status, loadMore } = usePaginatedQuery(
    api.teams.listMine,
    isAuthenticated ? { archived } : "skip",
    { initialNumItems: 12 },
  );
  const raw = useSyncExternalStore(subscribe, snapshot, () => "[]");
  const locals: Team[] = parseDrafts(raw);
  async function importFile(file: File | undefined) {
    if (!file) return;
    try {
      if (file.size > 100000) throw new Error();
      const parsed = teamSchema.parse(JSON.parse(await file.text()));
      if (!getRoster(parsed.rosterId)) throw new Error();
      const team = { ...parsed, uuid: crypto.randomUUID() };
      storeDraft(team);
      router.push(`/builder?draft=${team.uuid}`);
    } catch {
      toast.error(t("invalidImport"));
    } finally {
      if (input.current) input.current.value = "";
    }
  }
  return (
    <div className="page-width py-12">
      <div className="mb-9 flex flex-wrap justify-between gap-5">
        <div>
          <p className="eyebrow">BLOOD BOWL SIDELINE</p>
          <h1 className="display-font mt-2 text-5xl">{t("myTeams")}</h1>
          <p className="mt-3 text-sm text-muted-foreground">
            {t("teamsIntro")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <input
            className="hidden"
            ref={input}
            type="file"
            accept="application/json,.json"
            onChange={(e) => void importFile(e.target.files?.[0])}
          />
          <Button variant="outline" onClick={() => input.current?.click()}>
            <Upload className="size-4" />
            {t("import")}
          </Button>
          <Button asChild>
            <Link href="/rosters">
              <Plus className="size-4" />
              {t("createTeam")}
            </Link>
          </Button>
        </div>
      </div>
      <section className="mb-12">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="section-title">{t("accountTeams")}</h2>
          {isAuthenticated && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setArchived(!archived)}
            >
              <Archive className="size-4" />
              {t(archived ? "accountTeams" : "archivedTeams")}
            </Button>
          )}
        </div>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">{t("loading")}</p>
        ) : !isAuthenticated ? (
          <div className="flex flex-col items-start justify-between gap-4 rounded-xl border bg-secondary/60 p-6 sm:flex-row sm:items-center">
            <p className="max-w-xl text-sm text-muted-foreground">
              {t("guestText")}
            </p>
            <LoginButton />
          </div>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {results.map((result) => (
                <TeamCard
                  key={result.team.uuid}
                  team={result.team}
                  legal={result.legal}
                  href={archived ? undefined : `/teams/${result.team.uuid}`}
                  action={
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={t(archived ? "restore" : "archive")}
                      onClick={() =>
                        void archive({
                          uuid: result.team.uuid,
                          archived: !archived,
                        }).catch(() => toast.error(t("saveFailed")))
                      }
                    >
                      {archived ? (
                        <Undo2 className="size-4" />
                      ) : (
                        <Archive className="size-4" />
                      )}
                    </Button>
                  }
                />
              ))}
            </div>
            {status === "LoadingFirstPage" ? (
              <p className="py-6 text-muted-foreground">{t("loading")}</p>
            ) : (
              results.length === 0 && (
                <p className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground">
                  {t("noTeamsHint")}
                </p>
              )
            )}
            {status === "CanLoadMore" && (
              <Button
                className="mt-5"
                variant="outline"
                onClick={() => loadMore(12)}
              >
                {t("loadMore")}
              </Button>
            )}
          </>
        )}
      </section>
      <section>
        <h2 className="section-title mb-5">{t("localDrafts")}</h2>
        {locals.length ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {locals.map((team) => (
              <TeamCard
                key={team.uuid}
                team={team}
                legal={validateTeam(team).valid}
                href={`/builder?draft=${team.uuid}`}
                action={
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`${t("remove")} ${team.name}`}
                    onClick={() => {
                      try {
                        removeDraft(team.uuid);
                      } catch {
                        toast.error(t("storageError"));
                      }
                    }}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                }
              />
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed py-12 text-center">
            <h3 className="display-font text-3xl">{t("noTeams")}</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              {t("noTeamsHint")}
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
function TeamCard({
  team,
  legal,
  href,
  action,
}: {
  team: Team;
  legal: boolean;
  href?: string;
  action: React.ReactNode;
}) {
  const t = useTranslations();
  return (
    <article className="rounded-xl border bg-card p-5 transition-shadow hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <p className="eyebrow">{getRoster(team.rosterId)?.name}</p>
        {action}
      </div>
      {href ? (
        <Link href={href} className="group mt-1 block">
          <h3 className="display-font flex items-center justify-between text-2xl">
            {team.name}
            <ArrowUpRight className="size-4 text-muted-foreground transition-transform group-hover:-translate-y-0.5" />
          </h3>
          <p className="mt-2 text-xs text-muted-foreground">
            {getRuleset(team.rulesetId).name}
          </p>
          <div className="mt-5 flex gap-2">
            <Badge variant="secondary">
              {team.players.length + team.stars.length}/16 {t("players")}
            </Badge>
            <Badge
              variant="outline"
              className={legal ? "text-emerald-700" : "text-muted-foreground"}
            >
              {t(legal ? "ready" : "draft")}
            </Badge>
          </div>
        </Link>
      ) : (
        <div className="mt-1">
          <h3 className="display-font text-2xl">{team.name}</h3>
          <p className="mt-2 text-xs text-muted-foreground">
            {getRuleset(team.rulesetId).name}
          </p>
          <Badge variant="secondary" className="mt-5">
            {t("archivedTeams")}
          </Badge>
        </div>
      )}
    </article>
  );
}
