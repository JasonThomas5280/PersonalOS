import {
  addProcessChange,
  createRetro,
  saveWeeklyReview,
  toggleProcessChange,
  updateRetro,
} from "@/app/actions";
import { isoDate, todayUTC, weekStart } from "@/lib/dates";
import { prisma } from "@/lib/prisma";
import shared from "../tabs.module.css";

export const dynamic = "force-dynamic";

const FIELDS = [
  { key: "wins", label: "Wins — what moved" },
  { key: "misses", label: "Misses — classify: execution defect or structural gap" },
  { key: "quadrant", label: "Quadrant check — where the week actually went" },
  { key: "drift", label: "Drift — calendar vs role missions" },
  { key: "ledger", label: "Ledger — owed / not contributing / could do" },
  { key: "blocked", label: "Blocked — what's stuck and who owns unblocking it" },
  { key: "nextWeek", label: "Next week — big rocks by role" },
  { key: "gratitude", label: "Gratitude" },
] as const;

export default async function ReviewPage() {
  const now = todayUTC();
  const thisWeek = weekStart(now);
  const [reviews, retros] = await Promise.all([
    prisma.weeklyReview.findMany({ orderBy: { weekStart: "desc" } }),
    prisma.retro.findMany({ orderBy: { date: "desc" }, include: { changes: true } }),
  ]);
  const current = reviews.find((r) => isoDate(r.weekStart) === isoDate(thisWeek));
  const past = reviews.filter((r) => isoDate(r.weekStart) !== isoDate(thisWeek));

  return (
    <div className={shared.stack}>
      <div>
        <h1 className="h1">Review</h1>
        <p className="sub">
          Weekly: status yourself honestly across roles, same day every week. Quarterly: the
          retro says why it keeps happening, and ends in owned process changes.
        </p>
      </div>

      <div className={shared.createCard}>
        <span className={shared.sectionLabel}>
          Week of {isoDate(thisWeek)} {current ? "· saved" : "· not yet done"}
        </span>
        <form action={saveWeeklyReview} className={shared.formGrid}>
          <input type="hidden" name="weekStart" value={isoDate(thisWeek)} />
          {FIELDS.map((f) => (
            <div key={f.key} className={shared.full}>
              <span className="label">{f.label}</span>
              <textarea name={f.key} defaultValue={current?.[f.key] ?? ""} rows={2} />
            </div>
          ))}
          <div>
            <span className="label">Overall health</span>
            <select name="health" defaultValue={current?.health ?? ""}>
              <option value="">not set</option>
              <option value="GREEN">green</option>
              <option value="YELLOW">yellow</option>
              <option value="RED">red</option>
            </select>
          </div>
          <div className={shared.full}>
            <span className="label">If not green: why, and the recovery plan</span>
            <textarea name="healthNote" defaultValue={current?.healthNote ?? ""} rows={2} />
          </div>
          <div className={`${shared.full} ${shared.actionsRow}`}>
            <button type="submit" className="btn">
              Save weekly review
            </button>
          </div>
        </form>
      </div>

      {past.length > 0 && (
        <section>
          <div className={shared.groupHead}>Past weeks</div>
          {past.map((r) => (
            <details key={r.id} className={`card ${shared.item}`} style={{ marginBottom: 9 }}>
              <summary>
                <span className={shared.title}>Week of {isoDate(r.weekStart)}</span>
                <span className={shared.meta}>
                  {r.health && (
                    <span className={`health-${r.health}`}>● {r.health.toLowerCase()}</span>
                  )}
                </span>
              </summary>
              <div className={shared.body}>
                {FIELDS.filter((f) => r[f.key]).map((f) => (
                  <div key={f.key}>
                    <span className={shared.sectionLabel}>{f.label}</span>
                    <div className="sub" style={{ whiteSpace: "pre-wrap" }}>
                      {r[f.key]}
                    </div>
                  </div>
                ))}
                {r.healthNote && <div className="sub">{r.healthNote}</div>}
              </div>
            </details>
          ))}
        </section>
      )}

      <section>
        <div className={shared.groupHead}>Quarterly retros</div>
        {retros.map((retro) => (
          <details key={retro.id} className={`card ${shared.item}`} style={{ marginBottom: 9 }}>
            <summary>
              <span className={shared.title}>{retro.quarter}</span>
              <span className={shared.meta}>
                <span>{isoDate(retro.date)}</span>
                <span>
                  {retro.changes.filter((c) => c.done).length}/{retro.changes.length} changes done
                </span>
              </span>
            </summary>
            <div className={shared.body}>
              <form action={updateRetro} className={shared.formGrid}>
                <input type="hidden" name="id" value={retro.id} />
                <div className={shared.full}>
                  <span className="label">What went well</span>
                  <textarea name="wentWell" defaultValue={retro.wentWell} rows={2} />
                </div>
                <div className={shared.full}>
                  <span className="label">What didn&apos;t</span>
                  <textarea name="didnt" defaultValue={retro.didnt} rows={2} />
                </div>
                <div className={shared.full}>
                  <span className="label">Root causes — not symptoms</span>
                  <textarea name="rootCauses" defaultValue={retro.rootCauses} rows={2} />
                </div>
                <div className={`${shared.full} ${shared.actionsRow}`}>
                  <button type="submit" className="btn">
                    Save
                  </button>
                </div>
              </form>
              <div>
                <span className={shared.sectionLabel}>
                  Process changes — mechanisms, not goals
                </span>
                {retro.changes.map((c) => (
                  <div key={c.id} className={shared.listRow}>
                    <form action={toggleProcessChange}>
                      <input type="hidden" name="id" value={c.id} />
                      <button type="submit" className={shared.tinyBtn}>
                        {c.done ? "✓" : "○"}
                      </button>
                    </form>
                    <span style={c.done ? { textDecoration: "line-through" } : undefined}>
                      {c.change}
                    </span>
                    {c.target && <span className="sub">by {isoDate(c.target)}</span>}
                  </div>
                ))}
                <form action={addProcessChange} className={shared.addForm}>
                  <input type="hidden" name="retroId" value={retro.id} />
                  <input name="change" placeholder="A mechanism with an owner (you)" />
                  <input type="date" name="target" style={{ flex: "0 0 150px" }} />
                  <button type="submit" className="btnGhost">
                    Add
                  </button>
                </form>
              </div>
            </div>
          </details>
        ))}
        <div className={shared.createCard}>
          <span className={shared.sectionLabel}>New retro</span>
          <form action={createRetro} className={shared.addForm}>
            <input name="quarter" placeholder='e.g. "Q3 2026"' required />
            <button type="submit" className="btn">
              Start retro
            </button>
          </form>
        </div>
      </section>
    </div>
  );
}
