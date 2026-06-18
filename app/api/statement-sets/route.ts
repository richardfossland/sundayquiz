import { ok, fail } from "@/lib/server/http";
import { listStatementSets } from "@/lib/server/store";
import { getLlmClient } from "@/lib/server/llm";
import { StatementSetSummary } from "@/lib/dto";

// GET /api/statement-sets — bundled (and later: account-saved) sets for the
// wizard. Game-local custom sets are excluded by the store query. `aiAvailable`
// tells the wizard whether to offer "Lag med AI" (false when no API key is
// configured — manual creation is unaffected either way).
export async function GET() {
  try {
    const rows = await listStatementSets();
    const sets: StatementSetSummary[] = rows.map((r) => ({
      id: r.id,
      title: r.title,
      audience: r.audience,
      isBuiltin: r.is_builtin,
      statementCount: r.statements?.[0]?.count ?? 0,
    }));
    return ok({ sets, aiAvailable: getLlmClient() !== null });
  } catch (err) {
    console.error("[sets]", err);
    return fail(500, "sets_failed");
  }
}
