import { fail, ok, readJson } from "@/lib/server/http";
import { requireGame, requireHost, requirePlayer } from "@/lib/server/auth";
import {
  buildBoardState,
  buildHostState,
  buildPlayerState,
} from "@/lib/server/state";
import { expireStaleMarks } from "@/lib/server/store";
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

  await expireAndNotify(game);

  if (body?.role === "host") {
    if (!requireHost(game, body.code)) return fail(403, "forbidden");
    return ok(await buildHostState(game));
  }

  const player = await requirePlayer(game, body?.playerId, body?.code);
  if (!player) return fail(403, "forbidden");
  return ok(await buildPlayerState(game, player));
}
