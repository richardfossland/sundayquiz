import { fail, ok, readJson } from "@/lib/server/http";
import { requireGame, requireHost } from "@/lib/server/auth";
import { rpcAdvanceQuestion } from "@/lib/server/quiz-store";
import { rpcErrorStatus } from "@/lib/server/errors";
import { broadcast } from "@/lib/server/broadcast";
import { channels, events } from "@/lib/realtime";

type Params = { params: Promise<{ id: string }> };

// POST /api/games/[id]/quiz/advance — host drives the shared question stream.
// action: 'next' (open next question / start / auto-finish at the end),
// 'reveal' (close answering, show the leaderboard), 'end' (stop early). All
// lifecycle + lobby→live→finished transitions are atomic inside
// quiz.advance_question.
export async function POST(req: Request, { params }: Params) {
  const { id } = await params;
  const game = await requireGame(id);
  if (!game) return fail(404, "not_found");
  if (game.game_type !== "quiz") return fail(409, "not_quiz");

  const body = await readJson<{
    hostCode?: string;
    action?: "next" | "reveal" | "end";
  }>(req);
  if (!requireHost(game, body?.hostCode)) return fail(403, "forbidden");
  const action = body?.action;
  if (action !== "next" && action !== "reveal" && action !== "end") {
    return fail(400, "invalid_action");
  }

  try {
    const result = await rpcAdvanceQuestion({ gameId: game.id, action });
    await broadcast(channels.game(game.id), events.quizAdvance, {
      phase: result.state.phase,
      index: result.state.current_index,
    });
    // 'next' past the last question (and 'end') finish the game.
    if (result.state.phase === "ended") {
      await broadcast(channels.game(game.id), events.status, {
        status: "finished",
      });
    }
    return ok({
      phase: result.state.phase,
      questionNumber: result.state.current_index + 1,
      totalQuestions: result.totalQuestions,
    });
  } catch (err) {
    const { status, code } = rpcErrorStatus((err as Error).message);
    if (code === "internal") console.error("[quiz:advance]", err);
    return fail(status, code);
  }
}
