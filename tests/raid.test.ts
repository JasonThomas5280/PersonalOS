import { describe, expect, it } from "vitest";
import { raidFieldsForType } from "../lib/raid";
import { toUTCDate } from "../lib/dates";

/**
 * A form carrying values for EVERY type's fields at once — which is what the
 * create form actually submitted before the fix, and what a stale edit form
 * could submit. Each type must take only its own and leave the rest empty.
 */
function fullForm(): FormData {
  const fd = new FormData();
  fd.set("trigger", "Vendor misses the integration date");
  fd.set("severity", "S2");
  fd.set("probability", "HIGH");
  fd.set("classification", "STRUCTURAL_GAP");
  fd.set("escalation", "Raise with the steering group");
  fd.set("alternatives", "Considered buying instead of building");
  fd.set("decidedBy", "Me");
  fd.set("decidedOn", "2026-08-10");
  return fd;
}

describe("raidFieldsForType", () => {
  it("keeps trigger + severity × probability for a RISK, drops the rest", () => {
    expect(raidFieldsForType("RISK", fullForm())).toEqual({
      trigger: "Vendor misses the integration date",
      severity: "S2",
      probability: "HIGH",
      classification: null,
      escalation: "",
      alternatives: "",
      decidedBy: "",
      decidedOn: null,
    });
  });

  it("keeps severity + classification + escalation for an ISSUE, drops the rest", () => {
    expect(raidFieldsForType("ISSUE", fullForm())).toEqual({
      trigger: "",
      severity: "S2",
      probability: null,
      classification: "STRUCTURAL_GAP",
      escalation: "Raise with the steering group",
      alternatives: "",
      decidedBy: "",
      decidedOn: null,
    });
  });

  it("keeps alternatives + decidedBy/On for a DECISION, drops the rest", () => {
    expect(raidFieldsForType("DECISION", fullForm())).toEqual({
      trigger: "",
      severity: null,
      probability: null,
      classification: null,
      escalation: "",
      alternatives: "Considered buying instead of building",
      decidedBy: "Me",
      decidedOn: toUTCDate("2026-08-10"),
    });
  });

  it("keeps nothing type-specific for an ACTION", () => {
    expect(raidFieldsForType("ACTION", fullForm())).toEqual({
      trigger: "",
      severity: null,
      probability: null,
      classification: null,
      escalation: "",
      alternatives: "",
      decidedBy: "",
      decidedOn: null,
    });
  });

  /**
   * The regression this exists to prevent: an ACTION saved through a form that
   * still carried a risk's severity must not write that severity back.
   */
  it("does not let one type's values leak into another", () => {
    const risk = raidFieldsForType("RISK", fullForm());
    const action = raidFieldsForType("ACTION", fullForm());
    expect(risk.severity).toBe("S2");
    expect(action.severity).toBeNull();
    expect(action.trigger).toBe("");
    expect(action.probability).toBeNull();
  });

  it("treats missing and blank fields as empty, not as the string 'null'", () => {
    const fd = new FormData();
    fd.set("trigger", "   ");
    fd.set("severity", "");
    const risk = raidFieldsForType("RISK", fd);
    expect(risk.trigger).toBe("");
    expect(risk.severity).toBeNull();
    expect(risk.probability).toBeNull();
  });
});
