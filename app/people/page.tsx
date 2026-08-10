import {
  addCommitment,
  addContribution,
  addPotential,
  completeCommitment,
  createPerson,
  deletePerson,
  deletePotential,
  logContact,
  updatePerson,
} from "@/app/actions";
import { RING_CADENCE_DAYS } from "@/lib/alerts";
import { daysSince, isoDate, todayUTC } from "@/lib/dates";
import { prisma } from "@/lib/prisma";
import type { Ring } from "@prisma/client";
import shared from "../tabs.module.css";

export const dynamic = "force-dynamic";

const RINGS: Array<{ key: Ring; label: string; hint: string }> = [
  { key: "INNER", label: "Inner ring", hint: "3–5 people · 90d cadence" },
  { key: "WORKING", label: "Working ring", hint: "15–20 · 56d" },
  { key: "AMBIENT", label: "Ambient ring", hint: "50–150 · 240d" },
];
const STAGES = ["SPOT", "ASSESS", "DEVELOP", "MAINTAIN"] as const;
const ENGINES = ["MONEY", "IDEOLOGY", "CONNECTION", "EGO"] as const;
const CATEGORIES = [
  "INFORMATIONAL",
  "CONNECTIVE",
  "TIME",
  "ACKNOWLEDGMENT",
  "OPERATIONAL",
  "PRESENCE",
] as const;

