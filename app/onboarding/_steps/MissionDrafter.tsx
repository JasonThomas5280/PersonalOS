"use client";

import { useState } from "react";
import shared from "../../tabs.module.css";

const SEED_QUESTIONS = [
  {
    key: "serves",
    label: "What do you want your life to be in service of?",
    hint: "Not a job title. The thing underneath it.",
  },
  {
    key: "depends",
    label: "Who depends on you actually getting this right?",
    hint: "Name them.",
  },
  {
    key: "regret",
    label: "What would you regret not having built?",
    hint: "Ten years out, looking back.",
  },
] as const;

type SeedKey = (typeof SEED_QUESTIONS)[number]["key"];

/**
 * The seed questions and the optional AI draft. Only `mission` is submitted —
 * the seeds are scaffolding for writing it, not data the system keeps.
 */
export function MissionDrafter({ initial }: { initial: string }) {
  const [seed, setSeed] = useState<Record<SeedKey, string>>({ serves: "", depends: "", regret: "" });
  const [mission, setMission] = useState(initial);
  const [drafting, setDrafting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const anyAnswered = Object.values(seed).some((v) => v.trim());

  async function draft() {
    setDrafting(true);
    setError(null);
    try {
      const res = await fetch("/api/draft-mission", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(seed),
      });
      const data = await res.json();
      if (data.mission) setMission(data.mission);
      else setError(data.error ?? "Couldn't draft that one.");
    } catch {
      setError(
        "Couldn't draft that. Write it yourself below — a rough one beats a perfect one you never wrote.",
      );
    }
    setDrafting(false);
  }

  return (
    <>
      <section className={shared.createCard}>
        {SEED_QUESTIONS.map((q) => (
          <div key={q.key} style={{ marginBottom: 14 }}>
            <label className="label">{q.label}
            <textarea
              rows={2}
              placeholder={q.hint}
              value={seed[q.key]}
              onChange={(e) => setSeed({ ...seed, [q.key]: e.target.value })}
            /></label>
          </div>
        ))}
        <button
          type="button"
          onClick={draft}
          disabled={drafting || !anyAnswered}
          className="btnGhost"
          style={{ opacity: drafting || !anyAnswered ? 0.4 : 1 }}
        >
          {drafting ? "Drafting…" : "Draft a mission from these"}
        </button>
        {error && (
          <p className="sub" style={{ color: "var(--red)", marginTop: 10 }}>
            {error}
          </p>
        )}
      </section>

      <section className={shared.createCard}>
        <label className="label">Your mission — edit freely, this is yours
        <textarea
          name="mission"
          rows={4}
          value={mission}
          onChange={(e) => setMission(e.target.value)}
          placeholder="Write it yourself, or use the draft button and rewrite what doesn't sound like you."
          style={{ color: "var(--gold)", fontStyle: mission ? "italic" : "normal" }}
        /></label>
      </section>
    </>
  );
}
