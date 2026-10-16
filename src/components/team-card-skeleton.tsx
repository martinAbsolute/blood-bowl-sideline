import { Skeleton } from "./ui/skeleton";
import styles from "./team-card.module.css";

/** Shares card geometry so provider and library loading states stay in place. */
export function TeamCardSkeleton({ className = "" }: { className?: string }) {
  return (
    <div
      className={`${styles.card} ${className}`}
      data-loading
      aria-hidden="true"
    >
      <div className={styles.cardLink}>
        <div className={styles.identity}>
          <Skeleton className="h-[22px] w-14 rounded-full" />
        </div>
        <div className={styles.crest}>
          <Skeleton className="size-8" />
        </div>
        <div className={styles.heading}>
          <Skeleton className="h-6 w-4/5" />
        </div>
        <div className={styles.ruleset}>
          <Skeleton className="h-[15px] w-3/4" />
        </div>
        <div className={styles.economy}>
          {[0, 1].map((index) => (
            <div key={index}>
              <Skeleton className="h-[15px] w-16" />
              <Skeleton className={`${styles.skeletonValue} h-[1.1em] w-20`} />
            </div>
          ))}
        </div>
        <div className={`${styles.squad} ${styles.skeletonPitch}`}>
          <span className={styles.halfwayLine} />
          <div className="flex h-[62px] items-center gap-3">
            {[0, 1, 2, 3, 4].map((index) => (
              <Skeleton
                key={index}
                className={`h-9 w-6 bg-white/20 ${index % 2 === 0 ? "translate-y-3" : "-translate-y-3"}`}
              />
            ))}
          </div>
        </div>
        <div className={styles.support}>
          {[0, 1, 2, 3].map((index) => (
            <div key={index} className={styles.metric}>
              <Skeleton className="size-4" />
              <Skeleton className="h-4 w-5" />
            </div>
          ))}
        </div>
        <div className={styles.cardFooter}>
          <Skeleton className="h-3 w-24" />
          <div className={styles.actions}>
            <span className="flex size-[30px] items-center justify-center max-[720px]:size-8">
              <Skeleton className="size-4" />
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
