"use client";

import { useState } from "react";
import shared from "../tabs.module.css";
import styles from "./capture.module.css";
import {
  commitProposals,
  type CommitResult,
  type PersonProposal,
  type RaidProposal,
} from "./actions";

const CATEGORIES = [
  "INFORMATIONAL",
  "CONNECTIVE",
  "TIME",
  "ACKNOWLEDGMENT",
  "OPERATIONAL",
  "PRESENCE",
];

const SEVERITIES = ["", "S1", "S2", "S3", "S4"];
const PROBABILITIES = ["", "HIGH", "MEDIUM", "LOW"];

type Extraction = {
  raid: RaidProposal[];
  people: (PersonProposal & { isKnown?: boolean })[];
  notes: string;
};

/** Each proposal carries its own approve flag; nothing is written unchecked. */
type Row<T> = { on: boolean; value: T };

export function CaptureClient({
  roles,
  outcomes,
}: {
  roles: { id: string; label: string; icon: string }[];
  outcomes: { id: string; result: string }[];
}) {
  const [text, setText] = useState("");
  const [extracting, setExtracting] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [raid, setRaid] = useState<Row<RaidProposal>[]>([]);
  const [people, setPeople] = useState<Row<PersonProposal & { isKnown?: boolean }>[]>([]);
  const [result, setResult] = useState<CommitResult | null>(null);

  const hasProposals = raid.length > 0 || people.length > 0;
  const approved = raid.filter((r) => r.on).length + people.filter((p) => p.on).length;

  async function extract() {
    setExtracting(true);
    setError(null);
    setResult(null);
    setRaid([]);
    setPeople([]);
    setNotes("");
    try {
      const res = await fetch("/api/capture", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const data = await res.json();
      if (data.error) {
        setError(data.error);
      } else {
        const p = data.proposals as Extraction;
        setRaid((p.raid ?? []).map((value) => ({ on: true, value })));
        setPeople(
          (p.people ?? []).map((value) => ({
            on: true,
            value: { ...value, contributionCategory: "INFORMATIONAL" },
          })),
        );
        setNotes(p.notes ?? "");
        if (!(p.raid ?? []).length && !(p.people ?? []).length) {
          setError("Nothing structured came out of that — try adding more specifics.");
        }
      }
    } catch {
      setError("Couldn't reach the capture service.");
    }
    setExtracting(false);
  }

  async function commit() {
    setCommitting(true);
    setError(null);
    try {
      const res = await commitProposals(
        raid.filter((r) => r.on).map((r) => r.value),
        people.filter((p) => p.on).map((p) => p.value),
      );
      setResult(res);
      setRaid([]);
      setPeople([]);
      setNotes("");
      setText("");
    } catch (e) {
      setError((e as Error).message);
    }
    setCommitting(false);
  }

  function patchRaid(i: number, patch: Partial<RaidProposal>) {
    setRaid((rows) =>
      rows.map((r, ri) => (ri === i ? { ...r, value: { ...r.value, ...patch } } : r)),
    );
  }
  function patchPerson(i: number, patch: Partial<PersonProposal>) {
    setPeople((rows) =>
      rows.map((p, pi) => (pi === i ? { ...p, value: { ...p.value, ...patch } } : p)),
    );
  }

  return (
    <>
      <section className={shared.createCard}>
        <h2 className={shared.sectionLabel}>The dump</h2>
        <p className="sub">
          Within ten minutes of the conversation, while you still remember what was actually said.
          Ten minutes later your memory has already started editing.
        </p>
        <textarea
          rows={8}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Who you spoke to, what got decided, what you promised, what worries you now."
        />
        <div className={shared.actionsRow}>
          <button
            type="button"
            onClick={extract}
            disabled={extracting || !text.trim()}
            className="btn"
          >
            {extracting ? "Reading…" : "Pull out the structure"}
          </button>
        </div>
      </section>

      {error && (
        <p className="sub" style={{ color: "var(--red)" }}>
          {error}
        </p>
      )}

      {result && (
        <section className={shared.createCard}>
          <h2 className={shared.sectionLabel}>Filed</h2>
          <p className="sub">
            {result.raid} RAID {result.raid === 1 ? "item" : "items"} · {result.people} new{" "}
            {result.people === 1 ? "person" : "people"} · {result.contributions} contributions ·{" "}
            {result.commitments} commitments · {result.situations} situation notes.
          </p>
          {result.errors.length > 0 && (
            <p className="sub" style={{ color: "var(--red)" }}>
              {result.errors.join(" · ")}
            </p>
          )}
        </section>
      )}

      {notes && (
        <div className={styles.notes}>
          <strong>What it inferred:</strong> {notes}
        </div>
      )}

      {hasProposals && (
        <>
          <p className="sub">
            Nothing below is saved yet. Untick anything that isn&apos;t right, edit what is nearly
            right, then file it.
          </p>

          {raid.length > 0 && (
            <section className={shared.createCard}>
              <h2 className={shared.sectionLabel}>RAID ({raid.length})</h2>
              {raid.map((r, i) => (
                <div key={i} className={styles.proposal} data-on={r.on}>
                  <label className={styles.head}>
                    <input
                      type="checkbox"
                      checked={r.on}
                      onChange={() => setRaid((rows) => rows.map((x, xi) => (xi === i ? { ...x, on: !x.on } : x)))}
                    />
                    <span className={shared.chipGold}>{r.value.type.toLowerCase()}</span>
                  </label>
                  <div className={shared.formGrid}>
                    <div className={shared.full}>
                      <label className="label">Description
                      <input
                        value={r.value.description}
                        onChange={(e) => patchRaid(i, { description: e.target.value })}
                      /></label>
                    </div>
                    <div className={shared.full}>
                      <label className="label">
                        {r.value.type === "DECISION" ? "Reasoning" : "Impact"}
                      
                      <textarea
                        rows={2}
                        value={r.value.impact}
                        onChange={(e) => patchRaid(i, { impact: e.target.value })}
                      /></label>
                    </div>
                    {r.value.type === "RISK" && (
                      <>
                        <div className={shared.full}>
                          <label className="label">Trigger
                          <input
                            value={r.value.trigger}
                            onChange={(e) => patchRaid(i, { trigger: e.target.value })}
                          /></label>
                        </div>
                        <div>
                          <label className="label">Severity
                          <select
                            value={r.value.severity}
                            onChange={(e) => patchRaid(i, { severity: e.target.value })}
                          >
                            {SEVERITIES.map((s) => (
                              <option key={s} value={s}>
                                {s || "not set"}
                              </option>
                            ))}
                          </select></label>
                        </div>
                        <div>
                          <label className="label">Probability
                          <select
                            value={r.value.probability}
                            onChange={(e) => patchRaid(i, { probability: e.target.value })}
                          >
                            {PROBABILITIES.map((p) => (
                              <option key={p} value={p}>
                                {p ? p.toLowerCase() : "not set"}
                              </option>
                            ))}
                          </select></label>
                        </div>
                      </>
                    )}
                    {r.value.type === "DECISION" && (
                      <div className={shared.full}>
                        <label className="label">Rejected alternatives
                        <textarea
                          rows={2}
                          value={r.value.alternatives}
                          onChange={(e) => patchRaid(i, { alternatives: e.target.value })}
                        /></label>
                      </div>
                    )}
                    <div>
                      <label className="label">Due
                      <input
                        type="date"
                        value={r.value.due}
                        onChange={(e) => patchRaid(i, { due: e.target.value })}
                      /></label>
                    </div>
                    <div>
                      <label className="label">Role
                      <select
                        value={r.value.roleId ?? ""}
                        onChange={(e) => patchRaid(i, { roleId: e.target.value })}
                      >
                        <option value="">none</option>
                        {roles.map((role) => (
                          <option key={role.id} value={role.id}>
                            {role.icon} {role.label}
                          </option>
                        ))}
                      </select></label>
                    </div>
                    <div>
                      <label className="label">Outcome
                      <select
                        value={r.value.outcomeId ?? ""}
                        onChange={(e) => patchRaid(i, { outcomeId: e.target.value })}
                      >
                        <option value="">none</option>
                        {outcomes.map((o) => (
                          <option key={o.id} value={o.id}>
                            {o.result}
                          </option>
                        ))}
                      </select></label>
                    </div>
                  </div>
                </div>
              ))}
            </section>
          )}

          {people.length > 0 && (
            <section className={shared.createCard}>
              <h2 className={shared.sectionLabel}>People ({people.length})</h2>
              {people.map((p, i) => (
                <div key={i} className={styles.proposal} data-on={p.on}>
                  <label className={styles.head}>
                    <input
                      type="checkbox"
                      checked={p.on}
                      onChange={() =>
                        setPeople((rows) => rows.map((x, xi) => (xi === i ? { ...x, on: !x.on } : x)))
                      }
                    />
                    <strong>{p.value.name}</strong>
                    <span className="sub">
                      {p.value.isKnown ? "already in the system" : "new — will be added to People"}
                    </span>
                  </label>
                  <div className={shared.formGrid}>
                    <div className={shared.full}>
                      <label className="label">Name
                      <input
                        value={p.value.name}
                        onChange={(e) => patchPerson(i, { name: e.target.value })}
                      /></label>
                    </div>
                    {p.value.situationNote && (
                      <div className={shared.full}>
                        <label className="label">Situation — appended, never overwritten
                        <input
                          value={p.value.situationNote}
                          onChange={(e) => patchPerson(i, { situationNote: e.target.value })}
                        /></label>
                      </div>
                    )}
                    {p.value.contributionGiven && (
                      <>
                        <div className={shared.full}>
                          <label className="label">Contribution you gave
                          <input
                            value={p.value.contributionGiven}
                            onChange={(e) => patchPerson(i, { contributionGiven: e.target.value })}
                          /></label>
                        </div>
                        <div>
                          <label className="label">Category
                          <select
                            value={p.value.contributionCategory ?? "INFORMATIONAL"}
                            onChange={(e) => patchPerson(i, { contributionCategory: e.target.value })}
                          >
                            {CATEGORIES.map((c) => (
                              <option key={c} value={c}>
                                {c.toLowerCase()}
                              </option>
                            ))}
                          </select></label>
                        </div>
                      </>
                    )}
                    {p.value.commitmentOwed && (
                      <>
                        <div className={shared.full}>
                          <label className="label">Commitment you now owe
                          <input
                            value={p.value.commitmentOwed}
                            onChange={(e) => patchPerson(i, { commitmentOwed: e.target.value })}
                          /></label>
                        </div>
                        <div>
                          <label className="label">Due
                          <input
                            type="date"
                            value={p.value.commitmentDue}
                            onChange={(e) => patchPerson(i, { commitmentDue: e.target.value })}
                          /></label>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </section>
          )}

          <div className={shared.actionsRow}>
            <button
              type="button"
              onClick={commit}
              disabled={committing || approved === 0}
              className="btn"
            >
              {committing ? "Filing…" : `File ${approved} ${approved === 1 ? "item" : "items"}`}
            </button>
            <button
              type="button"
              onClick={() => {
                setRaid([]);
                setPeople([]);
                setNotes("");
              }}
              className="btnGhost"
            >
              Discard
            </button>
          </div>
        </>
      )}
    </>
  );
}
