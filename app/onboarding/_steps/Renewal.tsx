import { prisma } from "@/lib/prisma";
import shared from "../../tabs.module.css";
import { Later, Shell } from "../Shell";
import { saveRenewal } from "../actions";
import { SAW_DIMS } from "../steps";
import { RenewalLedger } from "./RenewalLedger";
import styles from "../onboarding.module.css";

const CADENCES = [
  { value: "DAILY", label: "daily" },
  { value: "FIVE_X_WEEK", label: "5× / week" },
  { value: "THREE_X_WEEK", label: "3× / week" },
  { value: "WEEKLY", label: "weekly" },
];

/**
 * All four dimensions, each optional. The prototype pushed hard toward starting
 * one — "starting all four is how people end up with zero" — so the copy keeps
 * that steer while the form allows however many are genuinely true.
 */
export async function RenewalStep() {
  const [practices, roles, profile] = await Promise.all([
    prisma.sawPractice.findMany(),
    prisma.role.findMany({ orderBy: { sortOrder: "asc" } }),
    prisma.profile.findUnique({ where: { id: 1 } }),
  ]);
  const byDim = new Map(practices.map((p) => [p.dimension as string, p]));

  const budget = profile ? Number(profile.capacityBudget) : 12;
  const committed = [
    profile?.sleepHours,
    profile?.workHours,
    profile?.commuteHours,
    profile?.familyHours,
    profile?.householdHours,
    profile?.existingHours,
  ].reduce<number>((a, v) => a + (v === null || v === undefined ? 0 : Number(v)), 0);
  const slack = committed > 0 ? Math.max(0, 168 - committed) : null;

  return (
    <Shell
      slug="renewal"
      title="Renewal"
      lede={
        <>
          <p className={styles.body}>
            Four dimensions of renewal live in this system. Starting all four is how people end up
            with zero — if you&apos;re unsure, fill in the one most depleted right now and leave the
            others until it holds.
          </p>
          <p className="sub">
            This costs real hours, and they come out of the same slack as your outcome work. The
            ledger at the bottom keeps you honest about it.
          </p>
        </>
      }
    >
      <form action={saveRenewal} className={styles.form}>
        <input type="hidden" name="step" value="renewal" />

        <RenewalLedger slack={slack} budget={budget}>
          {SAW_DIMS.map((d) => {
            const p = byDim.get(d.key);
            return (
              <section key={d.key} className={shared.createCard}>
                <span className={shared.sectionLabel}>
                  {d.label} — {d.desc}
                </span>
                <div className={shared.formGrid}>
                  <div className={shared.full}>
                    <span className="label">The practice — leave blank to skip this one</span>
                    <input
                      name={`practice-${d.key}`}
                      data-dim={d.key}
                      data-role="practice"
                      defaultValue={p?.practice ?? ""}
                      placeholder={d.ex}
                    />
                  </div>
                  <div>
                    <span className="label">How often</span>
                    <select
                      name={`cadence-${d.key}`}
                      data-dim={d.key}
                      data-role="cadence"
                      defaultValue={p?.cadence ?? "THREE_X_WEEK"}
                    >
                      {CADENCES.map((c) => (
                        <option key={c.value} value={c.value}>
                          {c.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <span className="label">Minutes / session</span>
                    <input
                      type="number"
                      step="5"
                      min="0"
                      name={`minutes-${d.key}`}
                      data-dim={d.key}
                      data-role="minutes"
                      defaultValue={p?.sessionMinutes ?? d.defMin}
                    />
                  </div>
                  <div className={shared.full}>
                    <span className="label">
                      Minimum viable version — the bad-week floor
                    </span>
                    <input
                      name={`floor-${d.key}`}
                      defaultValue={p?.minimumViable ?? ""}
                      placeholder={d.mv}
                    />
                    <p className="sub">
                      The most important field here. A streak that survives a bad week is worth more
                      than a perfect one that breaks.
                    </p>
                  </div>
                  <div>
                    <span className="label">Floor minutes</span>
                    <input
                      type="number"
                      step="5"
                      min="0"
                      name={`floorMinutes-${d.key}`}
                      defaultValue={p?.mvMinutes ?? Math.max(5, Math.round(d.defMin / 3))}
                    />
                  </div>
                  <div>
                    <span className="label">Linked role</span>
                    <select name={`role-${d.key}`} defaultValue={""}>
                      <option value="">none</option>
                      {roles.map((r) => (
                        <option key={r.slug} value={r.slug}>
                          {r.icon} {r.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className={shared.full}>
                    <span className="label">Depletion triggers — what tells you it&apos;s slipping</span>
                    <input
                      name={`depletes-${d.key}`}
                      defaultValue={p?.depletes ?? ""}
                      placeholder="Short temper, skipping meals, checking the phone in bed"
                    />
                  </div>
                </div>
              </section>
            );
          })}
        </RenewalLedger>

        <Later>
          The <strong>Sharpen</strong> tab — add the other dimensions whenever the first is holding,
          and tick each session as you do it.
        </Later>

        <div className={shared.actionsRow}>
          <button type="submit" className="btn">
            Next — RAID
          </button>
        </div>
      </form>
    </Shell>
  );
}
