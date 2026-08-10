import { anthropicClient, COACH_MODEL, missingKeyResponse } from "@/lib/anthropic";
import { computeAlerts } from "@/lib/alerts";
import { daysSince, daysUntil, isoDate, todayUTC } from "@/lib/dates";
import { prisma } from "@/lib/prisma";
import { loadAlertsSnapshot } from "@/lib/snapshot";

export const dynamic = "force-dynamic";

/** Build a compact, factual snapshot for the coach to reason over. */
async function snapshotText(): Promise<string> {
  const now = todayUTC();
  const [snapshot, profile, roles, outcomes, bigThree] = await Promise.all([
    loadAlertsSnapshot(now),
    prisma.profile.findUnique({ where: { id: 1 } }),
    prisma.role.findMany({ orderBy: { sortOrder: "asc" } }),
    prisma.outcome.findMany({
      where: { phase: { not: "CLOSED" } },
      include: { primaryRole: true },
    }),
    prisma.bigThreeItem.findMany({ where: { date: now }, orderBy: { slot: "asc" } }),
  ]);
  const alerts = computeAlerts(snapshot);

  const lines: string[] = [`Date: ${isoDate(now)}`];
  if (profile) {
    lines.push(`Mission: ${profile.mission || "(none written)"}`);
    lines.push(`Capacity budget: ${Number(profile.capacityBudget)}h/week for outcome work`);
  }
  lines.push(
    "Roles: " +
      roles
        .map(
          (r) =>
            `${r.label} [${r.health ?? "no health"}${
              r.lastReviewed ? `, reviewed ${daysSince(r.lastReviewed, now)}d ago` : ", never reviewed"
            }]`
        )
        .join("; ")
  );
  lines.push("Active outcomes:");
  for (const o of outcomes) {
    lines.push(
      `- "${o.result}" (${o.phase.toLowerCase()}, role: ${o.primaryRole?.label ?? "none"}` +
        (o.targetDate ? `, target in ${daysUntil(o.targetDate, now)}d` : ", no target") +
        (o.weeklyHours !== null ? `, ${Number(o.weeklyHours)}h/wk` : "") +
        (o.criticalPath ? ", CRITICAL PATH" : "") +
        `)`
    );
  }
  lines.push(
    "Today's Big 3: " +
      (bigThree.filter((b) => b.text).length === 0
        ? "not set"
        : bigThree
            .filter((b) => b.text)
            .map((b) => `"${b.text}" [${b.quadrant ?? "no quadrant"}${b.done ? ", done" : ""}]`)
            .join("; "))
  );
  lines.push(
    alerts.length === 0
      ? "Alerts: none"
      : "Alerts:\n" + alerts.map((a) => `- [${a.severity}] ${a.message}`).join("\n")
  );
  return lines.join("\n");
}

export async function POST(request: Request) {
  const client = anthropicClient();
  if (!client) return missingKeyResponse();

  const body = await request.json().catch(() => ({}));
  const question: string = typeof body?.question === "string" ? body.question : "";

  const snapshot = await snapshotText();
  const response = await client.beta.messages.create({
    model: COACH_MODEL,
    max_tokens: 16000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    system:
      "You are the coach inside a personal operating system that applies implementation-PM " +
      "discipline (phases, RAID, capacity, critical path) to personal life, blended with " +
      "Covey's 7 Habits and RPM. You are direct, warm, and honest — never corporate. " +
      "You read the system snapshot and give a short readout: (1) where things actually " +
      "stand, (2) the two or three items that most need attention and why, (3) one concrete " +
      "Q2 move for tomorrow. Keep it under 250 words. Plain prose, no headers.",
    messages: [
      {
        role: "user",
        content: question
          ? `${snapshot}\n\nQuestion from the user: ${question}`
          : snapshot,
      },
    ],
  });

  if (response.stop_reason === "refusal") {
    return Response.json(
      { error: "The coach declined to answer this request." },
      { status: 200 }
    );
  }

  const readout = response.content
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("");
  return Response.json({ readout });
}
