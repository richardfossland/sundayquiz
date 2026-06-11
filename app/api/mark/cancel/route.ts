import { fail, ok, readJson } from "@/lib/server/http";
import { requireGame, requirePlayer } from "@/lib/server/auth";
import { cancelOwnMark } from "@/lib/server/store";
import { broadcast } from "@/lib/server/broadcast";
import { channels, events } from "@/lib/realtime";

// POST /api/mark/cancel — claimer cancels their own pending mark (frees the
// cell immediately instead of waiting out the 60s timeout, spec §5).
export async function POST(req: Request) {
  const body = await readJson<{
    gameId?: string;
    playerId?: string;
    code?: string;
    markId?: string;
  }>(req);
  if (!body?.gameId || !body.markId) return fail(400, "missing_mark");

  const game = await requireGame(body.gameId);
  if (!game) return fail(404, "not_found");
  const player = await requirePlayer(game, body.playerId, body.code);
  if (!player) return fail(403, "forbidden");

  try {
    const cancelled = await cancelOwnMark({
      gameId: game.id,
      claimerId: player.id,
      markId: body.markId,
    });
    if (cancelled) {
      await broadcast(channels.game(game.id), events.markResolved, {
        markId: cancelled.id,
        status: "expired",
        targetPlayerId: cancelled.claimer_id,
        verifierId: cancelled.verifier_id,
        cellIndex: cancelled.cell_index,
      });
    }
    return ok({ ok: true });
  } catch (err) {
    console.error("[mark:cancel]", err);
    return fail(500, "cancel_failed");
  }
}
