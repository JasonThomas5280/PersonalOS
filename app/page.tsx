import Link from "next/link";
import { redirect } from "next/navigation";
import { saveBigThree, toggleBigThreeDone, toggleSawSession } from "@/app/actions";
import { AlertsPanel } from "@/components/AlertsPanel";
import { CoachPanel } from "@/components/CoachPanel";
import { computeAlerts, CADENCE_PER_28D } from "@/lib/alerts";
import { daysSince, isoDate, todayUTC } from "@/lib/dates";
import { prisma } from "@/lib/prisma";
import { loadAlertsSnapshot } from "@/lib/snapshot";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";

export default async function Today() {
  // First run: empty system → onboarding.
  const [profileCount, roleCount, profile] = await Promise.all([
    prisma.profile.count(),
    prisma.role.count(),
    prisma.profile.findUnique({ where: { id: 1 }, select: { onboardedAt: true } }),
  ]);
  if (profileCount === 0 && roleCount === 0) redirect("/onboarding");
  // Onboarding persists per step, so a half-finished setup leaves the system
  // non-empty and the redirect above stops firing. Offer the way back instead
  // of hijacking navigation — the data that is here is still usable.
  const setupIncomplete = profile?.onboardedAt == null;

  const now = todayUTC();
  const [snapshot, bigThree, sawPractices, roles, outcomes] = await Promise.all([
    loadAlertsSnapshot(now),
    prisma.bigThreeItem.findMany({ where: { date: now }, orderBy: { slot: "asc" } }),
    prisma.sawPractice.findMany({ orderBy: { dimension: "asc" }, include: { sessions: true } }),
    prisma.role.findMany({ orderBy: { sortOrder: "asc" } }),
    prisma.outcome.findMany({ where: { phase: { not: "CLOSED" } }, orderBy: { createdAt: "asc" } }),
  ]);
  const alerts = computeAlerts(snapshot);
  const slots = [0, 1, 2].map((slot) => bigThree.find((b) => b.slot === slot) ?? null);
  const filled = slots.filter((s) => s?.text).length;
  const q2Count = slots.filter((s) => s?.text && s.quadrant === "Q2").length;

  return (
    <div className={styles.stack}>
      <div>
        <div className="kicker">{isoDate(now)}</div>
        <h1 className="h1">Today</h1>
      </div>

      {setupIncomplete && (
        <Link href="/onboarding" className={styles.resumeBanner}>
          <strong>Setup isn&apos;t finished.</strong> Pick up where you left off — it adds to
          what&apos;s already here rather than replacing it.
        </Link>
      )}

      <section>
        <h2 className="label">Alerts — derived, never stored</h2>
        <AlertsPanel alerts={alerts} />
      </section>

      <section>
        <h2 className="label">Coach — a readout over everything above</h2>
        <CoachPanel />
      </section>

      <section>
        {/* Q2 is the whole Covey thesis and was previously only visible by
            reading three selects, or as prose in the alerts list. */}
        <h2 className="label">
          Big 3 — three moves that build, not just react
          {filled > 0 && (
            <span className={q2Count === 0 ? "health-RED" : "health-GREEN"}>
              {" "}
              · {q2Count} of {filled} in Q2
            </span>
          )}
        </h2>
        <div className={styles.bigThree}>
          {slots.map((item, slot) => (
            <div key={slot} className={`card ${styles.slot}`} data-done={item?.done ?? false}>
              <form action={toggleBigThreeDone} className={styles.doneForm}>
                <input type="hidden" name="date" value={isoDate(now)} />
                <input type="hidden" name="slot" value={slot} />
                <button
                  type="submit"
                  className={styles.doneBtn}
                  data-done={item?.done ?? false}
                  disabled={!item?.text}
                  aria-label={item?.done ? "Mark not done" : "Mark done"}
                >
                  {item?.done ? "✓" : ""}
                </button>
              </form>
              <form action={saveBigThree} className={styles.slotForm}>
                <input type="hidden" name="date" value={isoDate(now)} />
                <input type="hidden" name="slot" value={slot} />
                <input
                  name="text"
                  defaultValue={item?.text ?? ""}
                  placeholder={`Priority ${slot + 1}`}
                  className={styles.slotInput}
                />
                <div className={styles.slotControls}>
                  <select name="roleId" defaultValue={item?.roleId ?? ""}>
                    <option value="">no role</option>
                    {roles.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.icon} {r.label}
                      </option>
                    ))}
                  </select>
                  <select name="outcomeId" defaultValue={item?.outcomeId ?? ""}>
                    <option value="">no outcome</option>
                    {outcomes.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.result}
                      </option>
                    ))}
                  </select>
                  <select name="quadrant" defaultValue={item?.quadrant ?? ""}>
                    <option value="">quadrant</option>
                    <option value="Q1">Q1 · crisis</option>
                    <option value="Q2">Q2 · investment</option>
                    <option value="Q3">Q3 · interruption</option>
                    <option value="Q4">Q4 · waste</option>
                  </select>
                  <button type="submit" className="btnGhost">
                    Save
                  </button>
                </div>
              </form>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="label">Sharpen the Saw — last 28 days</h2>
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
                <form action={toggleSawSession}>
                  <input type="hidden" name="practiceId" value={sp.id} />
                  <button type="submit" className={styles.sawLog} data-done={doneToday}>
                    {doneToday ? "✓ practiced today" : "Log today"}
                  </button>
                </form>
              </div>
            );
          })}
        </div>
        {sawPractices.length === 0 && (
          <div className="sub">No practices yet — set them up in the Sharpen tab.</div>
        )}
      </section>
    </div>
  );
}
