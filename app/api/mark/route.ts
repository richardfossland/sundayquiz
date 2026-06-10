import { fail, ok, readJson, rateLimit, clientIp } from "@/lib/server/http";
import { requireGame, requirePlayer } from "@/lib/server/auth";
import { rpcCreateMark } from "@/lib/server/store";
import { rpcErrorStatus } from "@/lib/server/errors";
import { broadcast } from "@/lib/server/broadcast";
import { channels, events } from "@/lib/realtime";

// POST /api/mark — A claims a cell, naming B as verifier. All validation
// (game live, cell unmarked, one pending per claimer, pair limit) is atomic
// inside quiz.create_mark.
export async function POST(req: Request) {
  const body = await readJson<{
    gameId?: string;
    playerId?: string;
    code?: string;
    cellIndex?: number;
    verifierId?: string;
  }>(req);
  if (!body?.gameId) return fail(400, "missing_game");
  // Per-player rate limit on top of the RPC's one-pending rule.
  if (!rateLimit(`mark:${body.playerId ?? clientIp(req)}`, 20, 60_000)) {
    return fail(429, "rate_limited");
  }

  const game = await requireGame(body.gameId);
  if (!game) return fail(404, "not_found");
  const player = await requirePlayer(game, body.playerId, body.code);
  if (!player) return fail(403, "forbidden");
  if (
    typeof body.cellIndex !== "number" ||
    !Number.isInteger(body.cellIndex) ||
    !body.verifierId
  ) {
    return fail(400, "invalid_cell");
  }

  try {
    const mark = await rpcCreateMark({
      gameId: game.id,
      claimerId: player.id,
      cellIndex: body.cellIndex,
      verifierId: body.verifierId,
    });
    await broadcast(channels.game(game.id), events.markPending, {
      markId: mark.id,
      targetPlayerId: mark.verifier_id,
    });
    return ok({ markId: mark.id });
  } catch (err) {
    const { status, code } = rpcErrorStatus((err as Error).message);
    if (code === "internal") console.error("[mark]", err);
    return fail(status, code);
  }
}
