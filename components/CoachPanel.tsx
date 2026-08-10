"use client";

import { useState } from "react";
import styles from "./CoachPanel.module.css";

/**
 * Asks /api/coach for a readout over the current snapshot. The route builds the
 * snapshot itself and holds the API key — this only sends an optional question.
 */
export function CoachPanel() {
  const [question, setQuestion] = useState("");
  const [readout, setReadout] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function ask() {
    setLoading(true);
    setError(null);
    setReadout(null);
    try {
      const res = await fetch("/api/coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: question.trim() }),
      });
      const data = await res.json();
      if (data.readout) setReadout(data.readout);
      else setError(data.error ?? "The coach didn't return anything.");
    } catch {
      setError("Couldn't reach the coach. Check your connection and try again.");
    }
    setLoading(false);
  }

  return (
    <div className={styles.panel}>
      <div className={styles.row}>
        <input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !loading) ask();
          }}
          placeholder="Ask something specific, or leave blank for a general readout"
        />
        {/* Gold, not ghost — this was the quietest control on a long page and
            read as decoration rather than the feature. */}
        <button type="button" onClick={ask} disabled={loading} className="btn">
          {loading ? "Reading…" : "Ask the coach"}
        </button>
      </div>

      {error && (
        <p className="sub" style={{ color: "var(--red)" }}>
          {error}
        </p>
      )}

      {readout && <div className={styles.readout}>{readout}</div>}

      {!readout && !error && !loading && (
        <p className="sub">
          Claude reads your mission, roles, outcomes, alerts and today&apos;s Big 3, then tells you
          where things actually stand and one Q2 move for tomorrow. Nothing is written — it only
          reads.
        </p>
      )}
    </div>
  );
}
