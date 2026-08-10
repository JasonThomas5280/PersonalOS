import styles from "./page.module.css";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function Home() {
  const [profile, roles, outcomes, people, raidOpen] = await Promise.all([
    prisma.profile.findUnique({ where: { id: 1 } }),
    prisma.role.findMany({ orderBy: { sortOrder: "asc" } }),
    prisma.outcome.count({ where: { phase: { not: "CLOSED" } } }),
    prisma.person.count(),
    prisma.raidItem.count({ where: { status: { not: "CLOSED" } } }),
  ]);

  return (
    <div className={styles.page}>
      <main className={styles.main}>
        <div className={styles.kicker}>Personal Operating System</div>
        {profile?.mission ? (
          <p className={styles.mission}>“{profile.mission}”</p>
        ) : (
          <p className={styles.missionEmpty}>No mission set yet.</p>
        )}
        <div className={styles.roles}>
          {roles.map((r) => (
            <span key={r.id} className={styles.role} data-health={r.health ?? "none"}>
              {r.icon} {r.label}
            </span>
          ))}
        </div>
        <div className={styles.stats}>
          <span>{outcomes} active outcomes</span>
          <span>{raidOpen} open RAID items</span>
          <span>{people} people</span>
        </div>
      </main>
    </div>
  );
}
