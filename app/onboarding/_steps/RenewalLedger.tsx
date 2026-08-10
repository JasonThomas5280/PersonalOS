"use client";

import { useEffect, useRef, useState } from "react";
import shared from "../../tabs.module.css";
import { CADENCE_PER_WEEK } from "../steps";
import styles from "../onboarding.module.css";

/**
 * Wraps the four dimension cards and totals what they cost per week.
 *
 * Renewal comes out of the same slack as outcome work, and the prototype's
 * whole point here is that the arithmetic doesn't negotiate — if the numbers
 * don't fit, something gets cut whether or not you choose it. Reads the fields
 * from the DOM rather than lifting all of them into state, so the server
 * components above stay server components.
 */
export function RenewalLedger({
  slack,
  budget,
  children,
}: {
  slack: number | null;
  budget: number;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [hours, setHours] = useState(0);

  useEffect(() => {
    const root = ref.current;
    if (!root) return;

    const recompute = () => {
      let total = 0;
      for (const el of root.querySelectorAll<HTMLInputElement>('[data-role="practice"]')) {
        if (!el.value.trim()) continue; // blank practice = not started
        const dim = el.dataset.dim;
        const cadence = root.querySelector<HTMLSelectElement>(
          `[data-role="cadence"][data-dim="${dim}"]`,
        );
        const minutes = root.querySelector<HTMLInputElement>(
          `[data-role="minutes"][data-dim="${dim}"]`,
        );
        const perWeek = CADENCE_PER_WEEK[cadence?.value ?? "THREE_X_WEEK"] ?? 3;
        total += (perWeek * (Number(minutes?.value) || 0)) / 60;
      }
      setHours(Math.round(total * 10) / 10);
    };

    recompute();
    root.addEventListener("input", recompute);
    root.addEventListener("change", recompute);
    return () => {
      root.removeEventListener("input", recompute);
      root.removeEventListener("change", recompute);
    };
  }, []);

  const left = slack === null ? null : Math.round((slack - budget - hours) * 10) / 10;
  const leftColor =
    left === null ? "var(--dim)" : left < 0 ? "var(--red)" : left < 5 ? "var(--yellow)" : "var(--green)";

  return (
    <div ref={ref}>
      {children}

      <section className={shared.createCard}>
        <h2 className={shared.sectionLabel}>Your week, so far</h2>
        {slack === null ? (
          <p className="sub">
            Fill in the capacity worksheet and this becomes a real number — right now there&apos;s
            nothing to subtract from.
          </p>
        ) : (
          <>
            <div className={styles.ledger}>
              <span>Weekly slack after obligations</span>
              <span>{slack}h</span>
            </div>
            <div className={styles.ledger}>
              <span>Outcome work budget</span>
              <span style={{ color: "#60a5fa" }}>− {budget}h</span>
            </div>
            <div className={styles.ledger}>
              <span>Renewal{hours === 0 && " (nothing set yet)"}</span>
              <span style={{ color: "var(--gold)" }}>− {hours}h</span>
            </div>
            <div className={styles.ledgerTotal}>
              <span>Unstructured margin left</span>
              <span style={{ color: leftColor }}>{left}h</span>
            </div>
            <p className="sub" style={{ marginTop: 11, color: leftColor }}>
              {left! < 0
                ? "You've allocated more than you have. Cut the outcome budget, shorten a practice, or drop a cadence — the arithmetic doesn't negotiate, and something will get cut whether or not you choose it."
                : left! < 5
                  ? "Under five hours of unclaimed margin. That's every meal, every unplanned conversation, every night something runs long. Workable, but one disruption spends it."
                  : "That's what's left for meals, rest, and ordinary unplanned life. Margin isn't waste — it's what absorbs a bad week so the rest of the system survives it."}
            </p>
          </>
        )}
      </section>
    </div>
  );
}
