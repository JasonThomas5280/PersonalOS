import Link from "next/link";
import { prisma } from "@/lib/prisma";
import shared from "../../tabs.module.css";
import { Later, Shell } from "../Shell";
import { saveRoleDepth } from "../actions";
import { href } from "../steps";
import styles from "../onboarding.module.css";

const CADENCES = [
  { value: "", label: "no cadence set" },
  { value: "WEEKLY", label: "weekly" },
  { value: "MONTHLY", label: "monthly" },
  { value: "QUARTERLY", label: "quarterly" },
];

/**
 * The rest of what a role carries. Collapsed per role — four long-form fields
 * across six roles is a wall if it's all open at once, and the mission line
 * from the previous step is already enough for the system to function.
 */
export async function DepthStep() {
  const roles = await prisma.role.findMany({ orderBy: { sortOrder: "asc" } });

  if (roles.length === 0) {
    return (
      <Shell slug="depth" title="Role depth">
        <p className="sub">No roles yet — go back and pick at least one.</p>
        <div className={shared.actionsRow}>
          <Link href={href("roles")} className="btn">
            Back to roles
          </Link>
        </div>
      </Shell>
    );
  }

  return (
    <Shell
      slug="depth"
      title="Role depth"
      lede={
        <>
          <p className={styles.body}>
            A mission says what the role is for. These say how you&apos;d know it was healthy, what
            you&apos;re holding in trust, and how it fails when it fails.
          </p>
          <p className="sub">
            All optional, and all editable in the Roles tab. Open the ones you have an answer for
            and leave the rest — a blank field is more honest than a filled-in guess.
          </p>
        </>
      }
    >
      <form action={saveRoleDepth} className={styles.form}>
        <input type="hidden" name="step" value="depth" />
        {roles.map((r) => (
          <details key={r.id} className={shared.createCard}>
            <summary className={shared.sectionLabel}>
              {r.icon} {r.label}
              {r.mission ? "" : "  · no mission yet"}
            </summary>
            <div className={shared.formGrid}>
              <div className={shared.full}>
                <label className="label">Mission — the standing definition
                <input
                  name={`mission-${r.id}`}
                  defaultValue={r.mission ?? ""}
                  placeholder="The kind of person you're trying to be in this role"
                /></label>
              </div>
              <div className={shared.full}>
                <label className="label">Success criteria — how you&apos;d know it&apos;s healthy
                <textarea
                  name={`success-${r.id}`}
                  rows={2}
                  defaultValue={r.success ?? ""}
                  placeholder="What someone would actually see if this role were going well"
                /></label>
              </div>
              <div className={shared.full}>
                <label className="label">Stewardship — what you&apos;re holding in trust
                <textarea
                  name={`stewardship-${r.id}`}
                  rows={2}
                  defaultValue={r.stewardship ?? ""}
                  placeholder="Whose wellbeing or what asset depends on you here"
                /></label>
              </div>
              <div className={shared.full}>
                <label className="label">Failure mode — how it goes wrong when it goes wrong
                <textarea
                  name={`failureMode-${r.id}`}
                  rows={2}
                  defaultValue={r.failureMode ?? ""}
                  placeholder="Not the disaster — the ordinary way this quietly slips"
                /></label>
              </div>
              <div>
                <label className="label">Review cadence
                <select name={`reviewCadence-${r.id}`} defaultValue={r.reviewCadence ?? ""}>
                  {CADENCES.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select></label>
              </div>
            </div>
          </details>
        ))}

        <Later>
          The <strong>Roles</strong> tab — plus role health, status notes and the review button.
        </Later>

        <div className={shared.actionsRow}>
          <button type="submit" className="btn">
            Next — capacity
          </button>
        </div>
      </form>
    </Shell>
  );
}
