import { fail, ok, readJson } from "@/lib/server/http";
import { requireGame, requireHost, requirePlayer } from "@/lib/server/auth";
import {
  buildBoardState,
  buildHostState,
  buildPlayerState,
} from "@/lib/server/state";
import {
  buildQuizBoardState,
  buildQuizHostState,
  buildQuizPlayerState,
} from "@/lib/server/quiz-state";
import {
  createBoards,
  expireStaleMarks,
  getBoardForPlayer,
} from "@/lib/server/store";
import { broadcast } from "@/lib/server/broadcast";
import { channels, events } from "@/lib/realtime";
import { GameRow } from "@/lib/types";

type Params = { params: Promise<{ id: string }> };

// Lazy expiry site #3: every state read first expires stale pendings and
// broadcasts a hint per flipped mark, so claimers/verifiers converge even in
// an idle room (the board screen polls).
async function expireAndNotify(game: GameRow): Promise<void> {
  if (game.status !== "live") return;
  const expired = await expireStaleMarks(game.id);
  await Promise.all(
    expired.map((m) =>
      broadcast(channels.game(game.id), events.markResolved, {
        markId: m.id,
        status: "expired",
        targetPlayerId: m.claimer_id,
        verifierId: m.verifier_id,
        cellIndex: m.cell_index,
      }),
    ),
  );
}

// GET /api/games/[id]/state?role=board — the public big-screen view.
export async function GET(req: Request, { params }: Params) {
  const { id } = await params;
  const game = await requireGame(id);
  if (!game) return fail(404, "not_found");
  if (game.game_type === "quiz") {
    return ok(await buildQuizBoardState(game));
  }
  await expireAndNotify(game);
  return ok(await buildBoardState(game));
}

// POST /api/games/[id]/state — player/host views (codes in the body).
export async function POST(req: Request, { params }: Params) {
  const { id } = await params;
  const game = await requireGame(id);
  if (!game) return fail(404, "not_found");

  const body = await readJson<{
    role?: "player" | "host";
    playerId?: string;
    code?: string;
  }>(req);

  const isQuiz = game.game_type === "quiz";
  if (!isQuiz) await expireAndNotify(game);

  if (body?.role === "host") {
    if (!requireHost(game, body.code)) return fail(403, "forbidden");
    return ok(isQuiz ? await buildQuizHostState(game) : await buildHostState(game));
  }

  const player = await requirePlayer(game, body?.playerId, body?.code);
  if (!player) return fail(403, "forbidden");

  if (isQuiz) {
    // Quiz has no per-player board to generate — the question stream is shared.
    return ok(await buildQuizPlayerState(game, player));
  }

  // Self-heal: a player who joined in the lobby but slipped through the
  // start-transition race (joined as 'lobby' just as the host flipped to
  // 'live') can end up live with no board. Generate it on first read so they
  // are never stranded on the loading spinner. Idempotent (upsert ignores an
  // existing board).
  if (game.status === "live" && player.status === "active") {
    const board = await getBoardForPlayer(game.id, player.id);
    if (!board) await createBoards(game, [player.id]);
  }

  return ok(await buildPlayerState(game, player));
}
