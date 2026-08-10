import Link from "next/link";
import { prisma } from "@/lib/prisma";
import shared from "../../tabs.module.css";
import { Shell } from "../Shell";
import { href, nextSlug } from "../steps";
import styles from "../onboarding.module.css";

/**
 * Framing screen. The prototype's "three honest things" is not decoration —
 * it is what stops the capacity step from reading as an accusation later.
 */
export async function WelcomeStep() {
  const [roleCount, outcomeCount, profile] = await Promise.all([
    prisma.role.count(),
    prisma.outcome.count(),
    prisma.profile.findUnique({ where: { id: 1 } }),
  ]);
  const hasData = roleCount > 0 || outcomeCount > 0 || Boolean(profile?.mission);

  return (
    <Shell
      slug="welcome"
      title="Welcome"
      lede={
        <>
          <p className={styles.body}>
            This system has a lot in it — outcomes with phases, a RAID log, a relational ledger,
            renewal tracking. You don&apos;t need any of that today.
          </p>
          <p className={styles.body}>
            You&apos;ll leave with a mission, your roles, an honest number for how much time you
            actually have, the outcomes you&apos;re carrying, and the people and risks already on
            your mind. Every step saves as you go, so you can stop and come back.
          </p>
        </>
      }
    >
      <section className={shared.createCard}>
        <span className={shared.sectionLabel}>Three honest things before you start</span>
        <p className="sub">
          <strong>This will show you things you&apos;d rather not see.</strong> The capacity math in
          particular tends to reveal that the plan doesn&apos;t fit. That&apos;s the feature — a
          plan that doesn&apos;t fit fails either way, and the only question is whether you find out
          now or in month four.
        </p>
        <p className="sub">
          <strong>Nothing here pays off quickly.</strong> The first stretch is foundation-laying with
          little visible change.
        </p>
        <p className="sub">
          <strong>Nothing you enter is permanent.</strong> Every answer is editable inside the app —
          each step tells you exactly where it lives. Six months from now, changing your mind is a
          two-minute job, not a rebuild.
        </p>
      </section>

      {hasData && (
        <div className={styles.note}>
          You already have data in here. Setup adds to it — it won&apos;t erase your outcomes,
          people, or history.
        </div>
      )}

      <div className={shared.actionsRow}>
        <Link href={href(nextSlug("welcome")!)} className="btn">
          Start setup
        </Link>
      </div>
    </Shell>
  );
}
