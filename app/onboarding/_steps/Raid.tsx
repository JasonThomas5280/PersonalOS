import { prisma } from "@/lib/prisma";
import { isoDate } from "@/lib/dates";
import { createRaidItem } from "@/app/actions";
import shared from "../../tabs.module.css";
import { Later, Shell } from "../Shell";
import { advanceStep, removeRaidItem } from "../actions";
import { RaidForm } from "./RaidForm";
import styles from "../onboarding.module.css";

/**
 * Seeding the RAID log. The prototype deliberately left this empty at setup —
 * "fills itself as things come up... don't sit down and brainstorm risks" — so
 * the copy asks only for what is already true, and skipping is a real choice.
 *
 * Creates go through the same createRaidItem the RAID tab uses.
 */
export async function RaidStep() {
  const [items, roles, outcomes, people] = await Promise.all([
    prisma.raidItem.findMany({
      orderBy: { createdAt: "asc" },
      include: { role: true, outcome: true, person: true },
    }),
    prisma.role.findMany({ orderBy: { sortOrder: "asc" } }),
    prisma.outcome.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.person.findMany({ orderBy: { name: "asc" } }),
  ]);

  return (
    <Shell
      slug="raid"
      title="RAID"
      lede={
        <>
          <p className={styles.body}>
            Risks, Actions, Issues and Decisions in one log. Put down only what&apos;s already on
            your mind — the things you&apos;d name if someone asked what&apos;s worrying you.
          </p>
          <p className="sub">
            Don&apos;t sit down and brainstorm risks. This log fills itself as things come up, or
            through Capture. Skipping is a perfectly good answer.
          </p>
        </>
      }
    >
      {items.length > 0 && (
        <section className={shared.createCard}>
          <span className={shared.sectionLabel}>In the log ({items.length})</span>
          <div className={styles.added}>
            {items.map((r) => (
              <div key={r.id} className={styles.addedRow}>
                <span className={shared.chipGold}>{r.type.toLowerCase()}</span>
                <span>
                  {r.description}
                  <span className={styles.addedMeta}>
                    {r.severity && ` · ${r.severity}`}
                    {r.probability && ` × ${r.probability.toLowerCase()}`}
                    {r.due && ` · due ${isoDate(r.due)}`}
                    {r.role && ` · ${r.role.label}`}
                    {r.outcome && ` · ${r.outcome.result}`}
                    {r.person && ` · ${r.person.name}`}
                  </span>
                </span>
                <form action={removeRaidItem}>
                  <input type="hidden" name="id" value={r.id} />
                  <button type="submit" className={shared.tinyBtn}>
                    remove
                  </button>
                </form>
              </div>
            ))}
          </div>
        </section>
      )}

      <RaidForm
        action={createRaidItem}
        roles={roles.map((r) => ({ id: r.id, label: r.label, icon: r.icon }))}
        outcomes={outcomes.map((o) => ({ id: o.id, result: o.result }))}
        people={people.map((p) => ({ id: p.id, name: p.name }))}
      />

      <form action={advanceStep} className={styles.form}>
        <input type="hidden" name="step" value="raid" />
        <Later>
          The <strong>RAID</strong> tab, or drop a raw note into <strong>Capture</strong> and let it
          pull out the decisions, actions and risks for you.
        </Later>
        <div className={shared.actionsRow}>
          <button type="submit" className="btn">
            Next — people
          </button>
        </div>
      </form>
    </Shell>
  );
}
