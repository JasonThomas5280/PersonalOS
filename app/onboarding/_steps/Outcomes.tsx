import { SubmitButton } from "@/components/SubmitButton";
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
          <h2 className={shared.sectionLabel}>Added so far ({outcomes.length})</h2>
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
                  <SubmitButton className={shared.tinyBtn} pendingLabel="…">remove</SubmitButton>
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
        <h2 className={shared.sectionLabel}>Add an outcome</h2>
        <div className={shared.formGrid}>
          <div className={shared.full}>
            <label className="label">Result — what specifically gets finished?
            <input name="result" placeholder="Concrete enough that you'd know if it happened" /></label>
          </div>
          <div className={shared.full}>
            <label className="label">
              Purpose — why does it matter to your soul, not your schedule?
            
            <textarea
              name="purpose"
              rows={2}
              placeholder="This is the fuel. Write the version that makes your chest tighten a little."
            /></label>
          </div>
          <div className={shared.full}>
            <label className="label">Massive action plan — the moves that get it there
            <textarea name="actions" rows={3} placeholder="One per line is fine." /></label>
          </div>
          <fieldset className={shared.full}>
            <legend className="label">Roles it serves — first pick is primary</legend>
            <div className={shared.checks}>
              {roles.map((r) => (
                <label key={r.id} className={shared.chip}>
                  <input type="checkbox" name="roleSlugs" value={r.slug} />
                  <span aria-hidden="true">{r.icon}</span> {r.label}
                </label>
              ))}
            </div>
          </fieldset>
          <div>
            <label className="label">Phase
            <select name="phase" defaultValue="EXPLORING">
              {PHASES.map((p) => (
                <option key={p} value={p}>
                  {p.toLowerCase()}
                </option>
              ))}
            </select></label>
          </div>
          <div>
            <label className="label">Target date (sets the baseline)
            <input type="date" name="targetDate" /></label>
          </div>
          <div>
            <label className="label">Hours per week — honest guess
            <input type="number" step="0.5" min="0" name="weeklyHours" /></label>
          </div>
          <div>
            <label className={shared.chip}>
              <input type="checkbox" name="criticalPath" />
              On the critical path
            </label>
          </div>
          <div className={shared.full}>
            <label className="label">Go/no-go gate — one check per line
            <textarea
              name="gate"
              rows={3}
              placeholder={"What has to be true before you commit\nOne per line"}
            /></label>
          </div>
          <div className={shared.full}>
            <label className="label">Success criteria — did it actually deliver?
            <textarea
              name="successCriteria"
              rows={2}
              placeholder="Distinct from the gate: the gate says you may start, this says it worked"
            /></label>
          </div>
          <div className={shared.full}>
            <label className="label">Kill criteria — when do you stop?
            <textarea
              name="killCriteria"
              rows={2}
              placeholder="Decide now, while you're calm about it"
            /></label>
          </div>
        </div>
        <div className={shared.actionsRow}>
          <SubmitButton className="btnGhost">Add this outcome</SubmitButton>
        </div>
      </form>

      {/* Second pass — only meaningful once two or more exist. */}
      <form action={saveDependencies} className={styles.form}>
        <input type="hidden" name="step" value="outcomes" />
        {outcomes.length > 1 && (
          <section className={shared.createCard}>
            <h2 className={shared.sectionLabel}>What blocks what</h2>
            <p className="sub">
              Tick the outcomes that have to move first. This is what makes the critical path mean
              something rather than being a label.
            </p>
            {outcomes.map((o) => (
              <fieldset key={o.id} style={{ marginBottom: 12 }}>
                <legend className="label">{o.result} is blocked by…</legend>
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
              </fieldset>
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
          <SubmitButton>Next — renewal</SubmitButton>
        </div>
      </form>
    </Shell>
  );
}