export default async function PeoplePage() {
  const now = todayUTC();
  const [people, roles, outcomes] = await Promise.all([
    prisma.person.findMany({
      orderBy: { name: "asc" },
      include: {
        roles: true,
        outcomes: true,
        given: { orderBy: { date: "desc" } },
        owed: { orderBy: [{ done: "asc" }, { due: "asc" }] },
        potential: true,
      },
    }),
    prisma.role.findMany({ orderBy: { sortOrder: "asc" } }),
    prisma.outcome.findMany({ where: { phase: { not: "CLOSED" } } }),
  ]);

  const engineSelect = (name: string, value: string | null) => (
    <select name={name} defaultValue={value ?? ""}>
      <option value="">not set</option>
      {ENGINES.map((e) => (
        <option key={e} value={e}>
          {e.toLowerCase()}
        </option>
      ))}
    </select>
  );

  return (
    <div className={shared.stack}>
      <div>
        <h1 className="h1">People</h1>
        <p className="sub">
          Quiet Operator model. The ledger directs generosity — it is never referenced when
          asking for something.
        </p>
      </div>

      {RINGS.map((ring) => {
        const inRing = people.filter((p) => p.ring === ring.key);
        return (
          <section key={ring.key}>
            <div className={shared.groupHead}>
              {ring.label} · {ring.hint} · {inRing.length} people
            </div>
            {inRing.length === 0 && <div className="sub">Nobody here yet.</div>}
            {inRing.map((p) => {
              const cadence = p.cadenceDays ?? RING_CADENCE_DAYS[p.ring];
              const since = p.lastContact ? daysSince(p.lastContact, now) : null;
              const overdue = since !== null && since > cadence;
              const brokenCount = p.owed.filter(
                (c) => !c.done && c.due && daysSince(c.due, now) > 0
              ).length;
              return (
                <details key={p.id} className={`card ${shared.item}`} style={{ marginBottom: 9 }}>
                  <summary>
                    <span className={shared.title}>{p.name}</span>
                    <span className={shared.meta}>
                      <span className={shared.chip}>{p.stage.toLowerCase()}</span>
                      {p.nodeType && (
                        <span className={shared.chipGold}>
                          {p.nodeType.toLowerCase().replace("_", "-")}
                        </span>
                      )}
                      <span className={overdue ? "health-RED" : undefined}>
                        {since === null ? "no contact logged" : `${since}d / ${cadence}d`}
                      </span>
                      {brokenCount > 0 && (
                        <span className={shared.chipRed}>
                          {brokenCount} broken commitment{brokenCount > 1 ? "s" : ""}
                        </span>
                      )}
                    </span>
                  </summary>
                  <div className={shared.body}>
                    <div className={shared.actionsRow}>
                      <form action={logContact}>
                        <input type="hidden" name="id" value={p.id} />
                        <button type="submit" className="btnGhost">
                          Log contact today
                        </button>
                      </form>
                    </div>

                    <form action={updatePerson} className={shared.formGrid}>
                      <input type="hidden" name="id" value={p.id} />
                      <div>
                        <span className="label">Name</span>
                        <input name="name" defaultValue={p.name} required />
                      </div>
                      <div>
                        <span className="label">Title</span>
                        <input name="title" defaultValue={p.title} />
                      </div>
                      <div>
                        <span className="label">Employer</span>
                        <input name="employer" defaultValue={p.employer} />
                      </div>
                      <div>
                        <span className="label">Ring</span>
                        <select name="ring" defaultValue={p.ring}>
                          {RINGS.map((r) => (
                            <option key={r.key} value={r.key}>
                              {r.key.toLowerCase()}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <span className="label">Stage</span>
                        <select name="stage" defaultValue={p.stage}>
                          {STAGES.map((s) => (
                            <option key={s} value={s}>
                              {s.toLowerCase()}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <span className="label">Node type</span>
                        <select name="nodeType" defaultValue={p.nodeType ?? ""}>
                          <option value="">none</option>
                          <option value="SUPER_CONNECTOR">super-connector</option>
                          <option value="GATEKEEPER">gatekeeper</option>
                          <option value="HUB">hub</option>
                        </select>
                      </div>
                      <div>
                        <span className="label">First contact</span>
                        <input type="date" name="firstContact" defaultValue={p.firstContact ? isoDate(p.firstContact) : ""} />
                      </div>
                      <div>
                        <span className="label">Last contact</span>
                        <input type="date" name="lastContact" defaultValue={p.lastContact ? isoDate(p.lastContact) : ""} />
                      </div>
                      <div>
                        <span className="label">Cadence override (days)</span>
                        <input type="number" name="cadenceDays" defaultValue={p.cadenceDays ?? ""} placeholder={`ring default ${RING_CADENCE_DAYS[p.ring]}`} />
                      </div>
                      <div>
                        <span className="label">Primary engine</span>
                        {engineSelect("primaryEngine", p.primaryEngine)}
                      </div>
                      <div>
                        <span className="label">Secondary engine</span>
                        {engineSelect("secondaryEngine", p.secondaryEngine)}
                      </div>
                      <div>
                        <span className="label">Rejected engine</span>
                        {engineSelect("rejectedEngine", p.rejectedEngine)}
                      </div>
                      <div>
                        <span className="label">Engine confidence</span>
                        <select name="engineConfidence" defaultValue={p.engineConfidence}>
                          <option value="LOW">low</option>
                          <option value="MEDIUM">medium</option>
                          <option value="HIGH">high</option>
                        </select>
                      </div>
                      <div>
                        <span className="label">Archetype</span>
                        <input name="archetype" defaultValue={p.archetype} />
                      </div>
                      <div>
                        <span className="label">Origin — how you met</span>
                        <input name="origin" defaultValue={p.origin} />
                      </div>
                      <div className={shared.full}>
                        <span className="label">Family context</span>
                        <input name="familyContext" defaultValue={p.familyContext} />
                      </div>
                      <div className={shared.full}>
                        <span className="label">Situation — 3–5 live facts, one per line</span>
                        <textarea name="situation" defaultValue={p.situation} rows={3} />
                      </div>
                      <div className={shared.full}>
                        <span className="label">Material — conversational threads</span>
                        <textarea name="material" defaultValue={p.material} rows={3} />
                      </div>
                      <div className={shared.full}>
                        <span className="label">Linked roles</span>
                        <div className={shared.checks}>
                          {roles.map((r) => (
                            <label key={r.id}>
                              <input type="checkbox" name="roleIds" value={r.id} defaultChecked={p.roles.some((x) => x.roleId === r.id)} />
                              {r.icon} {r.label}
                            </label>
                          ))}
                        </div>
                      </div>
                      <div className={shared.full}>
                        <span className="label">Linked outcomes</span>
                        <div className={shared.checks}>
                          {outcomes.map((o) => (
                            <label key={o.id}>
                              <input type="checkbox" name="outcomeIds" value={o.id} defaultChecked={p.outcomes.some((x) => x.outcomeId === o.id)} />
                              {o.result}
                            </label>
                          ))}
                        </div>
                      </div>
                      <div className={`${shared.full} ${shared.actionsRow}`}>
                        <button type="submit" className="btn">
                          Save
                        </button>
                      </div>
                    </form>

                    <div>
                      <span className={shared.sectionLabel}>Ledger — contributions given</span>
                      {p.given.map((c) => (
                        <div key={c.id} className={shared.listRow}>
                          <span className="sub">{isoDate(c.date)}</span>
                          <span className={shared.chip}>{c.category.toLowerCase()}</span>
                          <span>{c.text}</span>
                        </div>
                      ))}
                      <form action={addContribution} className={shared.addForm}>
                        <input type="hidden" name="personId" value={p.id} />
                        <select name="category" defaultValue="INFORMATIONAL" style={{ flex: "0 0 150px" }}>
                          {CATEGORIES.map((c) => (
                            <option key={c} value={c}>
                              {c.toLowerCase()}
                            </option>
                          ))}
                        </select>
                        <input name="text" placeholder="What you gave, today" />
                        <button type="submit" className="btnGhost">
                          Add
                        </button>
                      </form>
                    </div>

                    <div>
                      <span className={shared.sectionLabel}>Commitments owed</span>
                      {p.owed.map((c) => {
                        const broken = !c.done && c.due && daysSince(c.due, now) > 0;
                        return (
                          <div key={c.id} className={shared.listRow}>
                            <form action={completeCommitment}>
                              <input type="hidden" name="id" value={c.id} />
                              <button type="submit" className={shared.tinyBtn} disabled={c.done}>
                                {c.done ? "✓" : "○"}
                              </button>
                            </form>
                            <span style={c.done ? { textDecoration: "line-through" } : undefined}>
                              {c.text}
                            </span>
                            {c.due && (
                              <span className={broken ? "health-RED" : "sub"}>
                                due {isoDate(c.due)}
                                {broken && " — broken"}
                              </span>
                            )}
                          </div>
                        );
                      })}
                      <form action={addCommitment} className={shared.addForm}>
                        <input type="hidden" name="personId" value={p.id} />
                        <input name="text" placeholder="What you owe them" />
                        <input type="date" name="due" style={{ flex: "0 0 150px" }} />
                        <button type="submit" className="btnGhost">
                          Add
                        </button>
                      </form>
                    </div>

                    <div>
                      <span className={shared.sectionLabel}>Potential contributions</span>
                      {p.potential.map((c) => (
                        <div key={c.id} className={shared.listRow}>
                          <span>{c.text}</span>
                          <form action={deletePotential}>
                            <input type="hidden" name="id" value={c.id} />
                            <button type="submit" className={shared.dangerBtn}>
                              ×
                            </button>
                          </form>
                        </div>
                      ))}
                      <form action={addPotential} className={shared.addForm}>
                        <input type="hidden" name="personId" value={p.id} />
                        <input name="text" placeholder="Something you could do for them" />
                        <button type="submit" className="btnGhost">
                          Add
                        </button>
                      </form>
                    </div>

                    <form action={deletePerson}>
                      <input type="hidden" name="id" value={p.id} />
                      <button type="submit" className={shared.dangerBtn}>
                        Delete person
                      </button>
                    </form>
                  </div>
                </details>
              );
            })}
          </section>
        );
      })}

      <div className={shared.createCard}>
        <span className={shared.sectionLabel}>Add a person</span>
        <form action={createPerson} className={shared.addForm}>
          <input name="name" placeholder="Name" required />
          <select name="ring" defaultValue="WORKING" style={{ flex: "0 0 120px" }}>
            {RINGS.map((r) => (
              <option key={r.key} value={r.key}>
                {r.key.toLowerCase()}
              </option>
            ))}
          </select>
          <select name="stage" defaultValue="SPOT" style={{ flex: "0 0 120px" }}>
            {STAGES.map((s) => (
              <option key={s} value={s}>
                {s.toLowerCase()}
              </option>
            ))}
          </select>
          <button type="submit" className="btn">
            Add
          </button>
        </form>
      </div>
    </div>
  );
}
