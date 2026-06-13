import { fail, ok, readJson, rateLimit, clientIp } from "@/lib/server/http";
import { getLlmClient } from "@/lib/server/llm";
import { buildRequest, GenAudience, parseStatements } from "@/lib/ai/generate";
import { sanitizeStatements } from "@/lib/ai/safety";

// POST /api/statement-sets/generate
// Host types a theme + audience; we ask Claude (server-side key) to DRAFT
// ~25-30 statements, hard-filter them through the safety validator, and return
// them as an EDITABLE draft. We NEVER persist here — the host reviews/edits in
// the wizard and commits via the existing /api/games custom-set path, so the
// LLM only suggests and the server/host decides.
//
// Keyless: with no ANTHROPIC_API_KEY the client is null → 503 "ai_unavailable".
// The wizard reads /api/statement-sets (aiAvailable flag) and disables the
// option up front, so manual set creation is completely unaffected.

interface GeneratePayload {
  theme?: string;
  audience?: GenAudience;
}

const AUDIENCES: GenAudience[] = ["kirke", "skole", "generell"];

// Over-ask so that after safety-filtering + dedupe we still comfortably clear
// the biggest grid (5x5 = 25 cells); spec §7 sets ship ~25-35 each.
const ASK_COUNT = 30;
const MAX_RETURN = 35;

export async function POST(req: Request) {
  // AI calls cost money + tokens — tighter limit than ordinary writes.
  if (!rateLimit(`aigen:${clientIp(req)}`, 6, 60_000)) {
    return fail(429, "rate_limited");
  }

  const client = getLlmClient();
  if (!client) return fail(503, "ai_unavailable");

  const body = await readJson<GeneratePayload>(req);
  const theme = (body?.theme ?? "").toString().trim().slice(0, 120);
  const audience: GenAudience = AUDIENCES.includes(body?.audience as GenAudience)
    ? (body!.audience as GenAudience)
    : "generell";
  if (theme.length < 2) return fail(400, "missing_theme");

  let raw: string[];
  try {
    const requestBody = buildRequest({ theme, audience, count: ASK_COUNT });
    const response = await client.complete(requestBody);
    raw = parseStatements(response);
  } catch (err) {
    console.error("[aigen]", err);
    return fail(502, "ai_failed");
  }

  // SAFETY GATE: the model only suggests; this pure validator decides.
  const { accepted, rejected } = sanitizeStatements(raw);
  const statements = accepted.slice(0, MAX_RETURN);

  if (statements.length === 0) {
    // Either an empty/garbled model response or everything failed the bar.
    return fail(422, "ai_empty");
  }

  const suggestedTitle = theme
    ? theme.charAt(0).toUpperCase() + theme.slice(1)
    : "AI-forslag";

  return ok({
    title: suggestedTitle,
    audience,
    statements,
    rejectedCount: rejected.length,
  });
}
