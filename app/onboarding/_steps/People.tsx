import { SubmitButton } from "@/components/SubmitButton";
import { prisma } from "@/lib/prisma";
import { isoDate } from "@/lib/dates";
import { addCommitment, addContribution, addPotential, createPerson } from "@/app/actions";
import shared from "../../tabs.module.css";
import { Later, Shell } from "../Shell";
import { advanceStep, removePerson } from "../actions";
import styles from "../onboarding.module.css";

const RINGS = [
  { value: "INNER", label: "Inner — 3–5 people, every 90 days" },
  { value: "WORKING", label: "Working — 15–20, every 56 days" },
  { value: "AMBIENT", label: "Ambient — 50–150, every 240 days" },
];

const STAGES = [
  { value: "SPOT", label: "spot" },
  { value: "ASSESS", label: "assess" },
  { value: "DEVELOP", label: "develop" },
  { value: "MAINTAIN", label: "maintain" },
];

const CATEGORIES = [
  "INFORMATIONAL",
  "CONNECTIVE",
  "TIME",
  "ACKNOWLEDGMENT",
  "OPERATIONAL",
  "PRESENCE",
];

/**
 * People and the ledger. Ordered after RAID so anyone a RAID item already
 * points at exists by the time this runs.
 *
 * The prototype called this "the deepest part of the system and the worst place
 * to start cold" and told people to wait two weeks. The compromise here: ask
 * only for people you already owe something to, and make skipping easy.
 */
export async function PeopleStep() {
  const people = await prisma.person.findMany({
    orderBy: { createdAt: "asc" },
    include: { given: true, owed: true, potential: true },
  });

  return (
    <Shell
      slug="people"
      title="People"
      lede={
        <>
          <p className={styles.body}>
            The ledger has three sides: what you&apos;ve given, what you owe, and what you could
            offer. It exists to direct generosity — it is never referenced when you&apos;re asking
            for something.
          </p>
          <p className="sub">
            This is the deepest part of the system and the worst place to start cold. Add the few
            people you already owe something to; leave the rest until you&apos;ve used the system a
            couple of weeks.
          </p>
        </>
      }
    >
      {people.length > 0 && (
        <section className={shared.createCard}>
          <h2 className={shared.sectionLabel}>Added so far ({people.length})</h2>
          <div className={styles.added}>
            {people.map((p) => (
              <div key={p.id} className={styles.addedRow}>
                <span>
                  <strong>{p.name}</strong>
                  <span className={styles.addedMeta}>
                    {" "}
                    · {p.ring.toLowerCase()} · {p.stage.toLowerCase()} · {p.given.length} given /{" "}
                    {p.owed.length} owed / {p.potential.length} potential
                  </span>
                </span>
                <form action={removePerson}>
                  <input type="hidden" name="id" value={p.id} />
                  <SubmitButton className={shared.tinyBtn} pendingLabel="…">remove</SubmitButton>
                </form>
              </div>
            ))}
          </div>
        </section>
      )}

      <form action={createPerson} className={shared.createCard}>
        <h2 className={shared.sectionLabel}>Add a person</h2>
        <div className={shared.formGrid}>
          <div className={shared.full}>
            <label className="label">Name
            <input name="name" placeholder="How you'd say it to them" /></label>
          </div>
          <div>
            <label className="label">Title
            <input name="title" /></label>
          </div>
          <div>
            <label className="label">Employer
            <input name="employer" /></label>
          </div>
          <div>
            <label className="label">Ring
            <select name="ring" defaultValue="WORKING">
              {RINGS.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select></label>
          </div>
          <div>
            <label className="label">Stage
            <select name="stage" defaultValue="MAINTAIN">
              {STAGES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select></label>
          </div>
          <div className={shared.full}>
            <label className="label">How you met / origin
            <input name="origin" placeholder="Where this started" /></label>
          </div>
        </div>
        <div className={shared.actionsRow}>
          <SubmitButton className="btnGhost">Add person</SubmitButton>
        </div>
        <p className="sub">
          Rings, engines, node type and cadence are all editable in the People tab — add the name
          here, deepen it there.
        </p>
      </form>

      {/* The ledger needs a person to hang off, so it only appears once one exists. */}
      {people.map((p) => (
        <details key={p.id} className={shared.createCard}>
          <summary className={shared.sectionLabel}>{p.name} — the ledger</summary>

          <h2 className="label">Contributions you&apos;ve given</h2>
          {p.given.map((c) => (
            <div key={c.id} className={styles.addedRow}>
              <span className={styles.addedMeta}>{isoDate(c.date)}</span>
              <span>
                {c.category.toLowerCase()} — {c.text}
              </span>
            </div>
          ))}
          <form action={addContribution} className={shared.addForm}>
            <input type="hidden" name="personId" value={p.id} />
            <select name="category" defaultValue="INFORMATIONAL" style={{ flex: "0 0 160px" }}>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c.toLowerCase()}
                </option>
              ))}
            </select>
            <input name="text" placeholder="What you gave" />
            <SubmitButton className="btnGhost">Add</SubmitButton>
          </form>

          <span className="label" style={{ marginTop: 14, display: "block" }}>
            Commitments you owe — overdue ones become a critical alert
          </span>
          {p.owed.map((c) => (
            <div key={c.id} className={styles.addedRow}>
              <span className={styles.addedMeta}>{c.due ? isoDate(c.due) : "no date"}</span>
              <span>{c.text}</span>
            </div>
          ))}
          <form action={addCommitment} className={shared.addForm}>
            <input type="hidden" name="personId" value={p.id} />
            <input name="text" placeholder="What you said you'd do" />
            <input type="date" name="due" style={{ flex: "0 0 150px" }} />
            <SubmitButton className="btnGhost">Add</SubmitButton>
          </form>

          <span className="label" style={{ marginTop: 14, display: "block" }}>
            Potential contributions — what you could offer
          </span>
          {p.potential.map((c) => (
            <div key={c.id} className={styles.addedRow}>
              <span>{c.text}</span>
            </div>
          ))}
          <form action={addPotential} className={shared.addForm}>
            <input type="hidden" name="personId" value={p.id} />
            <input name="text" placeholder="Something you could do for them" />
            <SubmitButton className="btnGhost">Add</SubmitButton>
          </form>
        </details>
      ))}

      <form action={advanceStep} className={styles.form}>
        <input type="hidden" name="step" value="people" />
        <Later>
          The <strong>People</strong> tab — rings, stages, motivation engines, node types, and the
          full ledger.
        </Later>
        <div className={shared.actionsRow}>
          <SubmitButton>Next — the rhythm</SubmitButton>
        </div>
      </form>
    </Shell>
  );
}
