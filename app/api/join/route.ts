import {
  addPlayer,
  createBoards,
  getGameByPin,
} from "@/lib/server/store";
import { fail, ok, readJson, rateLimit, clientIp } from "@/lib/server/http";
import { broadcast } from "@/lib/server/broadcast";
import { channels, events } from "@/lib/realtime";
import { isValidPin } from "@/lib/codes";

// POST /api/join — player joins by PIN with a display name. Late join during a
// live game is allowed: the latecomer gets a fresh board inline. The resume
// code (a bearer token) is returned in the body ONLY.
export async function POST(req: Request) {
  if (!rateLimit(`join:${clientIp(req)}`, 30, 60_000)) {
    return fail(429, "rate_limited");
  }
  const body = await readJson<{ pin?: string; displayName?: string }>(req);
  const pin = (body?.pin ?? "").toString().trim();
  const displayName = (body?.displayName ?? "").toString().trim().slice(0, 40);

  if (!isValidPin(pin)) return fail(400, "invalid_pin");
  if (displayName.length < 1) return fail(400, "missing_name");

  const game = await getGameByPin(pin);
  if (!game) return fail(404, "invalid_pin");
  if (game.status === "finished") return fail(409, "game_finished");

  try {
    const player = await addPlayer(game.id, displayName);
    if (game.status === "live") {
      await createBoards(game, [player.id]);
    }
    await broadcast(channels.game(game.id), events.roster, {
      joined: player.id,
    });
    return ok({
      gameId: game.id,
      playerId: player.id,
      resumeCode: player.resume_code,
      displayName: player.display_name,
      gameStatus: game.status,
    });
  } catch (err) {
    console.error("[join]", err);
    return fail(500, "join_failed");
  }
}
