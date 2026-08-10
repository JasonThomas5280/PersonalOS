import { prisma } from "@/lib/prisma";
import shared from "../tabs.module.css";
import { completeOnboarding } from "./actions";
import styles from "./onboarding.module.css";

export const dynamic = "force-dynamic";

const DEFAULT_ROLES = [
  { slug: "faith", label: "Faith Leader", icon: "✝", hint: "Ministry, teaching, spiritual leadership of other people" },
  { slug: "husband", label: "Husband", icon: "♥", hint: "Your marriage as its own thing, separate from family logistics" },
  { slug: "father", label: "Father", icon: "★", hint: "Your kids — presence, formation, showing up" },
  { slug: "professional", label: "Professional", icon: "◆", hint: "The job — craft, reputation, the people you work with" },
  { slug: "builder", label: "Builder", icon: "⚡", hint: "Side ventures, projects, the things you're making" },
  { slug: "self", label: "Self", icon: "◉", hint: "Health, learning, the person you're becoming" },
];

const SAW_DIMS = [
  { key: "PHYSICAL", label: "Physical", ex: "30 min walk before the day starts" },
  { key: "MENTAL", label: "Mental", ex: "20 pages of something not work-related" },
  { key: "SPIRITUAL", label: "Spiritual", ex: "Scripture and silence before the phone" },
  { key: "SOCIAL", label: "Social / Emotional", ex: "One unhurried conversation with no agenda" },
];

export default async function OnboardingPage() {
  const existingRoles = await prisma.role.findMany();
  const known = new Set(existingRoles.map((r) => r.slug));

  return (
    <div className={styles.wrap}>
      <div className="kicker">Personal Operating System</div>
      <h1 className="h1">Let&apos;s set up the parts that matter.</h1>
      <p className={styles.body}>
        You&apos;ll leave with a mission, your roles, an honest number for how much time you
        actually have, one outcome, and one renewal practice. That&apos;s a working system —
        nothing you enter is permanent, and everything is editable inside the app.
      </p>

      <form action={completeOnboarding} className={styles.form}>
        <section className={shared.createCard}>
          <span className={shared.sectionLabel}>1 · Mission — what is all of this for?</span>
          <p className="sub">
            It doesn&apos;t need to be good, it needs to exist — so six months from now you can
            check whether your calendar still agrees with it.
          </p>
          <textarea
            name="mission"
            rows={3}
            placeholder="Write it plainly. A rough one beats a perfect one you never wrote."
          />
        </section>

        <section className={shared.createCard}>
          <span className={shared.sectionLabel}>
            2 · Roles — which are you actually carrying?
          </span>
          <p className="sub">
            Four to seven works. A role&apos;s mission is a standing definition, not a goal —
            still true in ten years.
          </p>
          {DEFAULT_ROLES.map((r) => (
            <div key={r.slug} className={styles.roleRow}>
              <label className={styles.roleCheck}>
                <input
                  type="checkbox"
                  name="roles"
                  value={r.slug}
                  defaultChecked={known.size === 0 || known.has(r.slug)}
                />
                <span>
                  {r.icon} <strong>{r.label}</strong>
                </span>
                <span className="sub">{r.hint}</span>
              </label>
              <input type="hidden" name={`label-${r.slug}`} value={r.label} />
              <input type="hidden" name={`icon-${r.slug}`} value={r.icon} />
              <input
                name={`roleMission-${r.slug}`}
                placeholder="One sentence: the kind of person you're trying to be in this role"
                className={styles.roleMission}
              />
            </div>
          ))}
        </section>

        <section className={shared.createCard}>
          <span className={shared.sectionLabel}>
            3 · Capacity — hours per week for outcome work
          </span>
          <p className="sub">
            Everyone has 168 hours. After sleep, work, family, and the endless small stuff,
            half of your remaining slack is a realistic ceiling for deliberate outcome work.
            An inflated budget makes the collision engine agree with you instead of warning
            you. Zero is a real answer.
          </p>
          <input type="number" step="0.5" name="capacityBudget" defaultValue={12} style={{ maxWidth: 140 }} />
        </section>

        <section className={shared.createCard}>
          <span className={shared.sectionLabel}>4 · One outcome. Just one. (optional)</span>
          <p className="sub">
            The one you&apos;d be most upset to look back on and find untouched. It starts in
            Exploring; move it to Building when you actually commit.
          </p>
          <div className={shared.formGrid}>
            <div className={shared.full}>
              <span className="label">Result — what specifically gets finished?</span>
              <input name="outcomeResult" placeholder="Concrete enough that you'd know if it happened" />
            </div>
            <div className={shared.full}>
              <span className="label">Purpose — why does it matter to your soul, not your schedule?</span>
              <textarea name="outcomePurpose" rows={2} placeholder="This is the fuel. Write the version that makes your chest tighten a little." />
            </div>
            <div>
              <span className="label">Primary role</span>
              <select name="outcomeRole" defaultValue="">
                <option value="">none</option>
                {DEFAULT_ROLES.map((r) => (
                  <option key={r.slug} value={r.slug}>
                    {r.icon} {r.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <span className="label">Target date (sets the baseline)</span>
              <input type="date" name="outcomeTarget" />
            </div>
            <div>
              <span className="label">Hours per week — honest guess</span>
              <input type="number" step="0.5" name="outcomeHours" />
            </div>
          </div>
        </section>

        <section className={shared.createCard}>
          <span className={shared.sectionLabel}>
            5 · Renewal — pick one thing to keep sharp (optional)
          </span>
          <p className="sub">
            Starting all four dimensions is how people end up with zero. The minimum viable
            version is the bad-week floor — a streak that survives a bad week beats a perfect
            one that breaks.
          </p>
          <div className={shared.formGrid}>
            <div>
              <span className="label">Dimension</span>
              <select name="sawDimension" defaultValue="">
                <option value="">skip for now</option>
                {SAW_DIMS.map((d) => (
                  <option key={d.key} value={d.key}>
                    {d.label}
                  </option>
                ))}
              </select>
            </div>
            <div className={shared.full}>
              <span className="label">The practice</span>
              <input name="sawPractice" placeholder={SAW_DIMS[0].ex} />
            </div>
            <div className={shared.full}>
              <span className="label">Minimum viable version — the bad-week floor</span>
              <input name="sawFloor" placeholder="Ten minutes outside, no phone" />
            </div>
            <div>
              <span className="label">Cadence</span>
              <select name="sawCadence" defaultValue="THREE_X_WEEK">
                <option value="DAILY">daily</option>
                <option value="FIVE_X_WEEK">5× / week</option>
                <option value="THREE_X_WEEK">3× / week</option>
                <option value="WEEKLY">weekly</option>
              </select>
            </div>
            <div>
              <span className="label">Minutes / session</span>
              <input type="number" name="sawMinutes" defaultValue={30} />
            </div>
            <div>
              <span className="label">Floor minutes</span>
              <input type="number" name="sawFloorMinutes" defaultValue={10} />
            </div>
          </div>
        </section>

        <div className={shared.actionsRow}>
          <button type="submit" className="btn">
            Save and open the system
          </button>
        </div>
        <p className="sub">
          The daily rhythm from here: set the Big 3 each morning (tag the quadrant — that&apos;s
          the honest part), a 20-minute weekly review on the same day every week, and a
          quarterly retro that ends in owned process changes.
        </p>
      </form>
    </div>
  );
}
