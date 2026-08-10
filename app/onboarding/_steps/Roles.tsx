import { prisma } from "@/lib/prisma";
import shared from "../../tabs.module.css";
import { Later, Shell } from "../Shell";
import { addCustomRole, removeRole, saveRoles } from "../actions";
import { DEFAULT_ROLES, ICONS } from "../steps";
import styles from "../onboarding.module.css";

export async function RolesStep() {
  const existing = await prisma.role.findMany({ orderBy: { sortOrder: "asc" } });
  const bySlug = new Map(existing.map((r) => [r.slug, r]));
  const presetSlugs = new Set(DEFAULT_ROLES.map((r) => r.slug));
  // Roles the user typed in themselves — shown separately so they can be removed.
  const custom = existing.filter((r) => !presetSlugs.has(r.slug));
  const firstRun = existing.length === 0;

  return (
    <Shell
      slug="roles"
      title="Roles"
      lede={
        <>
          <p className={styles.body}>
            These are the spine — outcomes, priorities, people and renewal practices all tag back to
            a role. That&apos;s what lets the system notice when one goes quiet.
          </p>
          <p className="sub">
            Turn off what doesn&apos;t apply, add what&apos;s missing. Four to seven works; past that
            the health colours stop meaning anything.
          </p>
        </>
      }
    >
      <section className={shared.createCard}>
        <span className={shared.sectionLabel}>What goes in the mission line</span>
        <p className="sub">
          A standing definition, not a goal. Goals finish; a role mission is still true in ten years.
          Write the kind of person you&apos;re trying to be in that role, in one sentence, in your
          own plain words.
        </p>
        <p className="sub">
          <span style={{ color: "var(--green)" }}>Works:</span> &ldquo;To be the steady one — they
          should never have to guess what mood I&apos;m in.&rdquo;
          <br />
          <span style={{ color: "var(--red)" }}>Doesn&apos;t:</span> &ldquo;Spend more time with the
          kids.&rdquo; That&apos;s a goal, and next year it&apos;s either done or it&apos;s a
          grievance.
        </p>
      </section>

      {/* Adding a custom role posts on its own so the list can re-render with it. */}
      <form action={addCustomRole} className={shared.addForm}>
        <select name="customIcon" defaultValue="◈" style={{ flex: "0 0 66px" }}>
          {ICONS.map((i) => (
            <option key={i} value={i}>
              {i}
            </option>
          ))}
        </select>
        <input name="customLabel" placeholder="Add a role — Mentor, Neighbour, Son, Coach" />
        <button type="submit" className="btnGhost">
          Add
        </button>
      </form>

      <form action={saveRoles} className={styles.form}>
        <input type="hidden" name="step" value="roles" />
        <section className={shared.createCard}>
          {[...DEFAULT_ROLES, ...custom.map((c) => ({
            slug: c.slug,
            label: c.label,
            icon: c.icon,
            hint: "",
            prompt: "What is this role for? What would someone see if it were healthy?",
            example: "To be the person in this role who does what they said they'd do.",
          }))].map((r) => {
            const saved = bySlug.get(r.slug);
            return (
              <div key={r.slug} className={styles.roleRow}>
                <label className={styles.roleCheck}>
                  <input
                    type="checkbox"
                    name="roles"
                    value={r.slug}
                    // First run: everything on, matching the prototype. After
                    // that, only what's actually saved.
                    defaultChecked={firstRun || Boolean(saved)}
                  />
                  <span>
                    {saved?.icon ?? r.icon} <strong>{saved?.label ?? r.label}</strong>
                  </span>
                  {r.hint && <span className="sub">{r.hint}</span>}
                </label>
                <input type="hidden" name={`label-${r.slug}`} value={saved?.label ?? r.label} />
                <input type="hidden" name={`icon-${r.slug}`} value={saved?.icon ?? r.icon} />
                <span className={styles.rolePrompt}>{r.prompt}</span>
                <input
                  name={`roleMission-${r.slug}`}
                  defaultValue={saved?.mission ?? ""}
                  placeholder={r.example}
                  className={styles.roleMission}
                />
              </div>
            );
          })}
        </section>

        <Later>
          Add or remove roles in <strong>Settings</strong>. Rewrite a mission — plus success
          criteria, stewardship and failure mode — in the <strong>Roles</strong> tab.
        </Later>

        <div className={shared.actionsRow}>
          <button type="submit" className="btn">
            Next — role depth
          </button>
        </div>
      </form>

      {custom.length > 0 && (
        <section className={shared.createCard}>
          <span className={shared.sectionLabel}>Custom roles you added</span>
          <div className={styles.added}>
            {custom.map((c) => (
              <div key={c.id} className={styles.addedRow}>
                <span>
                  {c.icon} {c.label}
                </span>
                <form action={removeRole}>
                  <input type="hidden" name="id" value={c.id} />
                  <button type="submit" className={shared.tinyBtn}>
                    remove
                  </button>
                </form>
              </div>
            ))}
          </div>
          <p className="sub">
            Removing a role never deletes the outcomes, RAID items or people tagged to it — those
            links just go empty.
          </p>
        </section>
      )}
    </Shell>
  );
}
