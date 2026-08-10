import { prisma } from "@/lib/prisma";
import shared from "../../tabs.module.css";
import { Later, Shell } from "../Shell";
import { saveCapacity } from "../actions";
import { CapacityWorksheet } from "./CapacityWorksheet";
import styles from "../onboarding.module.css";

export async function CapacityStep() {
  const profile = await prisma.profile.findUnique({ where: { id: 1 } });
  const num = (v: { toString(): string } | null | undefined) =>
    v === null || v === undefined ? null : Number(v);

  return (
    <Shell
      slug="capacity"
      title="Capacity"
      lede={
        <>
          <p className={styles.body}>
            Everyone has 168 hours a week. This is the step people skip, and the one that decides
            whether the system is useful or decorative.
          </p>
          <p className="sub">Estimate honestly. Round up on the obligations, not down.</p>
        </>
      }
    >
      <form action={saveCapacity} className={styles.form}>
        <input type="hidden" name="step" value="capacity" />
        <CapacityWorksheet
          initial={{
            sleep: num(profile?.sleepHours),
            work: num(profile?.workHours),
            commute: num(profile?.commuteHours),
            family: num(profile?.familyHours),
            household: num(profile?.householdHours),
            existing: num(profile?.existingHours),
          }}
          initialBudget={num(profile?.capacityBudget) ?? 0}
        />

        <Later>
          <strong>Settings → Capacity Budget</strong>. Revisit whenever the season changes — a new
          job, a new baby, a hard quarter. The breakdown above is kept, so you start from your last
          honest numbers rather than from memory.
        </Later>

        <div className={shared.actionsRow}>
          <button type="submit" className="btn">
            Next — outcomes
          </button>
        </div>
      </form>
    </Shell>
  );
}
