import { ok, fail } from "@/lib/server/http";
import { listQuestionSets } from "@/lib/server/quiz-store";
import { QuestionSetSummary } from "@/lib/dto";

// GET /api/question-sets — bundled quiz question sets for the wizard. Parallel
// to /api/statement-sets. Game-local custom sets are excluded by the query.
export async function GET() {
  try {
    const rows = await listQuestionSets();
    const sets: QuestionSetSummary[] = rows.map((r) => ({
      id: r.id,
      title: r.title,
      audience: r.audience,
      isBuiltin: r.is_builtin,
      questionCount: r.questions?.[0]?.count ?? 0,
    }));
    return ok({ sets });
  } catch (err) {
    console.error("[question-sets]", err);
    return fail(500, "sets_failed");
  }
}
