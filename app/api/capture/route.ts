import { anthropicClient, COACH_MODEL, missingKeyResponse } from "@/lib/anthropic";
import { isoDate, todayUTC } from "@/lib/dates";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * Capture: dump a conversation/decision/thought within ten minutes, and the
 * system files it — proposed RAID items and people-ledger updates are returned
 * for confirmation, not written directly.
 */
const CAPTURE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["raid", "people", "notes"],
  properties: {
    raid: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["type", "description", "trigger", "severity", "probability", "impact", "due", "alternatives"],
        properties: {
          type: { type: "string", enum: ["RISK", "ACTION", "ISSUE", "DECISION"] },
          description: { type: "string" },
          trigger: { type: "string", description: "Risks only; else empty string" },
          severity: { type: "string", enum: ["S1", "S2", "S3", "S4", ""] },
          probability: { type: "string", enum: ["HIGH", "MEDIUM", "LOW", ""] },
          impact: { type: "string", description: "Impact, or reasoning for decisions" },
          due: { type: "string", description: "YYYY-MM-DD, or empty string" },
          alternatives: { type: "string", description: "Decisions only: what was rejected and why" },
        },
      },
    },
    people: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["name", "isKnown", "situationNote", "contributionGiven", "commitmentOwed", "commitmentDue"],
        properties: {
          name: { type: "string" },
          isKnown: { type: "boolean", description: "True if this name matches a person already in the system" },
          situationNote: { type: "string", description: "New live fact learned, or empty" },
          contributionGiven: { type: "string", description: "Something the user gave them today, or empty" },
          commitmentOwed: { type: "string", description: "Something the user now owes them, or empty" },
          commitmentDue: { type: "string", description: "YYYY-MM-DD, or empty" },
        },
      },
    },
    notes: { type: "string", description: "Anything captured that fits nowhere else" },
  },
} as const;

export async function POST(request: Request) {
  const client = anthropicClient();
  if (!client) return missingKeyResponse();

  const body = await request.json().catch(() => null);
  const text: string = typeof body?.text === "string" ? body.text.trim() : "";
  if (!text) {
    return Response.json({ error: "Provide { text } to capture." }, { status: 400 });
  }

  const people = await prisma.person.findMany({ select: { name: true } });

  const response = await client.beta.messages.create({
    model: COACH_MODEL,
    max_tokens: 16000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    system:
      "You extract structure from a raw capture (a conversation debrief, a decision, a " +
      "worry) for a personal operating system. Decisions record reasoning AND rejected " +
      "alternatives. Risks get a trigger plus severity (S1–S4) and probability. Only " +
      "extract what is actually in the text — no inventions. Known people in the system: " +
      (people.map((p) => p.name).join(", ") || "(none yet)") +
      `. Today is ${isoDate(todayUTC())}.`,
    messages: [{ role: "user", content: text }],
    output_config: {
      format: {
        type: "json_schema",
        schema: CAPTURE_SCHEMA as unknown as Record<string, unknown>,
      },
    },
  });

  if (response.stop_reason === "refusal") {
    return Response.json({ error: "Capture declined for this content." }, { status: 200 });
  }

  const raw = response.content
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("");
  try {
    return Response.json({ proposals: JSON.parse(raw) });
  } catch {
    return Response.json({ error: "Could not parse extraction result." }, { status: 502 });
  }
}
