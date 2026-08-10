"use server";

/**
 * Commit the proposals the user approved from a capture.
 *
 * /api/capture only extracts — nothing is written until it comes through here,
 * so a bad extraction costs a glance rather than a cleanup. Writes go through
 * the same server actions the tabs use, so there is one write path per entity.
 */
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { addCommitment, addContribution, createPerson, createRaidItem } from "@/app/actions";

export type RaidProposal = {
  type: "RISK" | "ACTION" | "ISSUE" | "DECISION";
  description: string;
  trigger: string;
  severity: string;
  probability: string;
  impact: string;
  due: string;
  alternatives: string;
  /** Optional links the user picks in the review step. */
  roleId?: string;
  outcomeId?: string;
};

export type PersonProposal = {
  name: string;
  situationNote: string;
  contributionGiven: string;
  /** Ledger category for the contribution — the extraction doesn't infer one. */
  contributionCategory?: string;
  commitmentOwed: string;
  commitmentDue: string;
};

export type CommitResult = {
  raid: number;
  people: number;
  contributions: number;
  commitments: number;
  situations: number;
  errors: string[];
};

function fd(o: Record<string, string>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(o)) f.set(k, v);
  return f;
}

export async function commitProposals(
  raid: RaidProposal[],
  people: PersonProposal[],
): Promise<CommitResult> {
  const result: CommitResult = {
    raid: 0,
    people: 0,
    contributions: 0,
    commitments: 0,
    situations: 0,
    errors: [],
  };

  for (const r of raid) {
    if (!r.description?.trim()) continue;
    try {
      // createRaidItem narrows to the fields this type owns (lib/raid.ts), so
      // passing the full extraction is safe — cross-type values are dropped.
      await createRaidItem(
        fd({
          type: r.type,
          description: r.description,
          impact: r.impact ?? "",
          trigger: r.trigger ?? "",
          severity: r.severity ?? "",
          probability: r.probability ?? "",
          alternatives: r.alternatives ?? "",
          due: r.due ?? "",
          roleId: r.roleId ?? "",
          outcomeId: r.outcomeId ?? "",
        }),
      );
      result.raid++;
    } catch (e) {
      result.errors.push(`RAID "${r.description.slice(0, 40)}": ${(e as Error).message}`);
    }
  }

  for (const p of people) {
    const name = p.name?.trim();
    if (!name) continue;
    try {
      // Match an existing person by name before creating a duplicate. The
      // extraction flags known names, but the user can edit the name in review,
      // so re-check here rather than trusting the flag.
      let person = await prisma.person.findFirst({
        where: { name: { equals: name, mode: "insensitive" } },
      });
      if (!person) {
        await createPerson(fd({ name, ring: "WORKING", stage: "ASSESS" }));
        person = await prisma.person.findFirst({
          where: { name: { equals: name, mode: "insensitive" } },
        });
        if (person) result.people++;
      }
      if (!person) {
        result.errors.push(`Could not create or find person "${name}".`);
        continue;
      }

      // Append rather than overwrite — a prior situation note is history, not
      // a stale value to clobber.
      if (p.situationNote?.trim()) {
        const existing = person.situation?.trim();
        await prisma.person.update({
          where: { id: person.id },
          data: {
            situation: existing ? `${existing}\n${p.situationNote.trim()}` : p.situationNote.trim(),
          },
        });
        result.situations++;
      }

      if (p.contributionGiven?.trim()) {
        await addContribution(
          fd({
            personId: person.id,
            category: p.contributionCategory || "INFORMATIONAL",
            text: p.contributionGiven,
          }),
        );
        result.contributions++;
      }

      if (p.commitmentOwed?.trim()) {
        await addCommitment(
          fd({
            personId: person.id,
            text: p.commitmentOwed,
            due: p.commitmentDue ?? "",
          }),
        );
        result.commitments++;
      }
    } catch (e) {
      result.errors.push(`Person "${name}": ${(e as Error).message}`);
    }
  }

  revalidatePath("/", "layout");
  return result;
}
