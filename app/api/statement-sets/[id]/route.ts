import { ok, fail } from "@/lib/server/http";
import { getStatementSet, listStatements } from "@/lib/server/store";

type Params = { params: Promise<{ id: string }> };

// GET /api/statement-sets/[id] — full set with statements (wizard preview +
// "kopier og tilpass"). Game-local sets are not served here.
export async function GET(req: Request, { params }: Params) {
  const { id } = await params;
  const set = await getStatementSet(id);
  if (!set || set.game_id !== null) return fail(404, "not_found");
  const statements = await listStatements(id);
  return ok({
    id: set.id,
    title: set.title,
    audience: set.audience,
    isBuiltin: set.is_builtin,
    statements: statements.map((s) => ({ id: s.id, text: s.text })),
  });
}
