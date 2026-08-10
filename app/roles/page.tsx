import { ConfirmButton } from "@/components/ConfirmButton";
import { SubmitButton } from "@/components/SubmitButton";
import { createRole, deleteRole, markRoleReviewed, updateRole } from "@/app/actions";
import { daysSince, isoDate, todayUTC } from "@/lib/dates";
import { prisma } from "@/lib/prisma";
import shared from "../tabs.module.css";

export const dynamic = "force-dynamic";

const ICONS = ["✝", "♥", "★", "◆", "⚡", "◉", "▲", "❋", "◈", "☗", "⬢", "✦"];

export default async function RolesPage({ searchParams }: PageProps<"/roles">) {
  const openId = typeof (await searchParams).open === "string" ? ((await searchParams).open as string) : undefined;
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
        <details key={r.id} id={r.id} open={r.id === openId} className={`card ${shared.item}`}>
          <summary>
            <span aria-hidden="true">{r.icon}</span>
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
                <label className="label">Label
                <input name="label" defaultValue={r.label} required /></label>
              </div>
              <div>
                <label className="label">Icon
                <select name="icon" defaultValue={r.icon}>
                  {[...new Set([r.icon, ...ICONS])].map((i) => (
                    <option key={i} value={i}>
                      {i}
                    </option>
                  ))}
                </select></label>
              </div>
              <div>
                <label className="label">Health
                <select name="health" defaultValue={r.health ?? ""}>
                  <option value="">not set</option>
                  <option value="GREEN">green</option>
                  <option value="YELLOW">yellow</option>
                  <option value="RED">red</option>
                </select></label>
              </div>
              <div>
                <label className="label">Review cadence
                <select name="reviewCadence" defaultValue={r.reviewCadence ?? ""}>
                  <option value="">not set</option>
                  <option value="WEEKLY">weekly</option>
                  <option value="MONTHLY">monthly</option>
                  <option value="QUARTERLY">quarterly</option>
                </select></label>
              </div>
              <div className={shared.full}>
                <label className="label">Status note — why this color + recovery plan
                <textarea name="statusNote" defaultValue={r.statusNote} rows={2} /></label>
              </div>
              <div className={shared.full}>
                <label className="label">Mission — standing definition, not a goal
                <textarea name="mission" defaultValue={r.mission} rows={2} /></label>
              </div>
              <div className={shared.full}>
                <label className="label">Success criteria — observable, not aspirational
                <textarea name="success" defaultValue={r.success} rows={2} /></label>
              </div>
              <div className={shared.full}>
                <label className="label">Stewardship — what nobody else picks up
                <textarea name="stewardship" defaultValue={r.stewardship} rows={2} /></label>
              </div>
              <div className={shared.full}>
                <label className="label">Failure mode
                <textarea name="failureMode" defaultValue={r.failureMode} rows={2} /></label>
              </div>
              <div className={`${shared.full} ${shared.actionsRow}`}>
                <SubmitButton>Save</SubmitButton>
              </div>
            </form>
            <div className={shared.actionsRow}>
              <form action={markRoleReviewed}>
                <input type="hidden" name="id" value={r.id} />
                <SubmitButton className="btnGhost">Mark reviewed {isoDate(now)}</SubmitButton>
              </form>
              <form action={deleteRole}>
                <input type="hidden" name="id" value={r.id} />
                <ConfirmButton className={shared.dangerBtn} label={`Delete the role ${r.label}`}>
                  Delete role (links are nulled, nothing cascades)
                </ConfirmButton>
              </form>
            </div>
          </div>
        </details>
      ))}

      {roles.length === 0 && (
        <div className="card" style={{ padding: 18 }}>
          <p className="sub">
            No roles yet, so nothing else in the system has anywhere to attach — outcomes, RAID
            items, people and renewal practices all tag back to one. Four to seven is the working
            range; past that the health colours stop meaning anything. Add the ones you&apos;re
            actually carrying, then give each a mission: a standing definition, not a goal.
          </p>
        </div>
      )}

      <div className={shared.createCard}>
        <h2 className={shared.sectionLabel}>Add a role</h2>
        <form action={createRole} className={shared.addForm}>
          <select name="icon" defaultValue="◈" style={{ flex: "0 0 70px" }}>
            {ICONS.map((i) => (
              <option key={i} value={i}>
                {i}
              </option>
            ))}
          </select>
          <input name="label" placeholder="Mentor, Neighbor, Son, Coach…" required />
          <SubmitButton>Add</SubmitButton>
        </form>
      </div>
    </div>
  );
}
