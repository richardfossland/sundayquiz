// PURE request-builder + response-parser for the AI statement-set generator.
// No network, no key, no I/O — so the gate's unit tests drive these with canned
// Anthropic fixtures. The route (app/api/statement-sets/generate) wires these
// to lib/server/llm.ts and lib/ai/safety.ts.

import { ANTHROPIC_MODEL } from "@/lib/server/llm";

export type GenAudience = "kirke" | "skole" | "generell";

export interface GenerateParams {
  theme: string;
  audience: GenAudience;
  /** How many statements to ask for (the model usually returns this many; the
   * route over-asks so post-validation still clears the grid minimum). */
  count: number;
}

const AUDIENCE_LABEL: Record<GenAudience, string> = {
  kirke: "kirke / ungdomsgruppe / menighet",
  skole: "skoleklasse / ungdomsskole",
  generell: "generell samling (blandet publikum)",
};

// The safety bar lives in the system prompt AND in the pure validator
// (lib/ai/safety.ts). Belt and braces: the prompt steers the model away from
// sensitive content, the validator is the hard gate. Norwegian-first, warm,
// church/community-appropriate (spec §7: "varm, inkluderende, null flaut").
export const SYSTEM_PROMPT = [
  "Du lager utsagn til «bli-kjent-bingo» for klasserom og kirkekvelder i Norge.",
  "Hvert utsagn beskriver noe en person KAN ha gjort eller likt, slik at man kan",
  "finne noen i rommet det stemmer for og bli litt kjent. Skriv på bokmål.",
  "",
  "ABSOLUTTE REGLER (utsagn som bryter dem skal ALDRI lages):",
  "- ALDRI om kropp, vekt, utseende, helse eller spisevaner.",
  "- ALDRI om familiesituasjon (skilsmisse, dødsfall, fosterhjem, adopsjon, å være alene).",
  "- ALDRI om økonomi, penger, lønn, gjeld eller hvor rik/fattig noen er.",
  "- ALDRI bruk tro som «gotcha» (f.eks. «er frelst», «tror på Gud», «ber hver dag»).",
  "  Varme aktiviteter er greit: «har vært på leir», «synger i koret», «lager god kaffe».",
  "",
  "FORM:",
  "- Hvert utsagn er én kort linje, varmt og ufarlig, uten spørsmålstegn.",
  "- Begynn gjerne med «Har …», «Kan …», «Liker …», «Spiller …».",
  "- Ingen nummerering, ingen forklaring, ingen sensitive temaer.",
  "",
  "Svar KUN med gyldig JSON på formen {\"statements\": [\"...\", \"...\"]}.",
].join("\n");

/** Build the Anthropic Messages API request body. Pure. */
export function buildRequest(params: GenerateParams): Record<string, unknown> {
  const { theme, audience, count } = params;
  const userPrompt = [
    `Tema: ${theme.trim() || "bli kjent"}`,
    `Samling: ${AUDIENCE_LABEL[audience]}`,
    `Lag ${count} ulike utsagn som passer temaet og samlingen.`,
    'Svar kun med JSON: {"statements": [ ... ]}.',
  ].join("\n");

  return {
    model: ANTHROPIC_MODEL,
    max_tokens: 2048,
    // Adaptive thinking is the recommended setting on Opus 4.8; keep it modest
    // for this short, well-scoped generation.
    thinking: { type: "adaptive" },
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: userPrompt }],
  };
}

/** Extract the concatenated text from an Anthropic Messages response. The
 * content array can interleave thinking + text blocks; we keep only text. */
function extractText(response: unknown): string {
  if (typeof response !== "object" || response === null) return "";
  const content = (response as { content?: unknown }).content;
  if (!Array.isArray(content)) return "";
  return content
    .filter(
      (b): b is { type: string; text: string } =>
        typeof b === "object" &&
        b !== null &&
        (b as { type?: unknown }).type === "text" &&
        typeof (b as { text?: unknown }).text === "string",
    )
    .map((b) => b.text)
    .join("");
}

/** Pull a {"statements": [...]} array out of the model's text, tolerating
 * fenced code blocks and leading/trailing prose. Returns raw strings; the
 * SAFETY validator (lib/ai/safety.ts) is applied by the caller, not here.
 * Pure — never throws; returns [] on anything unparseable. */
export function parseStatements(response: unknown): string[] {
  const text = extractText(response).trim();
  if (!text) return [];

  // Strip ```json ... ``` fences if present.
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1] : text;

  const obj = tryParseJsonObject(candidate);
  if (!obj) return [];

  const arr = (obj as { statements?: unknown }).statements;
  if (!Array.isArray(arr)) return [];

  return arr
    .filter((s): s is string => typeof s === "string")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/** Parse the first JSON object found in the text. Tolerates prose around it by
 * slicing from the first "{" to the last "}". */
function tryParseJsonObject(text: string): unknown {
  const direct = safeJson(text);
  if (direct !== undefined) return direct;
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  return safeJson(text.slice(start, end + 1)) ?? null;
}

function safeJson(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    return undefined;
  }
}
