import { fail, ok, readJson } from "@/lib/server/http";
import { requireGame, requirePlayer } from "@/lib/server/auth";
import { listPlayers, rpcRespondMark } from "@/lib/server/store";
import { rpcErrorStatus } from "@/lib/server/errors";
import { broadcast } from "@/lib/server/broadcast";
import { channels, events } from "@/lib/realtime";

// POST /api/mark/respond — verifier answers Ja/Nei. Confirm, win evaluation
// and bingo ranking happen atomically inside quiz.respond_mark.
export async function POST(req: Request) {
  const body = await readJson<{
    gameId?: string;
    playerId?: string;
    code?: string;
    markId?: string;
    accept?: boolean;
  }>(req);
  if (!body?.gameId || !body.markId) return fail(400, "missing_mark");

  const game = await requireGame(body.gameId);
  if (!game) return fail(404, "not_found");
  const player = await requirePlayer(game, body.playerId, body.code);
  if (!player) return fail(403, "forbidden");

  try {
    const result = await rpcRespondMark({
      markId: body.markId,
      verifierId: player.id,
      accept: body.accept === true,
    });
    const mark = result.mark;
    await broadcast(channels.game(game.id), events.markResolved, {
      markId: mark.id,
      status: mark.status,
      targetPlayerId: mark.claimer_id,
      verifierId: mark.verifier_id,
      cellIndex: mark.cell_index,
    });
    if (result.bingo) {
      const names = await listPlayers(game.id);
      const claimer = names.find((p) => p.id === mark.claimer_id);
      await broadcast(channels.game(game.id), events.bingo, {
        playerId: mark.claimer_id,
        displayName: claimer?.display_name ?? "?",
        rank: result.bingo.rank,
      });
    }
    return ok({ status: mark.status, bingo: result.bingo ?? null });
  } catch (err) {
    const { status, code } = rpcErrorStatus((err as Error).message);
    if (code === "internal") console.error("[mark:respond]", err);
    return fail(status, code);
  }
}
