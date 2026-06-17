// PURE, server-and-test-safe statement safety validator (no imports, no I/O).
//
// This is the SECOND line of defence behind the strict system prompt: the LLM
// only *suggests* statements, and every suggestion is filtered here before it
// can reach the editable draft. It enforces the SPEC §0.10 / §7 safety bar —
// statements must never be sensitive: nothing about body/appearance, family
// situation, economy/money, or beliefs-as-gotcha — plus basic shape rules
// (length, one-liner, no questions). It is intentionally conservative: it is
// better to drop a borderline-but-fine statement than to surface a flat one.
//
// Tone target (spec §7): "varm, inkluderende, null flaut."

export type RejectReason =
  | "too_short"
  | "too_long"
  | "multiline"
  | "is_question"
  | "body"
  | "family"
  | "economy"
  | "belief_gotcha";

export interface StatementVerdict {
  text: string;
  ok: boolean;
  reason?: RejectReason;
}

export const MIN_LEN = 3;
export const MAX_LEN = 120;

// Each banned category is a list of Norwegian (Bokmål) word-stems checked as
// whole-word / prefix matches against the lowercased, accent-folded statement.
// Stems are deliberate (e.g. "vekt" catches "vekta/vekten/vektklasse").
//
// belief_gotcha targets statements that turn personal faith into a "caught you"
// quiz square — "tror på Gud", "er frelst", "ber hver dag". Warm faith-adjacent
// statements that are about *activity* ("har vært på leir", "synger i koret")
// are fine and are NOT listed here.
const BANNED: Record<Exclude<RejectReason, "too_short" | "too_long" | "multiline" | "is_question">, string[]> = {
  body: [
    "kropp",
    "vekt",
    "veier",
    "slank",
    "tjukk",
    "tykk",
    "feit",
    "overvekt",
    "undervekt",
    "diett",
    "slanke",
    "muskl",
    "mage",
    "rumpe",
    "pupp",
    "bryst",
    "utseend",
    "stygg",
    "penest",
    "finest",
    "hoyest", // høyest → hoyest (ø→o)
    "lavest",
    "kort", // kortest -> covered; "kort hår" edge, accept tradeoff
    "spiseforstyrr",
    "anoreks",
    "bulim",
    "hud",
    "kvis",
    "arr",
  ],
  family: [
    "skilt",
    "skilsmiss",
    "samlivsbrudd",
    "fosterhjem",
    "adopt",
    "enslig",
    "aleneforelder",
    "dod", // død → dod (ø→o) — covers dødsfall
    "mistet",
    "gravlagt",
    "begravelse",
    "abort",
    "barnlos", // barnløs → barnlos
    "ufrivillig",
    "voldtekt",
    "overgrep",
    "vold i hjemmet",
  ],
  economy: [
    "fattig",
    "rik",
    "penger",
    "lonn", // lønn → lonn (ø→o)
    "gjeld",
    "lan", // lån → lan (å→a)
    "sosialhjelp",
    "nav",
    "arbeidsledig",
    "arbeidslos", // arbeidsløs → arbeidslos
    "konkurs",
    "millionaer", // millionær → millionaer (æ→ae)
    "dyr bil",
    "rad", // råd → rad (å→a) — "har ikke råd"
    "billig",
    "sparekonto",
    "arv",
  ],
  belief_gotcha: [
    "frelst",
    "tror pa gud", // folded
    "tror ikke pa gud",
    "ateist",
    "er kristen",
    "ikke kristen",
    "ber hver",
    "ber til",
    "leser bibel", // "leser i Bibelen hver dag" gotcha; bundled sets avoid this
    "synder",
    "helvete",
    "tvil pa",
    "mistet troen",
    "omvend",
    "dopt", // døpt (folded) — as a gotcha about belief status
  ],
};

/** Fold Norwegian diacritics and lowercase so the banned stems (written without
 * æ/ø/å) match real input. */
function fold(s: string): string {
  return s
    .toLowerCase()
    .replace(/æ/g, "ae")
    .replace(/ø/g, "o")
    .replace(/å/g, "a");
}

/** Whole-word-ish stem match: the stem must start at a word boundary in the
 * folded text. Prefix match (so "vekt" hits "vekten") but boundary-anchored on
 * the left (so "kort" does not hit "rekord"). */
function containsStem(folded: string, stem: string): boolean {
  const f = fold(stem);
  if (f.includes(" ")) return folded.includes(f); // multi-word phrase
  // \b is fine for ASCII after folding.
  const re = new RegExp(`(^|[^a-z0-9])${escapeRe(f)}`);
  return re.test(folded);
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Validate a single statement. Pure. */
export function checkStatement(raw: string): StatementVerdict {
  const text = raw.trim();
  if (text.length < MIN_LEN) return { text, ok: false, reason: "too_short" };
  if (text.length > MAX_LEN) return { text, ok: false, reason: "too_long" };
  if (/[\r\n]/.test(text)) return { text, ok: false, reason: "multiline" };
  if (text.includes("?")) return { text, ok: false, reason: "is_question" };

  const folded = fold(text);
  for (const [reason, stems] of Object.entries(BANNED) as [
    keyof typeof BANNED,
    string[],
  ][]) {
    for (const stem of stems) {
      if (containsStem(folded, stem)) {
        return { text, ok: false, reason };
      }
    }
  }
  return { text, ok: true };
}

export interface SanitizeResult {
  /** Statements that pass the safety bar, de-duplicated (case-insensitive),
   * trimmed, in input order. */
  accepted: string[];
  /** Rejected statements with the reason, for telemetry / host transparency. */
  rejected: StatementVerdict[];
}

/** Filter + de-duplicate a list of candidate statements. Pure. */
export function sanitizeStatements(candidates: string[]): SanitizeResult {
  const accepted: string[] = [];
  const rejected: StatementVerdict[] = [];
  const seen = new Set<string>();
  for (const c of candidates) {
    const verdict = checkStatement(c);
    if (!verdict.ok) {
      rejected.push(verdict);
      continue;
    }
    const key = verdict.text.toLowerCase();
    if (seen.has(key)) continue; // silent dedupe, not a "rejection"
    seen.add(key);
    accepted.push(verdict.text);
  }
  return { accepted, rejected };
}
