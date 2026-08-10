import { IconSubmit, SubmitButton } from "@/components/SubmitButton";
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
        <h2 className={shared.sectionLabel}>
          Week of {isoDate(thisWeek)} {current ? "· saved" : "· not yet done"}
        </h2>
        <form action={saveWeeklyReview} className={shared.formGrid}>
          <input type="hidden" name="weekStart" value={isoDate(thisWeek)} />
          {FIELDS.map((f) => (
            <div key={f.key} className={shared.full}>
              <label className="label">{f.label}
              <textarea name={f.key} defaultValue={current?.[f.key] ?? ""} rows={2} /></label>
            </div>
          ))}
          <div>
            <label className="label">Overall health
            <select name="health" defaultValue={current?.health ?? ""}>
              <option value="">not set</option>
              <option value="GREEN">green</option>
              <option value="YELLOW">yellow</option>
              <option value="RED">red</option>
            </select></label>
          </div>
          <div className={shared.full}>
            <label className="label">If not green: why, and the recovery plan
            <textarea name="healthNote" defaultValue={current?.healthNote ?? ""} rows={2} /></label>
          </div>
          <div className={`${shared.full} ${shared.actionsRow}`}>
            <SubmitButton>Save weekly review</SubmitButton>
          </div>
        </form>
      </div>

      {past.length > 0 && (
        <section>
          <h2 className={shared.groupHead}>Past weeks</h2>
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
                    <h2 className={shared.sectionLabel}>{f.label}</h2>
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
        <h2 className={shared.groupHead}>Quarterly retros</h2>
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
                  <label className="label">What went well
                  <textarea name="wentWell" defaultValue={retro.wentWell} rows={2} /></label>
                </div>
                <div className={shared.full}>
                  <label className="label">What didn&apos;t
                  <textarea name="didnt" defaultValue={retro.didnt} rows={2} /></label>
                </div>
                <div className={shared.full}>
                  <label className="label">Root causes — not symptoms
                  <textarea name="rootCauses" defaultValue={retro.rootCauses} rows={2} /></label>
                </div>
                <div className={`${shared.full} ${shared.actionsRow}`}>
                  <SubmitButton>Save</SubmitButton>
                </div>
              </form>
              <div>
                <h2 className={shared.sectionLabel}>
                  Process changes — mechanisms, not goals
                </h2>
                {retro.changes.map((c) => (
                  <div key={c.id} className={shared.listRow}>
                    <form action={toggleProcessChange}>
                      <input type="hidden" name="id" value={c.id} />
                      <IconSubmit
                        className={shared.tinyBtn}
                        glyph={c.done ? "✓" : "○"}
                        label={`${c.done ? "Mark not done" : "Mark done"}: ${c.change}`}
                      />
                    </form>
                    <span style={c.done ? { textDecoration: "line-through" } : undefined}>
                      {c.change}
                      {c.why && <span className="sub"> — {c.why}</span>}
                    </span>
                    {c.target && <span className="sub">by {isoDate(c.target)}</span>}
                  </div>
                ))}
                <form action={addProcessChange} className={shared.addForm}>
                  <input type="hidden" name="retroId" value={retro.id} />
                  <input name="change" placeholder="A mechanism with an owner (you)" />
                  <input name="why" placeholder="Which root cause it addresses" />
                  <input type="date" name="target" style={{ flex: "0 0 150px" }} />
                  <SubmitButton className="btnGhost">Add</SubmitButton>
                </form>
              </div>
            </div>
          </details>
        ))}
        <div className={shared.createCard}>
          <h2 className={shared.sectionLabel}>New retro</h2>
          <form action={createRetro} className={shared.addForm}>
            <input name="quarter" placeholder='e.g. "Q3 2026"' required />
            <SubmitButton>Start retro</SubmitButton>
          </form>
        </div>
      </section>
    </div>
  );
}
