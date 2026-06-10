import { fail, ok, readJson } from "@/lib/server/http";
import { requireGame, requireHost } from "@/lib/server/auth";
import {
  addPlayer,
  createBoards,
  getGame,
  listPlayers,
  setGameStatus,
} from "@/lib/server/store";
import { rpcErrorStatus } from "@/lib/server/errors";
import { broadcast } from "@/lib/server/broadcast";
import { channels, events } from "@/lib/realtime";

type Params = { params: Promise<{ id: string }> };

// POST /api/games/[id]/start — lobby → live. Generates every active player's
// board; config and statement set lock here (spec §6). Optionally registers
// the host as a player too ("Jeg spiller selv").
export async function POST(req: Request, { params }: Params) {
  const { id } = await params;
  const game = await requireGame(id);
  if (!game) return fail(404, "not_found");
  const body = await readJson<{
    hostCode?: string;
    hostPlays?: { displayName?: string };
  }>(req);
  if (!requireHost(game, body?.hostCode)) return fail(403, "forbidden");
  if (game.status !== "lobby") return fail(409, "already_started");

  try {
    let hostPlayer = null;
    const hostName = body?.hostPlays?.displayName?.trim();
    if (hostName) {
      hostPlayer = await addPlayer(game.id, hostName.slice(0, 40), true);
    }

    const players = (await listPlayers(game.id)).filter(
      (p) => p.status === "active",
    );
    await createBoards(game, players.map((p) => p.id));
    await setGameStatus(game.id, "live");

    // Close the join-during-start gap: anyone who slipped into the lobby
    // between the snapshot above and the status flip gets a board too
    // (upsert ignores players that already have one).
    const after = await getGame(game.id);
    if (after) {
      const late = (await listPlayers(game.id)).filter(
        (p) => p.status === "active",
      );
      await createBoards(after, late.map((p) => p.id));
    }

    await broadcast(channels.game(game.id), events.status, { status: "live" });
    return ok({
      ok: true,
      playerId: hostPlayer?.id,
      resumeCode: hostPlayer?.resume_code,
    });
  } catch (err) {
    const { status, code } = rpcErrorStatus((err as Error).message);
    if (code === "internal") console.error("[start]", err);
    return fail(status, code === "internal" ? "start_failed" : code);
  }
}
