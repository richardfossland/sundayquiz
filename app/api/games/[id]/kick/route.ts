import { fail, ok, readJson } from "@/lib/server/http";
import { requireGame, requireHost } from "@/lib/server/auth";
import {
  forceExpireMarks,
  getPlayer,
  setPlayerStatus,
} from "@/lib/server/store";
import { broadcast } from "@/lib/server/broadcast";
import { channels, events } from "@/lib/realtime";

type Params = { params: Promise<{ id: string }> };

// POST /api/games/[id]/kick — host removes a player. Their pending marks (in
// either direction) are released so no cell stays stuck waiting on them.
export async function POST(req: Request, { params }: Params) {
  const { id } = await params;
  const game = await requireGame(id);
  if (!game) return fail(404, "not_found");
  const body = await readJson<{ hostCode?: string; playerId?: string }>(req);
  if (!requireHost(game, body?.hostCode)) return fail(403, "forbidden");
  if (!body?.playerId) return fail(400, "missing_player");

  const player = await getPlayer(game.id, body.playerId);
  if (!player) return fail(404, "player_not_found");

  try {
    await setPlayerStatus(game.id, player.id, "kicked");
    const released = await forceExpireMarks({
      gameId: game.id,
      playerId: player.id,
    });
    await Promise.all(
      released.map((m) =>
        broadcast(channels.game(game.id), events.markResolved, {
          markId: m.id,
          status: "expired",
          targetPlayerId: m.claimer_id,
          verifierId: m.verifier_id,
          cellIndex: m.cell_index,
        }),
      ),
    );
    await broadcast(channels.game(game.id), events.roster, {
      kicked: player.id,
    });
    return ok({ ok: true });
  } catch (err) {
    console.error("[kick]", err);
    return fail(500, "kick_failed");
  }
}
