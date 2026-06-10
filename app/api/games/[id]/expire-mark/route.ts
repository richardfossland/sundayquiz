import { fail, ok, readJson } from "@/lib/server/http";
import { requireGame, requireHost } from "@/lib/server/auth";
import { forceExpireMarks } from "@/lib/server/store";
import { broadcast } from "@/lib/server/broadcast";
import { channels, events } from "@/lib/realtime";

type Params = { params: Promise<{ id: string }> };

// POST /api/games/[id]/expire-mark — host manually releases a stuck pending
// mark (spec §5, host surface).
export async function POST(req: Request, { params }: Params) {
  const { id } = await params;
  const game = await requireGame(id);
  if (!game) return fail(404, "not_found");
  const body = await readJson<{ hostCode?: string; markId?: string }>(req);
  if (!requireHost(game, body?.hostCode)) return fail(403, "forbidden");
  if (!body?.markId) return fail(400, "missing_mark");

  try {
    const released = await forceExpireMarks({
      gameId: game.id,
      markId: body.markId,
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
    return ok({ ok: true });
  } catch (err) {
    console.error("[expire-mark]", err);
    return fail(500, "expire_failed");
  }
}
