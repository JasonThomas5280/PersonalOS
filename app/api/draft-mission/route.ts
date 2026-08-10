import { anthropicClient, COACH_MODEL, missingKeyResponse } from "@/lib/anthropic";

export const dynamic = "force-dynamic";

/**
 * Draft a personal mission statement from the three onboarding seed questions.
 *
 * Server-side only (CLAUDE.md) — the prototype called the Anthropic API straight
 * from the browser with no key, which could never have worked. Degrades to 503
 * when the key is unset; the mission field stays writable by hand either way.
 */
export async function POST(request: Request) {
  const client = anthropicClient();
  if (!client) return missingKeyResponse();

  const body = await request.json().catch(() => ({}));
  const s = (v: unknown) => (typeof v === "string" ? v.trim() : "");
  const serves = s(body?.serves);
  const depends = s(body?.depends);
  const regret = s(body?.regret);

  if (!serves && !depends && !regret) {
    return Response.json({ error: "Answer at least one question first." }, { status: 400 });
  }

  const response = await client.beta.messages.create({
    model: COACH_MODEL,
    // Thinking is on by default on this model and max_tokens caps thinking +
    // response together, so a 400-token budget can truncate a 3-sentence
    // answer mid-thought. Low effort keeps the button responsive.
    max_tokens: 2000,
    output_config: { effort: "low" },
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    messages: [
      {
        role: "user",
        content:
          "Write a personal mission statement from these answers. Two to three sentences, " +
          "first person, plain and grounded — not corporate, no \"leverage\" or \"empower\" or " +
          "\"journey.\" It should read like something a thoughtful person would write about " +
          "their own life and be willing to reread in five years.\n\n" +
          `In service of: ${serves || "(not answered)"}\n` +
          `Who depends on me: ${depends || "(not answered)"}\n` +
          `Would regret not building: ${regret || "(not answered)"}\n\n` +
          "Return ONLY the statement. No preamble, no quotes, no commentary.",
      },
    ],
  });

  if (response.stop_reason === "refusal") {
    return Response.json({ error: "Couldn't draft that one — write it yourself below." });
  }

  const mission = response.content
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("")
    .trim();
  return Response.json({ mission });
}
