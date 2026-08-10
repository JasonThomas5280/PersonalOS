import Link from "next/link";
import { createRaidItem, deleteRaidItem, updateRaidItem } from "@/app/actions";
import { PROBABILITY_N, SEVERITY_N } from "@/lib/alerts";
import { isoDate } from "@/lib/dates";
import { prisma } from "@/lib/prisma";
import type { RaidType } from "@prisma/client";
import shared from "../tabs.module.css";

export const dynamic = "force-dynamic";

const TYPES: Array<{ key: RaidType; label: string }> = [
  { key: "RISK", label: "Risks" },
  { key: "ACTION", label: "Actions" },
  { key: "ISSUE", label: "Issues" },
  { key: "DECISION", label: "Decisions" },
];
const STATUSES = ["OPEN", "IN_PROGRESS", "BLOCKED", "DEFERRED", "CLOSED"] as const;
const CLASSIFICATIONS = [
  "STRUCTURAL_GAP",
  "EXECUTION_DEFECT",
  "CONFIGURATION",
  "SKILL_GAP",
  "ENVIRONMENT",
  "DEPENDS_ON_OTHERS",
] as const;

function exposure(severity: keyof typeof SEVERITY_N | null, probability: keyof typeof PROBABILITY_N | null) {
  return severity && probability ? SEVERITY_N[severity] * PROBABILITY_N[probability] : null;
}

