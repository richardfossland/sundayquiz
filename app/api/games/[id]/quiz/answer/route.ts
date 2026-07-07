import { fail, ok, readJson, rateLimit, clientIp } from "@/lib/server/http";
import { requireGame, requirePlayer } from "@/lib/server/auth";
import { rpcSubmitAnswer } from "@/lib/server/quiz-store";
import { rpcErrorStatus } from "@/lib/server/errors";
import { broadcast } from "@/lib/server/broadcast";
import { channels, events } from "@/lib/realtime";

type Params = { params: Promise<{ id: string }> };

// POST /api/games/[id]/quiz/answer — a participant taps one of 4. Validation
// (game live, the question is the one currently open, one answer per player)
// and the SPEED/FLAT scoring all happen atomically inside quiz.submit_answer.
// The elapsed time is measured server-side against question_started_at — never
// trusted from the client — so the score is authoritative.
export async function POST(req: Request, { params }: Params) {
  const { id } = await params;
  const game = await requireGame(id);
  if (!game) return fail(404, "not_found");
  if (game.game_type !== "quiz") return fail(409, "not_quiz");

  const body = await readJson<{
    playerId?: string;
    code?: string;
    questionId?: string;
    choice?: number;
  }>(req);

  // Key the limiter on the un-spoofable client IP, NOT the client-supplied
  // playerId — otherwise an attacker rotates fake playerId values to mint a
  // fresh bucket per request and dodge the cap. (Score-forge is already
  // impossible: submit_answer validates the player + enforces one answer per
  // player/question. The limit is per game IP, generous for a shared-wifi
  // classroom.)
  if (!rateLimit(`answer:${id}:${clientIp(req)}`, 120, 60_000)) {
    return fail(429, "rate_limited");
  }

  const player = await requirePlayer(game, body?.playerId, body?.code);
  if (!player) return fail(403, "forbidden");
  if (
    !body?.questionId ||
    typeof body.choice !== "number" ||
    !Number.isInteger(body.choice)
  ) {
    return fail(400, "invalid_choice");
  }

  try {
    const answer = await rpcSubmitAnswer({
      gameId: game.id,
      playerId: player.id,
      questionId: body.questionId,
      choice: body.choice,
    });
    // Hint the board/host to refetch the live count bar. We do NOT leak
    // correctness here (the board reveals it on the host's 'reveal').
    await broadcast(channels.game(game.id), events.quizAnswer, {
      questionId: body.questionId,
    });
    return ok({ ok: true, choice: answer.choice });
  } catch (err) {
    const { status, code } = rpcErrorStatus((err as Error).message);
    if (code === "internal") console.error("[quiz:answer]", err);
    return fail(status, code);
  }
}
