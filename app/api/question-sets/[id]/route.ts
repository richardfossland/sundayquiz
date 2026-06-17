import { ok, fail } from "@/lib/server/http";
import { getQuestionSet, listQuestions } from "@/lib/server/quiz-store";

type Params = { params: Promise<{ id: string }> };

// GET /api/question-sets/[id] — full set with questions (wizard preview +
// "kopier og tilpass"). Game-local sets are not served here.
export async function GET(req: Request, { params }: Params) {
  const { id } = await params;
  const set = await getQuestionSet(id);
  if (!set || set.game_id !== null) return fail(404, "not_found");
  const questions = await listQuestions(id);
  return ok({
    id: set.id,
    title: set.title,
    audience: set.audience,
    isBuiltin: set.is_builtin,
    questions: questions.map((q) => ({
      id: q.id,
      prompt: q.prompt,
      options: q.options,
      correctIndex: q.correct_index,
    })),
  });
}
