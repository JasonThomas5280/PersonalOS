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

export default async function OutcomesPage() {
  const now = todayUTC();
  const [outcomes, roles, profile] = await Promise.all([
    prisma.outcome.findMany({
      orderBy: [{ phase: "asc" }, { createdAt: "asc" }],
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
          <details key={o.id} className={`card ${shared.item}`}>
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
                  <span className="label">Result — what specifically finishes</span>
                  <input name="result" defaultValue={o.result} required />
                </div>
                <div className={shared.full}>
                  <span className="label">Purpose — why it matters emotionally</span>
                  <textarea name="purpose" defaultValue={o.purpose} rows={2} />
                </div>
                <div className={shared.full}>
                  <span className="label">Massive action plan — one step per line</span>
                  <textarea name="actions" defaultValue={o.actions} rows={3} />
                </div>
                <div>
                  <span className="label">Phase</span>
                  <select name="phase" defaultValue={o.phase}>
                    {PHASES.map((p) => (
                      <option key={p} value={p}>
                        {p.toLowerCase()}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <span className="label">Primary role</span>
                  <select name="primaryRoleId" defaultValue={o.primaryRoleId ?? ""}>
                    <option value="">none</option>
                    {roles.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.icon} {r.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <span className="label">
                    Target date{" "}
                    {o.baselineDate && (
                      <span className="sub">(baseline {isoDate(o.baselineDate)} — fixed)</span>
                    )}
                  </span>
                  <input type="date" name="targetDate" defaultValue={o.targetDate ? isoDate(o.targetDate) : ""} />
                </div>
                <div>
                  <span className="label">Actual date</span>
                  <input type="date" name="actualDate" defaultValue={o.actualDate ? isoDate(o.actualDate) : ""} />
                </div>
                <div>
                  <span className="label">Lead time (days)</span>
                  <input type="number" name="leadTimeDays" defaultValue={o.leadTimeDays ?? ""} />
                </div>
                <div>
                  <span className="label">Weekly hours</span>
                  <input type="number" step="0.5" name="weeklyHours" defaultValue={o.weeklyHours === null ? "" : Number(o.weeklyHours)} />
                </div>
                <div className={shared.full}>
                  <span className="label">Serves roles (primary always included)</span>
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
                </div>
                <div className={shared.full}>
                  <span className="label">Success criteria — did it deliver (distinct from the gate)</span>
                  <textarea name="successCriteria" defaultValue={o.successCriteria} rows={2} />
                </div>
                <div>
                  <span className="label">Kill criteria — when to stop</span>
                  <textarea name="killCriteria" defaultValue={o.killCriteria} rows={2} />
                </div>
                <div>
                  <span className="label">Hypercare exit criteria</span>
                  <textarea name="exitCriteria" defaultValue={o.exitCriteria} rows={2} />
                </div>
                <div className={`${shared.full} ${shared.actionsRow}`}>
                  <label className={shared.checks}>
                    <input type="checkbox" name="criticalPath" defaultChecked={o.criticalPath} />
                    <span className="sub">critical path</span>
                  </label>
                  <button type="submit" className="btn">
                    Save
                  </button>
                </div>
              </form>

              <div>
                <span className={shared.sectionLabel}>
                  Go/no-go gate — checklist before committing
                </span>
                {o.gateItems.map((g) => (
                  <div key={g.id} className={shared.listRow}>
                    <form action={toggleGateItem}>
                      <input type="hidden" name="id" value={g.id} />
                      <button type="submit" className={shared.tinyBtn}>
                        {g.met ? "✓" : "○"}
                      </button>
                    </form>
                    <span style={g.met ? { textDecoration: "line-through" } : undefined}>
                      {g.text}
                    </span>
                    <form action={deleteGateItem}>
                      <input type="hidden" name="id" value={g.id} />
                      <button type="submit" className={shared.dangerBtn}>
                        ×
                      </button>
                    </form>
                  </div>
                ))}
                <form action={addGateItem} className={shared.addForm}>
                  <input type="hidden" name="outcomeId" value={o.id} />
                  <input name="text" placeholder="Add a gate item" />
                  <button type="submit" className="btnGhost">
                    Add
                  </button>
                </form>
              </div>

              <div>
                <span className={shared.sectionLabel}>Depends on</span>
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
                    <button type="submit" className="btnGhost">
                      Save dependencies
                    </button>
                  </div>
                </form>
              </div>

              <form action={deleteOutcome}>
                <input type="hidden" name="id" value={o.id} />
                <button type="submit" className={shared.dangerBtn}>
                  Delete outcome
                </button>
              </form>
            </div>
          </details>
        );
      })}

      <div className={shared.createCard}>
        <span className={shared.sectionLabel}>New outcome</span>
        <form action={createOutcome} className={shared.formGrid}>
          <div className={shared.full}>
            <span className="label">Result — concrete enough that you would know it happened</span>
            <input name="result" required />
          </div>
          <div className={shared.full}>
            <span className="label">Purpose</span>
            <textarea name="purpose" rows={2} />
          </div>
          <div>
            <span className="label">Primary role</span>
            <select name="primaryRoleId" defaultValue="">
              <option value="">none</option>
              {roles.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.icon} {r.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <span className="label">Target date (sets the baseline — write once)</span>
            <input type="date" name="targetDate" />
          </div>
          <div>
            <span className="label">Weekly hours</span>
            <input type="number" step="0.5" name="weeklyHours" />
          </div>
          <div>
            <span className="label">Lead time (days)</span>
            <input type="number" name="leadTimeDays" />
          </div>
          <div className={`${shared.full} ${shared.actionsRow}`}>
            <button type="submit" className="btn">
              Create in Exploring
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
