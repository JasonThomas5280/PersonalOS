/**
 * Which columns each RAID type actually owns.
 *
 * RAID is one table with a `type` column, so every row physically has columns
 * for all four types. The edit form only renders the fields matching the row's
 * type — so a "write every field from the form" update blanks whatever the
 * other types own. Saving an ACTION wiped a risk's severity/probability/trigger;
 * saving a RISK wiped an issue's classification and a decision's alternatives.
 *
 * Narrowing the write to the owning type fixes that, and stops the create form
 * from stamping risk fields onto an ACTION on the way in.
 */
import type { IssueClassification, Probability, RaidType, Severity } from "@prisma/client";
import { toUTCDate } from "./dates";

/** The type-specific slice of a RAID row. Common fields (description, impact,
 *  status, owner, due, links, resolution) belong to every type and are written
 *  separately. */
export type RaidTypeFields = {
  trigger: string;
  severity: Severity | null;
  probability: Probability | null;
  classification: IssueClassification | null;
  escalation: string;
  alternatives: string;
  decidedBy: string;
  decidedOn: Date | null;
};

/** Every type-specific column at its empty value. */
const EMPTY: RaidTypeFields = {
  trigger: "",
  severity: null,
  probability: null,
  classification: null,
  escalation: "",
  alternatives: "",
  decidedBy: "",
  decidedOn: null,
};

function str(fd: FormData, key: string): string {
  const v = fd.get(key);
  return typeof v === "string" ? v.trim() : "";
}

function enumOrNull<T extends string>(fd: FormData, key: string): T | null {
  const v = str(fd, key);
  return v === "" ? null : (v as T);
}

function dateOrNull(fd: FormData, key: string): Date | null {
  const v = str(fd, key);
  return v === "" ? null : toUTCDate(v);
}

/**
 * Read only the type-specific fields `type` owns, leaving the rest empty.
 *
 * Risks carry a trigger plus severity × probability (exposure). Issues carry
 * severity plus a classification and an escalation path. Decisions carry the
 * rejected alternatives and who decided when — their reasoning lives in the
 * shared `impact` column. Actions have no type-specific fields at all.
 */
export function raidFieldsForType(type: RaidType, fd: FormData): RaidTypeFields {
  switch (type) {
    case "RISK":
      return {
        ...EMPTY,
        trigger: str(fd, "trigger"),
        severity: enumOrNull<Severity>(fd, "severity"),
        probability: enumOrNull<Probability>(fd, "probability"),
      };
    case "ISSUE":
      return {
        ...EMPTY,
        severity: enumOrNull<Severity>(fd, "severity"),
        classification: enumOrNull<IssueClassification>(fd, "classification"),
        escalation: str(fd, "escalation"),
      };
    case "DECISION":
      return {
        ...EMPTY,
        alternatives: str(fd, "alternatives"),
        decidedBy: str(fd, "decidedBy"),
        decidedOn: dateOrNull(fd, "decidedOn"),
      };
    case "ACTION":
      return { ...EMPTY };
  }
}
