import { AlertsPanel } from "@/components/AlertsPanel";
import { computeAlerts, CADENCE_PER_28D } from "@/lib/alerts";
import { daysSince, isoDate, todayUTC } from "@/lib/dates";
import { prisma } from "@/lib/prisma";
import { loadAlertsSnapshot } from "@/lib/snapshot";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";

const QUADRANT_LABEL = {
  Q1: "Q1 · crisis",
  Q2: "Q2 · investment",
  Q3: "Q3 · interruption",
  Q4: "Q4 · waste",
} as const;

export default async function Today() {
  const now = todayUTC();
  const [snapshot, bigThree, sawPractices] = await Promise.all([
    loadAlertsSnapshot(now),
    prisma.bigThreeItem.findMany({
      where: { date: now },
      orderBy: { slot: "asc" },
      include: { role: true, outcome: true },
    }),
    prisma.sawPractice.findMany({
      orderBy: { dimension: "asc" },
      include: { sessions: true },
    }),
  ]);
  const alerts = computeAlerts(snapshot);

  const slots = [0, 1, 2].map((slot) => bigThree.find((b) => b.slot === slot) ?? null);

  return (
    <div className={styles.stack}>
      <div>
        <div className="kicker">{isoDate(now)}</div>
        <h1 className="h1">Today</h1>
      </div>

      <section>
        <span className="label">Alerts — derived, never stored</span>
        <AlertsPanel alerts={alerts} />
      </section>

      <section>
        <span className="label">Big 3</span>
        <div className={styles.bigThree}>
          {slots.map((item, slot) => (
            <div key={slot} className={`card ${styles.slot}`} data-done={item?.done ?? false}>
              <span className={styles.slotNum}>{slot + 1}</span>
              {item && item.text ? (
                <div className={styles.slotBody}>
                  <span className={styles.slotText}>{item.text}</span>
                  <span className={`sub ${styles.slotMeta}`}>
                    {item.role && (
                      <span>
                        {item.role.icon} {item.role.label}
                      </span>
                    )}
                    {item.outcome && <span>→ {item.outcome.result}</span>}
                    {item.quadrant && (
                      <span className={styles.quadrant} data-q={item.quadrant}>
                        {QUADRANT_LABEL[item.quadrant]}
                      </span>
                    )}
                  </span>
                </div>
              ) : (
                <span className={`sub ${styles.slotEmpty}`}>Not set</span>
              )}
            </div>
          ))}
        </div>
      </section>

      <section>
        <span className="label">Sharpen the Saw — last 28 days</span>
        <div className={styles.sawRow}>
          {sawPractices.map((sp) => {
            const in28 = sp.sessions.filter((x) => {
              const d = daysSince(x.date, now);
              return d >= 0 && d < 28;
            }).length;
            const expected = sp.cadence ? CADENCE_PER_28D[sp.cadence] : null;
            const doneToday = sp.sessions.some((x) => isoDate(x.date) === isoDate(now));
            return (
              <div key={sp.id} className={`card ${styles.sawCard}`}>
                <div className={styles.sawHead}>
                  <span className={styles.sawDim}>{sp.dimension.toLowerCase()}</span>
                  {sp.health && <span className={`health-${sp.health}`}>●</span>}
                </div>
                <div className={styles.sawCount}>
                  {in28}
                  {expected !== null && <span className="sub"> / {expected}</span>}
                </div>
                <div className="sub">{sp.practice || "No practice set"}</div>
                {doneToday && <div className={styles.sawToday}>✓ today</div>}
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
