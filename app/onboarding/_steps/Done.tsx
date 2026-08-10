import { prisma } from "@/lib/prisma";
import shared from "../../tabs.module.css";
import { Shell } from "../Shell";
import { finishOnboarding } from "../actions";
import styles from "../onboarding.module.css";

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className={styles.summaryRow}>
      <span className={styles.summaryLabel}>{label}</span>
      <span className={styles.summaryValue}>{value}</span>
    </div>
  );
}

/**
 * Summary of what actually landed, then the completion marker. Counts are read
 * back from the database rather than from form state, so this reflects what was
 * really written — including anything added in an earlier, abandoned session.
 */
export async function DoneStep() {
  const [profile, roles, outcomes, raid, people, saw, sessions] = await Promise.all([
    prisma.profile.findUnique({ where: { id: 1 } }),
    prisma.role.findMany({ orderBy: { sortOrder: "asc" } }),
    prisma.outcome.findMany({ include: { roles: true, gateItems: true, blockedBy: true } }),
    prisma.raidItem.groupBy({ by: ["type"], _count: true }),
    prisma.person.findMany({ include: { given: true, owed: true, potential: true } }),
    prisma.sawPractice.findMany(),
    prisma.sawSession.count(),
  ]);

  const withMission = roles.filter((r) => r.mission).length;
  const ledger = people.reduce(
    (a, p) => ({
      given: a.given + p.given.length,
      owed: a.owed + p.owed.length,
      potential: a.potential + p.potential.length,
    }),
    { given: 0, owed: 0, potential: 0 },
  );
  const hours = outcomes.reduce((a, o) => a + Number(o.weeklyHours ?? 0), 0);
  const budget = profile ? Number(profile.capacityBudget) : 12;

  return (
    <Shell
      slug="done"
      title="Done"
      lede={
        <p className={styles.body}>
          Here&apos;s what&apos;s in the system. Nothing is locked — the map below shows where each
          piece lives from here.
        </p>
      }
    >
      <section className={shared.createCard}>
        <Row
          label="Mission"
          value={
            profile?.mission
              ? `"${profile.mission.slice(0, 88)}${profile.mission.length > 88 ? "…" : ""}"`
              : "Not written"
          }
        />
        <Row
          label="Roles"
          value={roles.length ? roles.map((r) => `${r.icon} ${r.label}`).join("  ") : "None"}
        />
        <Row label="Role missions" value={`${withMission} of ${roles.length} written`} />
        <Row label="Outcome budget" value={`${budget}h / week`} />
        <Row
          label="Outcomes"
          value={
            outcomes.length
              ? `${outcomes.length} · ${hours}h/wk committed · ${outcomes.reduce((a, o) => a + o.gateItems.length, 0)} gate items · ${outcomes.reduce((a, o) => a + o.blockedBy.length, 0)} dependencies`
              : "Skipped"
          }
        />
        <Row
          label="Renewal"
          value={
            saw.length
              ? `${saw.length} of 4 dimensions${sessions ? ` · ${sessions} sessions logged` : ""}`
              : "Skipped"
          }
        />
        <Row
          label="RAID"
          value={
            raid.length
              ? raid.map((r) => `${r._count} ${r.type.toLowerCase()}`).join(", ")
              : "Empty — fills itself as things come up"
          }
        />
        <Row
          label="People"
          value={
            people.length
              ? `${people.length} · ledger ${ledger.given} given / ${ledger.owed} owed / ${ledger.potential} potential`
              : "Empty — add the five you already owe something to"
          }
        />
      </section>

      <section className={shared.createCard}>
        <span className={shared.sectionLabel}>Where every answer lives from here</span>
        <p className="sub">
          <strong>Mission and capacity budget</strong> → Settings
          <br />
          <strong>Role missions, success criteria, stewardship, health</strong> → Roles tab
          <br />
          <strong>Outcomes, phases, gate, dependencies, criteria</strong> → Outcomes tab
          <br />
          <strong>Risks, actions, issues, decisions</strong> → RAID tab, or Capture
          <br />
          <strong>Rings, engines, the ledger</strong> → People tab
          <br />
          <strong>Renewal practices and sessions</strong> → Sharpen tab
          <br />
          <strong>Everything, as raw JSON</strong> → Settings → Export
        </p>
        <p className="sub">
          None of this is a one-time decision. Re-run this setup any time the season changes — it
          adds to what&apos;s there rather than replacing it.
        </p>
      </section>

      <section className={shared.createCard}>
        <span className={shared.sectionLabel}>Your first three moves</span>
        <p className="sub">
          <strong>Tomorrow</strong> — set your Big 3 and tag each quadrant. Notice how many are Q2.
          <br />
          <strong>This week</strong> — put a recurring 20-minute block on your calendar for the
          weekly review. Same day, every week.
          <br />
          <strong>In two weeks</strong> — open People and add the five people you already owe
          something to.
        </p>
      </section>

      <form action={finishOnboarding}>
        <div className={shared.actionsRow}>
          <button type="submit" className="btn">
            Open the system
          </button>
        </div>
      </form>
    </Shell>
  );
}
