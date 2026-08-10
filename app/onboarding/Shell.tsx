import Link from "next/link";
import { DATA_STEP_COUNT, dataStepNumber, href, prevSlug, STEPS } from "./steps";
import styles from "./onboarding.module.css";

/**
 * Sticky header with the step counter and progress bar, plus the back / skip
 * controls. Every step renders inside this so the flow reads as one thing.
 */
export function Shell({
  slug,
  title,
  lede,
  children,
}: {
  slug: string;
  title: string;
  lede?: React.ReactNode;
  children: React.ReactNode;
}) {
  const i = STEPS.findIndex((s) => s.slug === slug);
  const n = dataStepNumber(slug);
  const pct = Math.round((i / (STEPS.length - 1)) * 100);
  const back = prevSlug(slug);

  return (
    <div className={styles.wrap}>
      <div className={styles.progressBar}>
        <div className={styles.progressHead}>
          <span className="kicker">
            {n === null ? "Setup" : `Step ${n} of ${DATA_STEP_COUNT} · ${title}`}
          </span>
          {slug !== "done" && (
            <Link href={href("done")} className={styles.skipLink}>
              Skip to the end
            </Link>
          )}
        </div>
        <div className={styles.track}>
          <div className={styles.fill} style={{ width: `${pct}%` }} />
        </div>
      </div>

      <h1 className="h1">{title === "Welcome" ? "Let's set up the parts that matter." : title}</h1>
      {lede}
      {children}

      {back && (
        <div className={styles.backRow}>
          <Link href={href(back)} className="btnGhost">
            Back
          </Link>
        </div>
      )}
    </div>
  );
}

/** "Change this later:" footnote — every step says where its answers live. */
export function Later({ children }: { children: React.ReactNode }) {
  return (
    <div className={styles.later}>
      <strong>Change this later:</strong> {children}
    </div>
  );
}