export default async function RaidPage({ searchParams }: PageProps<"/raid">) {
  const params = await searchParams;
  const typeFilter = TYPES.find((t) => t.key === params.type)?.key;
  const showClosed = params.closed === "1";

  const [items, roles, outcomes, people] = await Promise.all([
    prisma.raidItem.findMany({
      where: {
        ...(typeFilter ? { type: typeFilter } : {}),
        ...(showClosed ? {} : { status: { not: "CLOSED" } }),
      },
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      include: { role: true, outcome: true, person: true },
    }),
    prisma.role.findMany({ orderBy: { sortOrder: "asc" } }),
    prisma.outcome.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.person.findMany({ orderBy: { name: "asc" } }),
  ]);

  const linkFields = (item?: (typeof items)[number]) => (
    <>
      <div>
        <span className="label">Role</span>
        <select name="roleId" defaultValue={item?.roleId ?? ""}>
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
        <select name="outcomeId" defaultValue={item?.outcomeId ?? ""}>
          <option value="">none</option>
          {outcomes.map((o) => (
            <option key={o.id} value={o.id}>
              {o.result}
            </option>
          ))}
        </select>
      </div>
      <div>
        <span className="label">Person</span>
        <select name="personId" defaultValue={item?.personId ?? ""}>
          <option value="">none</option>
          {people.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>
    </>
  );

  return (
    <div className={shared.stack}>
      <div>
        <h1 className="h1">RAID</h1>
        <p className="sub">
          Risks, Actions, Issues, Decisions — one log. Risk exposure = severity × probability,
          flagged at ≥ 9. Closing anything requires a resolution note.
        </p>
      </div>

      <div className={shared.filterRow}>
        <Link href="/raid" className={!typeFilter ? shared.chipGold : shared.chip}>
          All
        </Link>
        {TYPES.map((t) => (
          <Link
            key={t.key}
            href={`/raid?type=${t.key}${showClosed ? "&closed=1" : ""}`}
            className={typeFilter === t.key ? shared.chipGold : shared.chip}
          >
            {t.label}
          </Link>
        ))}
        <Link
          href={`/raid?${typeFilter ? `type=${typeFilter}&` : ""}closed=${showClosed ? "0" : "1"}`}
          className={showClosed ? shared.chipGold : shared.chip}
        >
          {showClosed ? "Hiding nothing" : "Show closed"}
        </Link>
      </div>

      {items.map((item) => {
        const exp = item.type === "RISK" ? exposure(item.severity, item.probability) : null;
        return (
          <details key={item.id} className={`card ${shared.item}`}>
            <summary>
              <span className={shared.chip}>{item.type.toLowerCase()}</span>
              <span className={shared.title}>{item.description}</span>
              <span className={shared.meta}>
                <span className={item.status === "BLOCKED" ? shared.chipRed : shared.chip}>
                  {item.status.toLowerCase().replace("_", " ")}
                </span>
                {exp !== null && (
                  <span className={exp >= 9 ? shared.chipRed : shared.chip}>exposure {exp}</span>
                )}
                {item.due && <span>due {isoDate(item.due)}</span>}
                {item.role && <span>{item.role.icon}</span>}
                {item.person && <span>{item.person.name}</span>}
              </span>
            </summary>
            <div className={shared.body}>
              <form action={updateRaidItem} className={shared.formGrid}>
                <input type="hidden" name="id" value={item.id} />
                <div className={shared.full}>
                  <span className="label">Description</span>
                  <input name="description" defaultValue={item.description} required />
                </div>
                <div>
                  <span className="label">Status</span>
                  <select name="status" defaultValue={item.status}>
                    {STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {s.toLowerCase().replace("_", " ")}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <span className="label">Owner</span>
                  <input name="owner" defaultValue={item.owner} />
                </div>
                <div>
                  <span className="label">Due</span>
                  <input type="date" name="due" defaultValue={item.due ? isoDate(item.due) : ""} />
                </div>
                {item.type === "RISK" && (
                  <>
                    <div className={shared.full}>
                      <span className="label">Trigger — what turns this risk into an issue</span>
                      <input name="trigger" defaultValue={item.trigger} />
                    </div>
                    <div>
                      <span className="label">Severity</span>
                      <select name="severity" defaultValue={item.severity ?? ""}>
                        <option value="">not set</option>
                        <option value="S1">S1 — blocking</option>
                        <option value="S2">S2 — major, no workaround</option>
                        <option value="S3">S3 — major, workaround exists</option>
                        <option value="S4">S4 — minor</option>
                      </select>
                    </div>
                    <div>
                      <span className="label">Probability</span>
                      <select name="probability" defaultValue={item.probability ?? ""}>
                        <option value="">not set</option>
                        <option value="HIGH">high</option>
                        <option value="MEDIUM">medium</option>
                        <option value="LOW">low</option>
                      </select>
                    </div>
                  </>
                )}
                {item.type === "ISSUE" && (
                  <>
                    <div>
                      <span className="label">Severity</span>
                      <select name="severity" defaultValue={item.severity ?? ""}>
                        <option value="">not set</option>
                        <option value="S1">S1</option>
                        <option value="S2">S2</option>
                        <option value="S3">S3</option>
                        <option value="S4">S4</option>
                      </select>
                    </div>
                    <div>
                      <span className="label">Classification</span>
                      <select name="classification" defaultValue={item.classification ?? ""}>
                        <option value="">not set</option>
                        {CLASSIFICATIONS.map((c) => (
                          <option key={c} value={c}>
                            {c.toLowerCase().replace(/_/g, " ")}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className={shared.full}>
                      <span className="label">Escalation path</span>
                      <input name="escalation" defaultValue={item.escalation} />
                    </div>
                  </>
                )}
                {item.type === "DECISION" && (
                  <>
                    <div className={shared.full}>
                      <span className="label">Reasoning</span>
                      <textarea name="impact" defaultValue={item.impact} rows={2} />
                    </div>
                    <div className={shared.full}>
                      <span className="label">Rejected alternatives — and why they lost</span>
                      <textarea name="alternatives" defaultValue={item.alternatives} rows={2} />
                    </div>
                    <div>
                      <span className="label">Decided by</span>
                      <input name="decidedBy" defaultValue={item.decidedBy} />
                    </div>
                    <div>
                      <span className="label">Decided on</span>
                      <input type="date" name="decidedOn" defaultValue={item.decidedOn ? isoDate(item.decidedOn) : ""} />
                    </div>
                  </>
                )}
                {item.type !== "DECISION" && (
                  <div className={shared.full}>
                    <span className="label">Impact</span>
                    <textarea name="impact" defaultValue={item.impact} rows={2} />
                  </div>
                )}
                {linkFields(item)}
                <div className={shared.full}>
                  <span className="label">Resolution — required to close</span>
                  <textarea name="resolution" defaultValue={item.resolution} rows={2} />
                </div>
                <div className={`${shared.full} ${shared.actionsRow}`}>
                  <button type="submit" className="btn">
                    Save
                  </button>
                  {item.closedOn && <span className="sub">closed {isoDate(item.closedOn)}</span>}
                </div>
              </form>
              <form action={deleteRaidItem}>
                <input type="hidden" name="id" value={item.id} />
                <button type="submit" className={shared.dangerBtn}>
                  Delete
                </button>
              </form>
            </div>
          </details>
        );
      })}
      {items.length === 0 && <div className="sub">Nothing here.</div>}

      <div className={shared.createCard}>
        <span className={shared.sectionLabel}>New item</span>
        <form action={createRaidItem} className={shared.formGrid}>
          <div>
            <span className="label">Type</span>
            <select name="type" defaultValue="ACTION">
              {TYPES.map((t) => (
                <option key={t.key} value={t.key}>
                  {t.key.toLowerCase()}
                </option>
              ))}
            </select>
          </div>
          <div className={shared.full}>
            <span className="label">Description</span>
            <input name="description" required />
          </div>
          <div>
            <span className="label">Due</span>
            <input type="date" name="due" />
          </div>
          <div>
            <span className="label">Severity (risk/issue)</span>
            <select name="severity" defaultValue="">
              <option value="">not set</option>
              <option value="S1">S1</option>
              <option value="S2">S2</option>
              <option value="S3">S3</option>
              <option value="S4">S4</option>
            </select>
          </div>
          <div>
            <span className="label">Probability (risk)</span>
            <select name="probability" defaultValue="">
              <option value="">not set</option>
              <option value="HIGH">high</option>
              <option value="MEDIUM">medium</option>
              <option value="LOW">low</option>
            </select>
          </div>
          <div className={shared.full}>
            <span className="label">Trigger (risk)</span>
            <input name="trigger" />
          </div>
          {linkFields()}
          <div className={`${shared.full} ${shared.actionsRow}`}>
            <button type="submit" className="btn">
              Add
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
