import { ConfirmButton } from "@/components/ConfirmButton";
import { IconSubmit, SubmitButton } from "@/components/SubmitButton";
import {
  addGateItem,
  createOutcome,
  deleteGateItem,
  deleteOutcome,
  setDependencies,
  toggleGateItem,
  updateOutcome,
} from "@/app/actions";
import { daysBetween, daysUntil, isoDate, todayUTC } from "@/lib/dates";
import { prisma } from "@/lib/prisma";
import shared from "../tabs.module.css";

export const dynamic = "force-dynamic";

const PHASES = ["EXPLORING", "BUILDING", "TESTING", "DEPLOYING", "HYPERCARE", "CLOSED"] as const;

/* The real pipeline order. Prisma's `phase: "asc"` was alphabetical, which put
   CLOSED second — above everything still in flight. */
const PHASE_ORDER: Record<string, number> = {
  DEPLOYING: 0,
  HYPERCARE: 1,
  TESTING: 2,
  BUILDING: 3,
  EXPLORING: 4,
  CLOSED: 5,
};

export default async function OutcomesPage({ searchParams }: PageProps<"/outcomes">) {
  const params = await searchParams;
  const openId = typeof params.open === "string" ? params.open : undefined;
  const now = todayUTC();
  const [rows, roles, profile] = await Promise.all([
    prisma.outcome.findMany({
      include: {
        primaryRole: true,
        roles: { include: { role: true } },
        gateItems: { orderBy: { sortOrder: "asc" } },
        blockedBy: { include: { blocking: true } },
      },
    }),
    prisma.role.findMany({ orderBy: { sortOrder: "asc" } }),
    prisma.profile.findUnique({ where: { id: 1 } }),
  ]);

  // Live work first, in pipeline order; within a phase, soonest target first.
  const outcomes = [...rows].sort((a, b) => {
    const pa = PHASE_ORDER[a.phase] ?? 9;
    const pb = PHASE_ORDER[b.phase] ?? 9;
    if (pa !== pb) return pa - pb;
    const ta = a.targetDate ? a.targetDate.getTime() : Infinity;
    const tb = b.targetDate ? b.targetDate.getTime() : Infinity;
    if (ta !== tb) return ta - tb;
    return a.createdAt.getTime() - b.createdAt.getTime();
  });

  const active = outcomes.filter((o) => o.phase !== "CLOSED");
  const committed = active.reduce((s, o) => s + (o.weeklyHours ? Number(o.weeklyHours) : 0), 0);
  const budget = profile ? Number(profile.capacityBudget) : 0;

  return (
    <div className={shared.stack}>
      <div>
        <h1 className="h1">Outcomes</h1>
        <p className="sub">
          RPM: Result · Purpose · Massive Action Plan. Phases run Exploring → Building → Testing
          → Deploying → Hypercare → Closed. Committed {committed}h of {budget}h/week
          {committed > budget && budget > 0 && (
            <span className="health-RED"> — over budget</span>
          )}
          .
        </p>
      </div>

      {outcomes.map((o) => {
        const slip =
          o.baselineDate && o.targetDate ? daysBetween(o.baselineDate, o.targetDate) : 0;
        return (
          <details
            key={o.id}
            id={o.id}
            className={`card ${shared.item}`}
            open={o.id === openId}
          >
            <summary>
              <span className={shared.title}>{o.result}</span>
              <span className={shared.meta}>
                <span className={o.phase === "DEPLOYING" || o.phase === "HYPERCARE" ? shared.chipGold : shared.chip}>
                  {o.phase.toLowerCase()}
                </span>
                {o.primaryRole && (
                  <span>
                    {o.primaryRole.icon} {o.primaryRole.label}
                  </span>
                )}
                {o.criticalPath && <span className={shared.chipRed}>critical path</span>}
                {o.targetDate && o.phase !== "CLOSED" && (
                  <span>{daysUntil(o.targetDate, now)}d to target</span>
                )}
                {slip > 0 && <span className="health-YELLOW">slip +{slip}d</span>}
                {o.weeklyHours !== null && <span>{Number(o.weeklyHours)}h/wk</span>}
              </span>
            </summary>
            <div className={shared.body}>
              <form action={updateOutcome} className={shared.formGrid}>
                <input type="hidden" name="id" value={o.id} />
                <div className={shared.full}>
                  <label className="label">Result — what specifically finishes
                  <input name="result" defaultValue={o.result} required /></label>
                </div>
                <div className={shared.full}>
                  <label className="label">Purpose — why it matters emotionally
                  <textarea name="purpose" defaultValue={o.purpose} rows={2} /></label>
                </div>
                <div className={shared.full}>
                  <label className="label">Massive action plan — one step per line
                  <textarea name="actions" defaultValue={o.actions} rows={3} /></label>
                </div>
                <div>
                  <label className="label">Phase
                  <select name="phase" defaultValue={o.phase}>
                    {PHASES.map((p) => (
                      <option key={p} value={p}>
                        {p.toLowerCase()}
                      </option>
                    ))}
                  </select></label>
                </div>
                <div>
                  <label className="label">Primary role
                  <select name="primaryRoleId" defaultValue={o.primaryRoleId ?? ""}>
                    <option value="">none</option>
                    {roles.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.icon} {r.label}
                      </option>
                    ))}
                  </select></label>
                </div>
                <div>
                  <label className="label">
                    Target date{" "}
                    {o.baselineDate && (
                      <span className="sub">(baseline {isoDate(o.baselineDate)} — fixed)</span>
                    )}
                    <input type="date" name="targetDate" defaultValue={o.targetDate ? isoDate(o.targetDate) : ""} />
                  </label>
                </div>
                <div>
                  <label className="label">Actual date
                  <input type="date" name="actualDate" defaultValue={o.actualDate ? isoDate(o.actualDate) : ""} /></label>
                </div>
                <div>
                  <label className="label">Lead time (days)
                  <input type="number" name="leadTimeDays" defaultValue={o.leadTimeDays ?? ""} /></label>
                </div>
                <div>
                  <label className="label">Weekly hours
                  <input type="number" step="0.5" name="weeklyHours" defaultValue={o.weeklyHours === null ? "" : Number(o.weeklyHours)} /></label>
                </div>
                <fieldset className={shared.full}>
                  <legend className="label">Serves roles (primary always included)</legend>
                  <div className={shared.checks}>
                    {roles.map((r) => (
                      <label key={r.id}>
                        <input
                          type="checkbox"
                          name="roleIds"
                          value={r.id}
                          defaultChecked={o.roles.some((x) => x.roleId === r.id)}
                        />
                        {r.icon} {r.label}
                      </label>
                    ))}
                  </div>
                </fieldset>
                <div className={shared.full}>
                  <label className="label">Success criteria — did it deliver (distinct from the gate)
                  <textarea name="successCriteria" defaultValue={o.successCriteria} rows={2} /></label>
                </div>
                <div>
                  <label className="label">Kill criteria — when to stop
                  <textarea name="killCriteria" defaultValue={o.killCriteria} rows={2} /></label>
                </div>
                <div>
                  <label className="label">Hypercare exit criteria
                  <textarea name="exitCriteria" defaultValue={o.exitCriteria} rows={2} /></label>
                </div>
                <div className={`${shared.full} ${shared.actionsRow}`}>
                  <label className={shared.checks}>
                    <input type="checkbox" name="criticalPath" defaultChecked={o.criticalPath} />
                    <span className="sub">critical path</span>
                  </label>
                  <SubmitButton>Save</SubmitButton>
                </div>
              </form>

              <div>
                <h2 className={shared.sectionLabel}>
                  Go/no-go gate — checklist before committing
                </h2>
                {o.gateItems.map((g) => (
                  <div key={g.id} className={shared.listRow}>
                    <form action={toggleGateItem}>
                      <input type="hidden" name="id" value={g.id} />
                      <IconSubmit
                        className={shared.tinyBtn}
                        glyph={g.met ? "✓" : "○"}
                        label={`${g.met ? "Mark not met" : "Mark met"}: ${g.text}`}
                      />
                    </form>
                    <span style={g.met ? { textDecoration: "line-through" } : undefined}>
                      {g.text}
                    </span>
                    <form action={deleteGateItem}>
                      <input type="hidden" name="id" value={g.id} />
                      <ConfirmButton
                        className={shared.dangerBtn}
                        label={`Remove gate item: ${g.text}`}
                        confirmLabel="Remove?"
                      >
                        ×
                      </ConfirmButton>
                    </form>
                  </div>
                ))}
                <form action={addGateItem} className={shared.addForm}>
                  <input type="hidden" name="outcomeId" value={o.id} />
                  <input name="text" placeholder="Add a gate item" />
                  <SubmitButton className="btnGhost">Add</SubmitButton>
                </form>
              </div>

              {/* With one outcome this rendered a heading, an empty checkbox
                  area and a live Save button. Nothing to depend on yet. */}
              {outcomes.length > 1 && (
              <fieldset>
                <legend className={shared.sectionLabel}>Depends on</legend>
                <form action={setDependencies}>
                  <input type="hidden" name="outcomeId" value={o.id} />
                  <div className={shared.checks}>
                    {outcomes
                      .filter((x) => x.id !== o.id)
                      .map((x) => (
                        <label key={x.id}>
                          <input
                            type="checkbox"
                            name="blockingIds"
                            value={x.id}
                            defaultChecked={o.blockedBy.some((d) => d.blockingId === x.id)}
                          />
                          {x.result}
                        </label>
                      ))}
                  </div>
                  <div className={shared.actionsRow} style={{ marginTop: 8 }}>
                    <SubmitButton className="btnGhost">Save dependencies</SubmitButton>
                  </div>
                </form>
              </fieldset>
              )}

              <form action={deleteOutcome}>
                <input type="hidden" name="id" value={o.id} />
                <ConfirmButton className={shared.dangerBtn} label={`Delete the outcome ${o.result}`}>
                  Delete outcome
                </ConfirmButton>
              </form>
            </div>
          </details>
        );
      })}

      {outcomes.length === 0 && (
        <div className="card" style={{ padding: 18 }}>
          <p className="sub">
            No outcomes yet. An outcome is something that <em>finishes</em> — concrete enough that
            you&apos;d know if it happened. Start with the one you&apos;d be most upset to look back
            on and find untouched, give it an honest weekly-hours estimate, and the capacity line
            above starts telling you the truth about what fits.
          </p>
        </div>
      )}

      <div className={shared.createCard}>
        <h2 className={shared.sectionLabel}>New outcome</h2>
        <form action={createOutcome} className={shared.formGrid}>
          <div className={shared.full}>
            <label className="label">Result — concrete enough that you would know it happened
            <input name="result" required /></label>
          </div>
          <div className={shared.full}>
            <label className="label">Purpose
            <textarea name="purpose" rows={2} /></label>
          </div>
          <div>
            <label className="label">Primary role
            <select name="primaryRoleId" defaultValue="">
              <option value="">none</option>
              {roles.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.icon} {r.label}
                </option>
              ))}
            </select></label>
          </div>
          <div>
            <label className="label">Target date (sets the baseline — write once)
            <input type="date" name="targetDate" /></label>
          </div>
          <div>
            <label className="label">Weekly hours
            <input type="number" step="0.5" name="weeklyHours" /></label>
          </div>
          <div>
            <label className="label">Lead time (days)
            <input type="number" name="leadTimeDays" /></label>
          </div>
          <div className={`${shared.full} ${shared.actionsRow}`}>
            <SubmitButton>Create in Exploring</SubmitButton>
          </div>
        </form>
      </div>
    </div>
  );
}
