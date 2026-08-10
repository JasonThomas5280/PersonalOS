import { prisma } from "@/lib/prisma";
import shared from "../tabs.module.css";
import { CaptureClient } from "./CaptureClient";

export const dynamic = "force-dynamic";

/**
 * Capture: dump the conversation while it's fresh, review what the system
 * pulled out of it, then file it. Extraction and persistence are deliberately
 * separate — nothing reaches the database until it's approved here.
 */
export default async function CapturePage() {
  const [roles, outcomes] = await Promise.all([
    prisma.role.findMany({ orderBy: { sortOrder: "asc" } }),
    prisma.outcome.findMany({ where: { phase: { not: "CLOSED" } }, orderBy: { createdAt: "asc" } }),
  ]);

  return (
    <div className={shared.stack}>
      <div>
        <div className="kicker">As it happens · 5 minutes · AI-assisted</div>
        <h1 className="h1">Capture</h1>
      </div>

      <CaptureClient
        roles={roles.map((r) => ({ id: r.id, label: r.label, icon: r.icon }))}
        outcomes={outcomes.map((o) => ({ id: o.id, result: o.result }))}
      />
    </div>
  );
}
