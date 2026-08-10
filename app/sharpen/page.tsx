import { toggleSawSession, updateSawPractice } from "@/app/actions";
import { CADENCE_PER_28D } from "@/lib/alerts";
import { daysSince, isoDate, todayUTC } from "@/lib/dates";
import { prisma } from "@/lib/prisma";
import type { SawDimension } from "@prisma/client";
import shared from "../tabs.module.css";

export const dynamic = "force-dynamic";

const DIMS: Array<{ key: SawDimension; label: string; desc: string }> = [
  { key: "PHYSICAL", label: "Physical", desc: "Sleep, movement, food" },
  { key: "MENTAL", label: "Mental", desc: "Learning not in service of a deliverable" },
  { key: "SPIRITUAL", label: "Spiritual", desc: "What reconnects you to the why" },
  { key: "SOCIAL", label: "Social / Emotional", desc: "Relationships fed for their own sake" },
];
const CADENCES = ["DAILY", "FIVE_X_WEEK", "THREE_X_WEEK", "WEEKLY", "BIWEEKLY"] as const;

export default async function SharpenPage() {
  const now = todayUTC();
  const [practices, roles] = await Promise.all([
    prisma.sawPractice.findMany({ include: { sessions: { orderBy: { date: "desc" } } } }),
    prisma.role.findMany({ orderBy: { sortOrder: "asc" } }),
  ]);
  const byDim = new Map(practices.map((p) => [p.dimension, p]));

  return (
    <div className={shared.stack}>
      <div>
        <h1 className="h1">Sharpen the Saw</h1>
        <p className="sub">
          Hypercare for yourself. The minimum viable version is the bad-week floor — a streak
          that survives a bad week beats a perfect one that breaks.
        </p>
      </div>

      {DIMS.map((dim) => {
        const p = byDim.get(dim.key);
        const in28 = p
          ? p.sessions.filter((x) => {
              const d = daysSince(x.date, now);
              return d >= 0 && d < 28;
            }).length
          : 0;
        const expected = p?.cadence ? CADENCE_PER_28D[p.cadence] : null;
        const doneToday = p?.sessions.some((x) => isoDate(x.date) === isoDate(now)) ?? false;
        return (
          <details key={dim.key} className={`card ${shared.item}`}>
            <summary>
              <span className={shared.title}>{dim.label}</span>
              <span className={shared.meta}>
                {p?.health && <span className={`health-${p.health}`}>●</span>}
                <span>
                  {in28}
                  {expected !== null ? ` / ${expected}` : ""} sessions in 28d
                </span>
                {p?.practice ? <span>{p.practice}</span> : <span>not set up</span>}
              </span>
            </summary>
            <div className={shared.body}>
              <div className={shared.actionsRow}>
                {p && (
                  <form action={toggleSawSession}>
                    <input type="hidden" name="practiceId" value={p.id} />
                    <button type="submit" className={doneToday ? "btnGhost" : "btn"}>
                      {doneToday ? "✓ practiced today — undo" : "Log a session today"}
                    </button>
                  </form>
                )}
                <span className="sub">{dim.desc}</span>
              </div>
              <form action={updateSawPractice} className={shared.formGrid}>
                <input type="hidden" name="dimension" value={dim.key} />
                <div className={shared.full}>
                  <span className="label">The practice</span>
                  <input name="practice" defaultValue={p?.practice ?? ""} />
                </div>
                <div className={shared.full}>
                  <span className="label">Minimum viable version — the bad-week floor</span>
                  <input name="minimumViable" defaultValue={p?.minimumViable ?? ""} />
                </div>
                <div>
                  <span className="label">Cadence</span>
                  <select name="cadence" defaultValue={p?.cadence ?? ""}>
                    <option value="">not set</option>
                    {CADENCES.map((c) => (
                      <option key={c} value={c}>
                        {c === "FIVE_X_WEEK" ? "5× / week" : c === "THREE_X_WEEK" ? "3× / week" : c.toLowerCase()}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <span className="label">Minutes / session</span>
                  <input type="number" name="sessionMinutes" defaultValue={p?.sessionMinutes ?? ""} />
                </div>
                <div>
                  <span className="label">Floor minutes</span>
                  <input type="number" name="mvMinutes" defaultValue={p?.mvMinutes ?? ""} />
                </div>
                <div>
                  <span className="label">Health</span>
                  <select name="health" defaultValue={p?.health ?? ""}>
                    <option value="">not set</option>
                    <option value="GREEN">green</option>
                    <option value="YELLOW">yellow</option>
                    <option value="RED">red</option>
                  </select>
                </div>
                <div>
                  <span className="label">Linked role</span>
                  <select name="roleId" defaultValue={p?.roleId ?? ""}>
                    <option value="">none</option>
                    {roles.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.icon} {r.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className={shared.full}>
                  <span className="label">Depletion triggers — early warnings</span>
                  <textarea name="depletes" defaultValue={p?.depletes ?? ""} rows={2} />
                </div>
                <div className={shared.full}>
                  <span className="label">Note</span>
                  <textarea name="note" defaultValue={p?.note ?? ""} rows={2} />
                </div>
                <div className={`${shared.full} ${shared.actionsRow}`}>
                  <button type="submit" className="btn">
                    Save
                  </button>
                </div>
              </form>
              {p && p.sessions.length > 0 && (
                <div>
                  <span className={shared.sectionLabel}>Recent sessions</span>
                  <div className="sub">
                    {p.sessions.slice(0, 14).map((x) => isoDate(x.date)).join(" · ")}
                  </div>
                </div>
              )}
            </div>
          </details>
        );
      })}
    </div>
  );
}
