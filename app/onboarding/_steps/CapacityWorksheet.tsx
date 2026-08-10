"use client";

import { useState } from "react";
import shared from "../../tabs.module.css";
import { CAPACITY_FIELDS } from "../steps";
import styles from "../onboarding.module.css";

/**
 * The 168-hour worksheet. Everyone has 168 hours; committed time comes off the
 * top, and half the remaining slack is a realistic ceiling for deliberate
 * outcome work — the other half is meals, rest and the margin that keeps a bad
 * week from becoming a bad month.
 *
 * The arithmetic is the point: an inflated budget makes the collision engine
 * agree with you instead of warning you.
 */
export function CapacityWorksheet({
  initial,
  initialBudget,
}: {
  initial: Record<string, number | null>;
  initialBudget: number;
}) {
  const [hours, setHours] = useState<Record<string, string>>(
    Object.fromEntries(
      CAPACITY_FIELDS.map((f) => [f.key, String(initial[f.key] ?? f.def)]),
    ),
  );
  const committed = CAPACITY_FIELDS.reduce((a, f) => a + (Number(hours[f.key]) || 0), 0);
  const slack = Math.max(0, 168 - committed);
  const suggested = Math.max(0, Math.round(slack * 0.5 * 2) / 2);

  // Blank means "use the suggestion"; once touched it stays the user's number.
  const [budget, setBudget] = useState<string>(
    initialBudget ? String(initialBudget) : "",
  );
  const effective = budget === "" ? suggested : Number(budget) || 0;
  const tight = effective > slack * 0.7 && effective > 0;

  const slackColor = slack < 10 ? "var(--red)" : slack < 25 ? "var(--yellow)" : "var(--green)";

  return (
    <>
      <section className={shared.createCard}>
        {CAPACITY_FIELDS.map((f) => (
          <div key={f.key} className={styles.hoursRow}>
            <div>
              <div style={{ fontSize: 13.5 }}>{f.label}</div>
              <div className="sub">{f.hint}</div>
            </div>
            <input
              type="number"
              step="0.5"
              min="0"
              name={f.key}
              value={hours[f.key]}
              onChange={(e) => setHours({ ...hours, [f.key]: e.target.value })}
            />
            <span className="sub">hrs</span>
          </div>
        ))}

        <div className={styles.ledgerTotal}>
          <span>Committed</span>
          <span>{committed}h</span>
        </div>
        <div className={styles.ledgerTotal}>
          <span>Weekly slack</span>
          <span style={{ color: slackColor }}>{slack}h</span>
        </div>
      </section>

      <section className={shared.createCard}>
        <p className="sub">
          That slack isn&apos;t all available. It&apos;s also meals, rest, unstructured time with
          people you love, and the margin that keeps a bad week from becoming a bad month. Half of
          it is a realistic ceiling for deliberate outcome work — and your renewal practices come
          out of this same pool, which the next screens will hold you to.
        </p>
        <label className="label">
          Weekly hours for outcome work
        <div style={{ display: "flex", gap: 11, alignItems: "center", flexWrap: "wrap" }}>
          <input
            type="number"
            step="0.5"
            min="0"
            name="capacityBudget"
            value={budget === "" ? suggested : budget}
            onChange={(e) => setBudget(e.target.value)}
            style={{ width: 110, fontSize: 17, fontWeight: 700, color: "var(--gold)" }}
          />
          <span className="sub">
            hours / week{budget === "" && ` · suggested from your ${slack}h slack`}
          </span>
        </div>
        </label>
        {tight && (
          <p className="sub" style={{ color: "var(--yellow)", marginTop: 10 }}>
            That&apos;s most of your remaining slack, and renewal still has to come out of
            what&apos;s left. It&apos;ll work for a sprint, not a season.
          </p>
        )}
        {effective <= 0 && (
          <p className="sub" style={{ color: "var(--red)", marginTop: 10 }}>
            Zero is a real answer. If that&apos;s the season you&apos;re in, set the system up
            anyway and run it in maintenance — the renewal tab and the weekly review still earn
            their keep.
          </p>
        )}
      </section>
    </>
  );
}
