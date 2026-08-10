import { ConfirmButton } from "@/components/ConfirmButton";
import { IconSubmit, SubmitButton } from "@/components/SubmitButton";
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

export default async function PeoplePage({ searchParams }: PageProps<"/people">) {
  const openId = typeof (await searchParams).open === "string" ? ((await searchParams).open as string) : undefined;
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
            <h2 className={shared.groupHead}>
              {ring.label} · {ring.hint} · {inRing.length} people
            </h2>
            {inRing.length === 0 && <div className="sub">Nobody here yet.</div>}
            {inRing.map((p) => {
              const cadence = p.cadenceDays ?? RING_CADENCE_DAYS[p.ring];
              const since = p.lastContact ? daysSince(p.lastContact, now) : null;
              const overdue = since !== null && since > cadence;
              const brokenCount = p.owed.filter(
                (c) => !c.done && c.due && daysSince(c.due, now) > 0
              ).length;
              return (
                <details key={p.id} id={p.id} open={p.id === openId} className={`card ${shared.item}`} style={{ marginBottom: 9 }}>
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
                        <SubmitButton className="btnGhost">Log contact today</SubmitButton>
                      </form>
                    </div>

                    <form action={updatePerson} className={shared.formGrid}>
                      <input type="hidden" name="id" value={p.id} />
                      <div>
                        <label className="label">Name
                        <input name="name" defaultValue={p.name} required /></label>
                      </div>
                      <div>
                        <label className="label">Title
                        <input name="title" defaultValue={p.title} /></label>
                      </div>
                      <div>
                        <label className="label">Employer
                        <input name="employer" defaultValue={p.employer} /></label>
                      </div>
                      <div>
                        <label className="label">Ring
                        <select name="ring" defaultValue={p.ring}>
                          {RINGS.map((r) => (
                            <option key={r.key} value={r.key}>
                              {r.key.toLowerCase()}
                            </option>
                          ))}
                        </select></label>
                      </div>
                      <div>
                        <label className="label">Stage
                        <select name="stage" defaultValue={p.stage}>
                          {STAGES.map((s) => (
                            <option key={s} value={s}>
                              {s.toLowerCase()}
                            </option>
                          ))}
                        </select></label>
                      </div>
                      <div>
                        <label className="label">Node type
                        <select name="nodeType" defaultValue={p.nodeType ?? ""}>
                          <option value="">none</option>
                          <option value="SUPER_CONNECTOR">super-connector</option>
                          <option value="GATEKEEPER">gatekeeper</option>
                          <option value="HUB">hub</option>
                        </select></label>
                      </div>
                      <div>
                        <label className="label">First contact
                        <input type="date" name="firstContact" defaultValue={p.firstContact ? isoDate(p.firstContact) : ""} /></label>
                      </div>
                      <div>
                        <label className="label">Last contact
                        <input type="date" name="lastContact" defaultValue={p.lastContact ? isoDate(p.lastContact) : ""} /></label>
                      </div>
                      <div>
                        <label className="label">Cadence override (days)
                        <input type="number" name="cadenceDays" defaultValue={p.cadenceDays ?? ""} placeholder={`ring default ${RING_CADENCE_DAYS[p.ring]}`} /></label>
                      </div>
                      <div>
                        <label className="label">
                          Primary engine{engineSelect("primaryEngine", p.primaryEngine)}
                        </label>
                      </div>
                      <div>
                        <label className="label">
                          Secondary engine{engineSelect("secondaryEngine", p.secondaryEngine)}
                        </label>
                      </div>
                      <div>
                        <label className="label">
                          Rejected engine{engineSelect("rejectedEngine", p.rejectedEngine)}
                        </label>
                      </div>
                      <div>
                        <label className="label">Engine confidence
                        <select name="engineConfidence" defaultValue={p.engineConfidence}>
                          <option value="LOW">low</option>
                          <option value="MEDIUM">medium</option>
                          <option value="HIGH">high</option>
                        </select></label>
                      </div>
                      <div>
                        <label className="label">Archetype
                        <input name="archetype" defaultValue={p.archetype} /></label>
                      </div>
                      <div>
                        <label className="label">Origin — how you met
                        <input name="origin" defaultValue={p.origin} /></label>
                      </div>
                      <div className={shared.full}>
                        <label className="label">Family context
                        <input name="familyContext" defaultValue={p.familyContext} /></label>
                      </div>
                      <div className={shared.full}>
                        <label className="label">Situation — 3–5 live facts, one per line
                        <textarea name="situation" defaultValue={p.situation} rows={3} /></label>
                      </div>
                      <div className={shared.full}>
                        <label className="label">Material — conversational threads
                        <textarea name="material" defaultValue={p.material} rows={3} /></label>
                      </div>
                      <fieldset className={shared.full}>
                        <legend className="label">Linked roles</legend>
                        <div className={shared.checks}>
                          {roles.map((r) => (
                            <label key={r.id}>
                              <input type="checkbox" name="roleIds" value={r.id} defaultChecked={p.roles.some((x) => x.roleId === r.id)} />
                              <span aria-hidden="true">{r.icon}</span> {r.label}
                            </label>
                          ))}
                        </div>
                      </fieldset>
                      <fieldset className={shared.full}>
                        <legend className="label">Linked outcomes</legend>
                        <div className={shared.checks}>
                          {outcomes.map((o) => (
                            <label key={o.id}>
                              <input type="checkbox" name="outcomeIds" value={o.id} defaultChecked={p.outcomes.some((x) => x.outcomeId === o.id)} />
                              {o.result}
                            </label>
                          ))}
                        </div>
                      </fieldset>
                      <div className={`${shared.full} ${shared.actionsRow}`}>
                        <SubmitButton>Save</SubmitButton>
                      </div>
                    </form>

                    <div>
                      <h2 className={shared.sectionLabel}>Ledger — contributions given</h2>
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
                        <SubmitButton className="btnGhost">Add</SubmitButton>
                      </form>
                    </div>

                    <div>
                      <h2 className={shared.sectionLabel}>Commitments owed</h2>
                      {p.owed.map((c) => {
                        const broken = !c.done && c.due && daysSince(c.due, now) > 0;
                        return (
                          <div key={c.id} className={shared.listRow}>
                            <form action={completeCommitment}>
                              <input type="hidden" name="id" value={c.id} />
                              {c.done ? (
                                <span className={shared.tinyBtn} aria-label={`Completed: ${c.text}`}>
                                  ✓
                                </span>
                              ) : (
                                <IconSubmit
                                  className={shared.tinyBtn}
                                  glyph="○"
                                  label={`Mark complete: ${c.text}`}
                                />
                              )}
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
                        <SubmitButton className="btnGhost">Add</SubmitButton>
                      </form>
                    </div>

                    <div>
                      <h2 className={shared.sectionLabel}>Potential contributions</h2>
                      {p.potential.map((c) => (
                        <div key={c.id} className={shared.listRow}>
                          <span>{c.text}</span>
                          <form action={deletePotential}>
                            <input type="hidden" name="id" value={c.id} />
                            <ConfirmButton
                              className={shared.dangerBtn}
                              label={`Remove potential contribution: ${c.text}`}
                              confirmLabel="Remove?"
                            >
                              ×
                            </ConfirmButton>
                          </form>
                        </div>
                      ))}
                      <form action={addPotential} className={shared.addForm}>
                        <input type="hidden" name="personId" value={p.id} />
                        <input name="text" placeholder="Something you could do for them" />
                        <SubmitButton className="btnGhost">Add</SubmitButton>
                      </form>
                    </div>

                    <form action={deletePerson}>
                      <input type="hidden" name="id" value={p.id} />
                      {/* Takes the whole ledger and every commitment with it. */}
                      <ConfirmButton
                        className={shared.dangerBtn}
                        label={`Delete ${p.name}, their ledger and all commitments`}
                      >
                        Delete person
                      </ConfirmButton>
                    </form>
                  </div>
                </details>
              );
            })}
          </section>
        );
      })}

      <div className={shared.createCard}>
        <h2 className={shared.sectionLabel}>Add a person</h2>
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
          <SubmitButton>Add</SubmitButton>
        </form>
      </div>
    </div>
  );
}
