import { prisma } from "@/lib/prisma";
import shared from "../../tabs.module.css";
import { Later, Shell } from "../Shell";
import { saveMission } from "../actions";
import { MissionDrafter } from "./MissionDrafter";
import styles from "../onboarding.module.css";

export async function MissionStep() {
  const profile = await prisma.profile.findUnique({ where: { id: 1 } });

  return (
    <Shell
      slug="mission"
      title="Mission"
      lede={
        <>
          <p className={styles.body}>
            Everything else tags back to this. It doesn&apos;t need to be good — it needs to exist,
            so six months from now you can check whether your calendar still agrees with it.
          </p>
          <p className="sub">Answer whichever of these land. Skip the rest.</p>
        </>
      }
    >
      <form action={saveMission} className={styles.form}>
        <input type="hidden" name="step" value="mission" />
        {/* The three seed questions and the draft button are client-side; only
            the mission text is submitted with the form. */}
        <MissionDrafter initial={profile?.mission ?? ""} />

        <Later>Tap the mission bar at the top of any screen, or Settings.</Later>

        <div className={shared.actionsRow}>
          <button type="submit" className="btn">
            Next — roles
          </button>
        </div>
      </form>
    </Shell>
  );
}
