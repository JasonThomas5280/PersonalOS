"use client";

import { useState } from "react";
import shared from "../../tabs.module.css";

const TYPES = [
  { value: "RISK", label: "Risk", hint: "Hasn't happened yet. Has a trigger and an exposure." },
  { value: "ACTION", label: "Action", hint: "Something you owe someone, or yourself, by a date." },
  { value: "ISSUE", label: "Issue", hint: "Already happening. Needs classifying and escalating." },
  { value: "DECISION", label: "Decision", hint: "Made, with reasoning and what you rejected." },
];

const SEVERITIES = [
  { value: "", label: "no severity" },
  { value: "S1", label: "S1 — blocking" },
  { value: "S2", label: "S2 — major, no workaround" },
  { value: "S3", label: "S3 — major, workaround exists" },
  { value: "S4", label: "S4 — minor" },
];

const CLASSIFICATIONS = [
  { value: "", label: "unclassified" },
  { value: "STRUCTURAL_GAP", label: "structural gap" },
  { value: "EXECUTION_DEFECT", label: "execution defect" },
  { value: "CONFIGURATION", label: "configuration" },
  { value: "SKILL_GAP", label: "skill gap" },
  { value: "ENVIRONMENT", label: "environment" },
  { value: "DEPENDS_ON_OTHERS", label: "depends on others" },
];

/**
 * Type-aware create form. Only the fields the chosen type owns are rendered,
 * matching the narrowing in lib/raid.ts — a risk's severity has no business
 * being submitted on an action.
 */
export function RaidForm({
  action,
  roles,
  outcomes,
  people,
}: {
  action: (fd: FormData) => Promise<void>;
  roles: { id: string; label: string; icon: string }[];
  outcomes: { id: string; result: string }[];
  people: { id: string; name: string }[];
}) {
  const [type, setType] = useState("RISK");
  const active = TYPES.find((t) => t.value === type)!;

  return (
    <form action={action} className={shared.createCard}>
      <span className={shared.sectionLabel}>Add to the log</span>

      <div className={shared.checks}>
        {TYPES.map((t) => (
          <label key={t.value} className={type === t.value ? shared.chipGold : shared.chip}>
            <input
              type="radio"
              name="type"
              value={t.value}
              checked={type === t.value}
              onChange={() => setType(t.value)}
            />
            {t.label}
          </label>
        ))}
      </div>
      <p className="sub">{active.hint}</p>

      <div className={shared.formGrid}>
        <div className={shared.full}>
          <span className="label">Description</span>
          <input name="description" placeholder="One line, in your own words" />
        </div>

        <div className={shared.full}>
          <span className="label">
            {type === "DECISION" ? "Reasoning — why this call?" : "Impact — what it costs if it lands"}
          </span>
          <textarea
            name="impact"
            rows={2}
            placeholder={
              type === "DECISION"
                ? "The thinking you'll want back in six months"
                : "Concretely, what does this cost you?"
            }
          />
        </div>

        {type === "RISK" && (
          <>
            <div className={shared.full}>
              <span className="label">Trigger — what would tell you it&apos;s happening?</span>
              <input name="trigger" placeholder="The early signal, not the disaster" />
            </div>
            <div>
              <span className="label">Severity</span>
              <select name="severity" defaultValue="">
                {SEVERITIES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <span className="label">Probability</span>
              <select name="probability" defaultValue="">
                <option value="">not set</option>
                <option value="HIGH">high</option>
                <option value="MEDIUM">medium</option>
                <option value="LOW">low</option>
              </select>
            </div>
          </>
        )}

        {type === "ISSUE" && (
          <>
            <div>
              <span className="label">Severity</span>
              <select name="severity" defaultValue="">
                {SEVERITIES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <span className="label">Classification</span>
              <select name="classification" defaultValue="">
                {CLASSIFICATIONS.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
            <div className={shared.full}>
              <span className="label">Escalation path — who do you take this to?</span>
              <input name="escalation" placeholder="A name, not a department" />
            </div>
          </>
        )}

        {type === "DECISION" && (
          <>
            <div className={shared.full}>
              <span className="label">Rejected alternatives — what you didn&apos;t do, and why</span>
              <textarea
                name="alternatives"
                rows={2}
                placeholder="This is the part you'll wish you'd written down"
              />
            </div>
            <div>
              <span className="label">Decided by</span>
              <input name="decidedBy" defaultValue="Me" />
            </div>
            <div>
              <span className="label">Decided on</span>
              <input type="date" name="decidedOn" />
            </div>
          </>
        )}

        {type === "ACTION" && (
          <div>
            <span className="label">Owner</span>
            <input name="owner" defaultValue="Me" />
          </div>
        )}

        <div>
          <span className="label">Due</span>
          <input type="date" name="due" />
        </div>
        <div>
          <span className="label">Role</span>
          <select name="roleId" defaultValue="">
            <option value="">none</option>
            {roles.map((r) => (
              <option key={r.id} value={r.id}>
                {r.icon} {r.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <span className="label">Outcome</span>
          <select name="outcomeId" defaultValue="">
            <option value="">none</option>
            {outcomes.map((o) => (
              <option key={o.id} value={o.id}>
                {o.result}
              </option>
            ))}
          </select>
        </div>
        {people.length > 0 && (
          <div>
            <span className="label">Person</span>
            <select name="personId" defaultValue="">
              <option value="">none</option>
              {people.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      <div className={shared.actionsRow}>
        <button type="submit" className="btnGhost">
          Add to the log
        </button>
      </div>
    </form>
  );
}
