import { createRole, deleteRole, markRoleReviewed, updateRole } from "@/app/actions";
import { daysSince, isoDate, todayUTC } from "@/lib/dates";
import { prisma } from "@/lib/prisma";
import shared from "../tabs.module.css";

export const dynamic = "force-dynamic";

const ICONS = ["✝", "♥", "★", "◆", "⚡", "◉", "▲", "❋", "◈", "☗", "⬢", "✦"];

export default async function RolesPage() {
  const now = todayUTC();
  const roles = await prisma.role.findMany({
    orderBy: { sortOrder: "asc" },
    include: {
      _count: { select: { primaryOutcomes: true, raidItems: true, people: true } },
    },
  });

  return (
    <div className={shared.stack}>
      <div>
        <h1 className="h1">Roles</h1>
        <p className="sub">
          The spine. A mission here is a standing definition, not a goal — still true in ten
          years. Deleting a role never deletes what it touches; links are nulled.
        </p>
      </div>

      {roles.map((r) => (
        <details key={r.id} className={`card ${shared.item}`}>
          <summary>
            <span>{r.icon}</span>
            <span className={shared.title}>{r.label}</span>
            <span className={shared.meta}>
              {r.health && <span className={`health-${r.health}`}>● {r.health.toLowerCase()}</span>}
              <span>
                {r._count.primaryOutcomes} outcomes · {r._count.people} people ·{" "}
                {r._count.raidItems} RAID
              </span>
              <span>
                {r.lastReviewed
                  ? `reviewed ${daysSince(r.lastReviewed, now)}d ago`
                  : "never reviewed"}
              </span>
            </span>
          </summary>
          <div className={shared.body}>
            <form action={updateRole} className={shared.formGrid}>
              <input type="hidden" name="id" value={r.id} />
              <div>
                <span className="label">Label</span>
                <input name="label" defaultValue={r.label} required />
              </div>
              <div>
                <span className="label">Icon</span>
                <select name="icon" defaultValue={r.icon}>
                  {[...new Set([r.icon, ...ICONS])].map((i) => (
                    <option key={i} value={i}>
                      {i}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <span className="label">Health</span>
                <select name="health" defaultValue={r.health ?? ""}>
                  <option value="">not set</option>
                  <option value="GREEN">green</option>
                  <option value="YELLOW">yellow</option>
                  <option value="RED">red</option>
                </select>
              </div>
              <div>
                <span className="label">Review cadence</span>
                <select name="reviewCadence" defaultValue={r.reviewCadence ?? ""}>
                  <option value="">not set</option>
                  <option value="WEEKLY">weekly</option>
                  <option value="MONTHLY">monthly</option>
                  <option value="QUARTERLY">quarterly</option>
                </select>
              </div>
              <div className={shared.full}>
                <span className="label">Status note — why this color + recovery plan</span>
                <textarea name="statusNote" defaultValue={r.statusNote} rows={2} />
              </div>
              <div className={shared.full}>
                <span className="label">Mission — standing definition, not a goal</span>
                <textarea name="mission" defaultValue={r.mission} rows={2} />
              </div>
              <div className={shared.full}>
                <span className="label">Success criteria — observable, not aspirational</span>
                <textarea name="success" defaultValue={r.success} rows={2} />
              </div>
              <div className={shared.full}>
                <span className="label">Stewardship — what nobody else picks up</span>
                <textarea name="stewardship" defaultValue={r.stewardship} rows={2} />
              </div>
              <div className={shared.full}>
                <span className="label">Failure mode</span>
                <textarea name="failureMode" defaultValue={r.failureMode} rows={2} />
              </div>
              <div className={`${shared.full} ${shared.actionsRow}`}>
                <button type="submit" className="btn">
                  Save
                </button>
              </div>
            </form>
            <div className={shared.actionsRow}>
              <form action={markRoleReviewed}>
                <input type="hidden" name="id" value={r.id} />
                <button type="submit" className="btnGhost">
                  Mark reviewed {isoDate(now)}
                </button>
              </form>
              <form action={deleteRole}>
                <input type="hidden" name="id" value={r.id} />
                <button type="submit" className={shared.dangerBtn}>
                  Delete role (links are nulled, nothing cascades)
                </button>
              </form>
            </div>
          </div>
        </details>
      ))}

      <div className={shared.createCard}>
        <span className={shared.sectionLabel}>Add a role</span>
        <form action={createRole} className={shared.addForm}>
          <select name="icon" defaultValue="◈" style={{ flex: "0 0 70px" }}>
            {ICONS.map((i) => (
              <option key={i} value={i}>
                {i}
              </option>
            ))}
          </select>
          <input name="label" placeholder="Mentor, Neighbor, Son, Coach…" required />
          <button type="submit" className="btn">
            Add
          </button>
        </form>
      </div>
    </div>
  );
}
