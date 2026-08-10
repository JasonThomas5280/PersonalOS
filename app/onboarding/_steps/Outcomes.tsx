import { prisma } from "@/lib/prisma";
import { isoDate } from "@/lib/dates";
import shared from "../../tabs.module.css";
import { Later, Shell } from "../Shell";
import { addOutcome, removeOutcome, saveDependencies } from "../actions";
import styles from "../onboarding.module.css";

const PHASES = ["EXPLORING", "BUILDING", "TESTING", "DEPLOYING", "HYPERCARE"];

/**
 * Repeatable: add outcomes one at a time, each persisting immediately, then a
 * second pass wires dependencies once they all exist (the order seed.ts uses —
 * an outcome can't block another that doesn't exist yet).
 */
export async function OutcomesStep() {
  const [roles, outcomes, profile] = await Promise.all([
    prisma.role.findMany({ orderBy: { sortOrder: "asc" } }),
    prisma.outcome.findMany({
      orderBy: { createdAt: "asc" },
      include: {
        roles: { include: { role: true } },
        gateItems: true,
        blockedBy: true,
      },
    }),
    prisma.profile.findUnique({ where: { id: 1 } }),
  ]);

  const budget = profile ? Number(profile.capacityBudget) : 12;
  const committed = outcomes.reduce((a, o) => a + Number(o.weeklyHours ?? 0), 0);
  const over = committed > budget;

  return (
    <Shell
      slug="outcomes"
      title="Outcomes"
      lede={
        <>
          <p className={styles.body}>
            Not the five things you&apos;re juggling — start with the one you&apos;d be most upset to
            look back on and find untouched, then add the others you&apos;re genuinely carrying.
          </p>
          <p className="sub">
            An outcome serves several roles; the first one you pick counts as primary. An outcome
            serving three roles is worth more per hour than one serving a single role.
          </p>
        </>
      }
    >
      {outcomes.length > 0 && (
        <section className={shared.createCard}>
          <span className={shared.sectionLabel}>Added so far ({outcomes.length})</span>
          <div className={styles.added}>
            {outcomes.map((o) => (
              <div key={o.id} className={styles.addedRow}>
                <span>
                  <strong>{o.result}</strong>
                  <span className={styles.addedMeta}>
                    {" "}
                    · {o.phase.toLowerCase()}
                    {o.roles.length > 0 && ` · ${o.roles.map((r) => r.role.label).join(", ")}`}
                    {o.weeklyHours && ` · ${Number(o.weeklyHours)}h/wk`}
                    {o.targetDate && ` · by ${isoDate(o.targetDate)}`}
                    {o.gateItems.length > 0 && ` · ${o.gateItems.length} gate items`}
                  </span>
                </span>
                <form action={removeOutcome}>
                  <input type="hidden" name="id" value={o.id} />
                  <button type="submit" className={shared.tinyBtn}>
                    remove
                  </button>
                </form>
              </div>
            ))}
          </div>
          <div className={styles.ledgerTotal}>
            <span>Committed against a {budget}h budget</span>
            <span style={{ color: over ? "var(--red)" : "var(--green)" }}>{committed}h / wk</span>
          </div>
          {over && (
            <p className="sub" style={{ color: "var(--red)" }}>
              These already exceed your capacity budget. That&apos;s worth knowing now rather than in
              month four — either the estimates are optimistic or something has to wait.
            </p>
          )}
        </section>
      )}

      {/* Each add posts on its own so the list above re-renders with it. */}
      <form action={addOutcome} className={shared.createCard}>
        <span className={shared.sectionLabel}>Add an outcome</span>
        <div className={shared.formGrid}>
          <div className={shared.full}>
            <span className="label">Result — what specifically gets finished?</span>
            <input name="result" placeholder="Concrete enough that you'd know if it happened" />
          </div>
          <div className={shared.full}>
            <span className="label">
              Purpose — why does it matter to your soul, not your schedule?
            </span>
            <textarea
              name="purpose"
              rows={2}
              placeholder="This is the fuel. Write the version that makes your chest tighten a little."
            />
          </div>
          <div className={shared.full}>
            <span className="label">Massive action plan — the moves that get it there</span>
            <textarea name="actions" rows={3} placeholder="One per line is fine." />
          </div>
          <div className={shared.full}>
            <span className="label">Roles it serves — first pick is primary</span>
            <div className={shared.checks}>
              {roles.map((r) => (
                <label key={r.id} className={shared.chip}>
                  <input type="checkbox" name="roleSlugs" value={r.slug} />
                  {r.icon} {r.label}
                </label>
              ))}
            </div>
          </div>
          <div>
            <span className="label">Phase</span>
            <select name="phase" defaultValue="EXPLORING">
              {PHASES.map((p) => (
                <option key={p} value={p}>
                  {p.toLowerCase()}
                </option>
              ))}
            </select>
          </div>
          <div>
            <span className="label">Target date (sets the baseline)</span>
            <input type="date" name="targetDate" />
          </div>
          <div>
            <span className="label">Hours per week — honest guess</span>
            <input type="number" step="0.5" min="0" name="weeklyHours" />
          </div>
          <div>
            <label className={shared.chip}>
              <input type="checkbox" name="criticalPath" />
              On the critical path
            </label>
          </div>
          <div className={shared.full}>
            <span className="label">Go/no-go gate — one check per line</span>
            <textarea
              name="gate"
              rows={3}
              placeholder={"What has to be true before you commit\nOne per line"}
            />
          </div>
          <div className={shared.full}>
            <span className="label">Success criteria — did it actually deliver?</span>
            <textarea
              name="successCriteria"
              rows={2}
              placeholder="Distinct from the gate: the gate says you may start, this says it worked"
            />
          </div>
          <div className={shared.full}>
            <span className="label">Kill criteria — when do you stop?</span>
            <textarea
              name="killCriteria"
              rows={2}
              placeholder="Decide now, while you're calm about it"
            />
          </div>
        </div>
        <div className={shared.actionsRow}>
          <button type="submit" className="btnGhost">
            Add this outcome
          </button>
        </div>
      </form>

      {/* Second pass — only meaningful once two or more exist. */}
      <form action={saveDependencies} className={styles.form}>
        <input type="hidden" name="step" value="outcomes" />
        {outcomes.length > 1 && (
          <section className={shared.createCard}>
            <span className={shared.sectionLabel}>What blocks what</span>
            <p className="sub">
              Tick the outcomes that have to move first. This is what makes the critical path mean
              something rather than being a label.
            </p>
            {outcomes.map((o) => (
              <div key={o.id} style={{ marginBottom: 12 }}>
                <span className="label">{o.result} is blocked by…</span>
                <div className={shared.checks}>
                  {outcomes
                    .filter((c) => c.id !== o.id)
                    .map((c) => (
                      <label key={c.id} className={shared.chip}>
                        <input
                          type="checkbox"
                          name={`blockedBy-${o.id}`}
                          value={c.id}
                          defaultChecked={o.blockedBy.some((b) => b.blockingId === c.id)}
                        />
                        {c.result}
                      </label>
                    ))}
                </div>
              </div>
            ))}
          </section>
        )}

        {outcomes.length === 0 && (
          <p className={styles.empty}>
            No outcomes yet. You can skip this and add them from the Outcomes tab whenever
            you&apos;re ready.
          </p>
        )}

        <Later>
          The <strong>Outcomes</strong> tab — where you&apos;ll also set actual dates, lead time,
          hypercare exit criteria, and tick the gate off as you clear it.
        </Later>

        <div className={shared.actionsRow}>
          <button type="submit" className="btn">
            Next — renewal
          </button>
        </div>
      </form>
    </Shell>
  );
}
