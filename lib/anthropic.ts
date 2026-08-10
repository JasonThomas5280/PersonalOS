import Anthropic from "@anthropic-ai/sdk";

/**
 * Server-side Anthropic client (CLAUDE.md: the API key never ships to the
 * browser — Coach and Capture are route handlers only).
 */
export function anthropicClient(): Anthropic | null {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  return new Anthropic();
}

export const COACH_MODEL = "claude-opus-5";

export function missingKeyResponse(): Response {
  return Response.json(
    {
      error:
        "ANTHROPIC_API_KEY is not configured. Add it to .env (server-side only) to enable this feature.",
    },
    { status: 503 }
  );
}
