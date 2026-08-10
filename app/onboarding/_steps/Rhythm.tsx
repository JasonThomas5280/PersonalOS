import Link from "next/link";
import shared from "../../tabs.module.css";
import { Shell } from "../Shell";
import { href } from "../steps";
import styles from "../onboarding.module.css";

const RHYTHMS = [
  {
    when: "Daily · 2 minutes",
    color: "var(--green)",
    head: "Set the Big 3 and tag the quadrant.",
    body: "Three priorities, each linked to a role and an outcome. The quadrant tag is the honest part — it's how you find out whether you're building or just firefighting. Tap your renewal practice if you did it.",
  },
  {
    when: "As it happens · 5 minutes",
    color: "#60a5fa",
    head: "Capture, within ten minutes.",
    body: "After a real conversation or a decision that mattered, dump it into Capture while it's fresh. It pulls out decisions, actions, risks and people and files them. Ten minutes later your memory has already started editing.",
  },
  {
    when: "Weekly · 20 minutes",
    color: "var(--gold)",
    head: "The review — same day, every week.",
    body: "What went well, what didn't and why, where the calendar drifted from your role missions, what you owe people, and next week's big rocks. Pick a day and defend it. Sunday morning beats Friday afternoon; Friday you're spent.",
  },
  {
    when: "Quarterly · 90 minutes",
    color: "#a78bfa",
    head: "The retro — root cause, not status.",
    body: "The weekly review says what happened. The retro says why it keeps happening. It ends in process changes with target dates — mechanisms, not resolutions. A retro without owned changes is a complaint log.",
  },
];

export function RhythmStep() {
  return (
    <Shell
      slug="rhythm"
      title="Rhythm"
      lede={
        <p className={styles.body}>
          Four rhythms. If you only ever run the first two, the system still works.
        </p>
      }
    >
      {RHYTHMS.map((r) => (
        <section
          key={r.when}
          className={shared.createCard}
          style={{ borderLeft: `3px solid ${r.color}` }}
        >
          <span className="kicker" style={{ color: r.color }}>
            {r.when}
          </span>
          <strong style={{ color: "var(--heading)", fontSize: 14.5 }}>{r.head}</strong>
          <p className="sub">{r.body}</p>
        </section>
      ))}

      <section className={shared.createCard}>
        <span className={shared.sectionLabel}>What can stay empty for now</span>
        <p className="sub">
          <strong>Weekly review and retro</strong> — these are dated records that accrue as you use
          the system; there&apos;s nothing to enter up front. The retro needs a quarter of history
          before it has anything to say.
          <br />
          <strong>Big 3</strong> — tomorrow morning, not tonight. It&apos;s a daily record, and
          backdating it defeats the point.
        </p>
      </section>

      <div className={shared.actionsRow}>
        <Link href={href("done")} className="btn">
          Finish setup
        </Link>
      </div>
    </Shell>
  );
}
