import { fail, ok, readJson } from "@/lib/server/http";
import { requireGame, requireHost } from "@/lib/server/auth";
import { forceExpireMarks, setGameStatus } from "@/lib/server/store";
import { broadcast } from "@/lib/server/broadcast";
import { channels, events } from "@/lib/realtime";

type Params = { params: Promise<{ id: string }> };

// POST /api/games/[id]/end — the host decides when the gathering is over
// (spec §0.5). The board flips to the finale.
export async function POST(req: Request, { params }: Params) {
  const { id } = await params;
  const game = await requireGame(id);
  if (!game) return fail(404, "not_found");
  const body = await readJson<{ hostCode?: string }>(req);
  if (!requireHost(game, body?.hostCode)) return fail(403, "forbidden");
  if (game.status === "finished") return ok({ ok: true });

  try {
    await forceExpireMarks({ gameId: game.id });
    await setGameStatus(game.id, "finished");
    await broadcast(channels.game(game.id), events.status, {
      status: "finished",
    });
    return ok({ ok: true });
  } catch (err) {
    console.error("[end]", err);
    return fail(500, "end_failed");
  }
}
