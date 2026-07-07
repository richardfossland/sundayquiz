import "server-only";

// Anthropic Messages API seam — SERVER ONLY. The API key lives in the Worker
// secret store (ANTHROPIC_API_KEY) exactly like SUPABASE_SERVICE_ROLE_KEY; it
// is never inlined into a client bundle. `getLlmClient()` returns null when no
// key is configured, which is how the whole AI feature degrades gracefully:
// the route reports "ai_unavailable" and the wizard disables the option.
//
// MODEL: matches the suite's current Opus (claude-opus-4-8). The request and
// response shaping live in the PURE helpers in lib/ai/* so they can be
// unit-tested with canned fixtures and no network.

export const ANTHROPIC_MODEL = "claude-opus-4-8";

const ANTHROPIC_VERSION = "2023-06-01";
const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";

export interface LlmClient {
  /** Send one Messages API request; returns the raw parsed JSON body. Throws
   * on transport / non-2xx so the route maps it to a 502. */
  complete(body: unknown): Promise<unknown>;
}

/** Returns a live client, or null when ANTHROPIC_API_KEY is unset. Callers MUST
 * treat null as "AI not available" and fall back — never crash. */
export function getLlmClient(): LlmClient | null {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return null;
  return {
    async complete(body: unknown): Promise<unknown> {
      // Bound the whole call — including the body read — with one AbortController
      // (the suite-wide timedFetch gotcha). Without it, an Anthropic response
      // that stalls after headers arrive would hang res.json() indefinitely and
      // tie up the Worker invocation. Note the `await` on res.json(): the timer
      // must still be armed while the body streams, so it is cleared in finally
      // only after the read completes.
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30_000);
      try {
        const res = await fetch(ANTHROPIC_URL, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-api-key": key,
            "anthropic-version": ANTHROPIC_VERSION,
          },
          body: JSON.stringify(body),
          signal: controller.signal,
        });
        if (!res.ok) {
          const detail = await res.text().catch(() => "");
          throw new Error(`anthropic_http_${res.status}: ${detail.slice(0, 200)}`);
        }
        return await res.json();
      } finally {
        clearTimeout(timeout);
      }
    },
  };
}
