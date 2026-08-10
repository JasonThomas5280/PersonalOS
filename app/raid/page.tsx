import Link from "next/link";
import { createRaidItem, deleteRaidItem, updateRaidItem } from "@/app/actions";
import { ConfirmButton } from "@/components/ConfirmButton";
import { SubmitButton } from "@/components/SubmitButton";
import { PROBABILITY_N, SEVERITY_N } from "@/lib/alerts";
import { daysUntil, isoDate, todayUTC } from "@/lib/dates";
import { prisma } from "@/lib/prisma";
import type { RaidType } from "@prisma/client";
import shared from "../tabs.module.css";
import { RaidStatusSelect } from "./RaidStatusSelect";

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

/** Status chip colour — every status but BLOCKED used to render identical grey. */
function statusChip(status: string): string {
  if (status === "BLOCKED") return shared.chipRed;
  if (status === "IN_PROGRESS") return shared.chipYellow;
  if (status === "CLOSED") return shared.chipGreen;
  return shared.chip;
}

export default async function RaidPage({ searchParams }: PageProps<"/raid">) {
  const params = await searchParams;
  const typeFilter = TYPES.find((t) => t.key === params.type)?.key;
  const showClosed = params.closed === "1";
  // Set by an alert link, so the record it names is already open on arrival.
  const openId = typeof params.open === "string" ? params.open : undefined;
  const now = todayUTC();

  const [rows, roles, outcomes, people] = await Promise.all([
    prisma.raidItem.findMany({
      where: {
        ...(typeFilter ? { type: typeFilter } : {}),
        ...(showClosed ? {} : { status: { not: "CLOSED" } }),
      },
      include: { role: true, outcome: true, person: true },
    }),
    prisma.role.findMany({ orderBy: { sortOrder: "asc" } }),
    prisma.outcome.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.person.findMany({ orderBy: { name: "asc" } }),
  ]);

  /* Prisma ordered by `status: "asc"`, which is alphabetical enum order —
     BLOCKED, CLOSED, DEFERRED, IN_PROGRESS, OPEN — so an exposure-12 risk sat
     below a deferred item. Exposure is computed, so sort here instead:
     live work first, then by exposure, then by how overdue it is. */
  const items = [...rows].sort((a, b) => {
    const parked = (s: string) => (s === "CLOSED" ? 2 : s === "DEFERRED" ? 1 : 0);
    if (parked(a.status) !== parked(b.status)) return parked(a.status) - parked(b.status);

    const ex = (i: (typeof rows)[number]) =>
      i.type === "RISK" ? (exposure(i.severity, i.probability) ?? -1) : -1;
    if (ex(a) !== ex(b)) return ex(b) - ex(a);

    // Overdue first, then soonest due; undated items sink below dated ones.
    const due = (i: (typeof rows)[number]) => (i.due ? daysUntil(i.due, now) : Infinity);
    if (due(a) !== due(b)) return due(a) - due(b);

    return b.createdAt.getTime() - a.createdAt.getTime();
  });

  const linkFields = (item?: (typeof items)[number]) => (
    <>
      <div>
        <label className="label">Role
        <select name="roleId" defaultValue={item?.roleId ?? ""}>
          <option value="">none</option>
          {roles.map((r) => (
            <option key={r.id} value={r.id}>
              {r.icon} {r.label}
            </option>
          ))}
        </select></label>
      </div>
      <div>
        <label className="label">Outcome
        <select name="outcomeId" defaultValue={item?.outcomeId ?? ""}>
          <option value="">none</option>
          {outcomes.map((o) => (
            <option key={o.id} value={o.id}>
              {o.result}
            </option>
          ))}
        </select></label>
      </div>
      <div>
        <label className="label">Person
        <select name="personId" defaultValue={item?.personId ?? ""}>
          <option value="">none</option>
          {people.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select></label>
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
        <Link href="/raid" className={!typeFilter ? shared.chipGold : shared.chipLink}>
          All
        </Link>
        {TYPES.map((t) => (
          <Link
            key={t.key}
            href={`/raid?type=${t.key}${showClosed ? "&closed=1" : ""}`}
            className={typeFilter === t.key ? shared.chipGold : shared.chipLink}
          >
            {t.label}
          </Link>
        ))}
        <Link
          href={`/raid?${typeFilter ? `type=${typeFilter}&` : ""}closed=${showClosed ? "0" : "1"}`}
          className={showClosed ? shared.chipGold : shared.chipLink}
        >
          {showClosed ? "Hiding nothing" : "Show closed"}
        </Link>
      </div>

      {items.map((item) => {
        const exp = item.type === "RISK" ? exposure(item.severity, item.probability) : null;
        const untilDue = item.due ? daysUntil(item.due, now) : null;
        const overdueBy =
          untilDue !== null && untilDue < 0 && item.status !== "CLOSED" ? -untilDue : null;
        return (
          <details
            key={item.id}
            id={item.id}
            className={`card ${shared.item}`}
            open={item.id === openId}
          >
            <summary>
              <span className={shared.chip}>{item.type.toLowerCase()}</span>
              <span className={shared.title}>{item.description}</span>
              <span className={shared.meta}>
                <span className={statusChip(item.status)}>
                  {item.status.toLowerCase().replace("_", " ")}
                </span>
                {exp !== null && (
                  <span className={exp >= 9 ? shared.chipRed : shared.chip}>exposure {exp}</span>
                )}
                {/* Was a raw ISO date in grey — the user did the arithmetic. */}
                {item.due &&
                  (overdueBy !== null ? (
                    <span className={shared.chipRed}>{overdueBy}d overdue</span>
                  ) : (
                    <span>due {isoDate(item.due)}</span>
                  ))}
                {/* The glyph alone was the only signal of which role owned this. */}
                {item.role && (
                  <span>
                    <span aria-hidden="true">{item.role.icon}</span> {item.role.label}
                  </span>
                )}
                {item.person && <span>{item.person.name}</span>}
              </span>
            </summary>
            <div className={shared.body}>
              <form action={updateRaidItem} className={shared.formGrid}>
                <input type="hidden" name="id" value={item.id} />
                <div className={shared.full}>
                  <label className="label" htmlFor={`${item.id}-description`}>
                    Description
                  </label>
                  <input
                    id={`${item.id}-description`}
                    name="description"
                    defaultValue={item.description}
                    required
                  />
                </div>
                <div>
                  <label className="label" htmlFor={`${item.id}-status`}>
                    Status
                  </label>
                  <RaidStatusSelect
                    id={`${item.id}-status`}
                    defaultValue={item.status}
                    statuses={STATUSES}
                  />
                </div>
                <div>
                  <label className="label" htmlFor={`${item.id}-owner`}>
                    Owner
                  </label>
                  <input id={`${item.id}-owner`} name="owner" defaultValue={item.owner} />
                </div>
                <div>
                  <label className="label" htmlFor={`${item.id}-due`}>
                    Due
                  </label>
                  <input
                    id={`${item.id}-due`}
                    type="date"
                    name="due"
                    defaultValue={item.due ? isoDate(item.due) : ""}
                  />
                </div>
                {item.type === "RISK" && (
                  <>
                    <div className={shared.full}>
                      <label className="label">Trigger — what turns this risk into an issue
                      <input name="trigger" defaultValue={item.trigger} /></label>
                    </div>
                    <div>
                      <label className="label">Severity
                      <select name="severity" defaultValue={item.severity ?? ""}>
                        <option value="">not set</option>
                        <option value="S1">S1 — blocking</option>
                        <option value="S2">S2 — major, no workaround</option>
                        <option value="S3">S3 — major, workaround exists</option>
                        <option value="S4">S4 — minor</option>
                      </select></label>
                    </div>
                    <div>
                      <label className="label">Probability
                      <select name="probability" defaultValue={item.probability ?? ""}>
                        <option value="">not set</option>
                        <option value="HIGH">high</option>
                        <option value="MEDIUM">medium</option>
                        <option value="LOW">low</option>
                      </select></label>
                    </div>
                  </>
                )}
                {item.type === "ISSUE" && (
                  <>
                    <div>
                      <label className="label">Severity
                      <select name="severity" defaultValue={item.severity ?? ""}>
                        <option value="">not set</option>
                        <option value="S1">S1</option>
                        <option value="S2">S2</option>
                        <option value="S3">S3</option>
                        <option value="S4">S4</option>
                      </select></label>
                    </div>
                    <div>
                      <label className="label">Classification
                      <select name="classification" defaultValue={item.classification ?? ""}>
                        <option value="">not set</option>
                        {CLASSIFICATIONS.map((c) => (
                          <option key={c} value={c}>
                            {c.toLowerCase().replace(/_/g, " ")}
                          </option>
                        ))}
                      </select></label>
                    </div>
                    <div className={shared.full}>
                      <label className="label">Escalation path
                      <input name="escalation" defaultValue={item.escalation} /></label>
                    </div>
                  </>
                )}
                {item.type === "DECISION" && (
                  <>
                    <div className={shared.full}>
                      <label className="label">Reasoning
                      <textarea name="impact" defaultValue={item.impact} rows={2} /></label>
                    </div>
                    <div className={shared.full}>
                      <label className="label">Rejected alternatives — and why they lost
                      <textarea name="alternatives" defaultValue={item.alternatives} rows={2} /></label>
                    </div>
                    <div>
                      <label className="label">Decided by
                      <input name="decidedBy" defaultValue={item.decidedBy} /></label>
                    </div>
                    <div>
                      <label className="label">Decided on
                      <input type="date" name="decidedOn" defaultValue={item.decidedOn ? isoDate(item.decidedOn) : ""} /></label>
                    </div>
                  </>
                )}
                {item.type !== "DECISION" && (
                  <div className={shared.full}>
                    <label className="label">Impact
                    <textarea name="impact" defaultValue={item.impact} rows={2} /></label>
                  </div>
                )}
                {linkFields(item)}
                <div className={shared.full}>
                  <label className="label">Resolution — required to close
                  <textarea name="resolution" defaultValue={item.resolution} rows={2} /></label>
                </div>
                <div className={`${shared.full} ${shared.actionsRow}`}>
                  <SubmitButton>Save</SubmitButton>
                  {item.closedOn && <span className="sub">closed {isoDate(item.closedOn)}</span>}
                </div>
              </form>
              <form action={deleteRaidItem}>
                <input type="hidden" name="id" value={item.id} />
                <ConfirmButton
                  className={shared.dangerBtn}
                  label={`Delete this ${item.type.toLowerCase()}: ${item.description}`}
                >
                  Delete
                </ConfirmButton>
              </form>
            </div>
          </details>
        );
      })}
      {items.length === 0 && (
        <div className="card" style={{ padding: 18 }}>
          <p className="sub">
            {typeFilter || !showClosed ? (
              <>
                Nothing matches this filter.{" "}
                <Link href="/raid?closed=1" style={{ textDecoration: "underline" }}>
                  Show everything, including closed
                </Link>
                .
              </>
            ) : (
              <>
                The log is empty. Don&apos;t sit down and brainstorm risks — this fills itself as
                things come up, or through Capture. Add what&apos;s already on your mind.
              </>
            )}
          </p>
        </div>
      )}

      <div className={shared.createCard}>
        <h2 className={shared.sectionLabel}>New item</h2>
        <form action={createRaidItem} className={shared.formGrid}>
          <div>
            <label className="label">Type
            <select name="type" defaultValue="ACTION">
              {TYPES.map((t) => (
                <option key={t.key} value={t.key}>
                  {t.key.toLowerCase()}
                </option>
              ))}
            </select></label>
          </div>
          <div className={shared.full}>
            <label className="label">Description
            <input name="description" required /></label>
          </div>
          <div>
            <label className="label">Due
            <input type="date" name="due" /></label>
          </div>
          <div>
            <label className="label">Severity (risk/issue)
            <select name="severity" defaultValue="">
              <option value="">not set</option>
              <option value="S1">S1</option>
              <option value="S2">S2</option>
              <option value="S3">S3</option>
              <option value="S4">S4</option>
            </select></label>
          </div>
          <div>
            <label className="label">Probability (risk)
            <select name="probability" defaultValue="">
              <option value="">not set</option>
              <option value="HIGH">high</option>
              <option value="MEDIUM">medium</option>
              <option value="LOW">low</option>
            </select></label>
          </div>
          <div className={shared.full}>
            <label className="label">Trigger (risk)
            <input name="trigger" /></label>
          </div>
          {linkFields()}
          <div className={`${shared.full} ${shared.actionsRow}`}>
            <SubmitButton>Add</SubmitButton>
          </div>
        </form>
      </div>
    </div>
  );
}
