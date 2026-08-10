import { SubmitButton } from "@/components/SubmitButton";
import { updateProfile } from "@/app/actions";
import { prisma } from "@/lib/prisma";
import shared from "../tabs.module.css";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const [profile, outcomes] = await Promise.all([
    prisma.profile.findUnique({ where: { id: 1 } }),
    prisma.outcome.findMany({ where: { phase: { not: "CLOSED" } } }),
  ]);
  const committed = outcomes.reduce((s, o) => s + (o.weeklyHours ? Number(o.weeklyHours) : 0), 0);

  return (
    <div className={shared.stack}>
      <div>
        <h1 className="h1">Settings</h1>
      </div>

      <div className={shared.createCard}>
        <h2 className={shared.sectionLabel}>Mission & capacity</h2>
        <form action={updateProfile} className={shared.formGrid}>
          <div className={shared.full}>
            <label className="label">Mission — reread it in five years without flinching
            <textarea name="mission" defaultValue={profile?.mission ?? ""} rows={3} /></label>
          </div>
          <div>
            <label className="label">Capacity budget — hours/week for outcome work
            <input
              type="number"
              step="0.5"
              name="capacityBudget"
              defaultValue={profile ? Number(profile.capacityBudget) : 12}
            /></label>
            <div className="sub" style={{ marginTop: 6 }}>
              Currently committed: {committed}h across {outcomes.length} active outcomes.
            </div>
          </div>
          <div className={`${shared.full} ${shared.actionsRow}`}>
            <SubmitButton>Save</SubmitButton>
          </div>
        </form>
      </div>

      <div className={shared.createCard}>
        <h2 className={shared.sectionLabel}>Export</h2>
        <p className="sub">
          Everything as raw JSON, in the same shape the seed script loads — an export can be
          dropped into <code>seed/initial-state.json</code> and re-seeded. Keep a copy somewhere
          that outlives any single tool.
        </p>
        <div className={shared.actionsRow}>
          <a href="/api/export" className="btn" style={{ display: "inline-block" }}>
            Download export JSON
          </a>
        </div>
      </div>

      <div className={shared.createCard}>
        <h2 className={shared.sectionLabel}>Roles</h2>
        <p className="sub">Add, edit, and remove roles in the Roles tab — including health, missions, and review cadence.</p>
      </div>
    </div>
  );
}
