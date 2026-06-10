import { getGame, getGameByPin, getPlayerByResume } from "@/lib/server/store";
import { fail, ok, readJson, rateLimit, clientIp } from "@/lib/server/http";
import { normalizeResumeCode, isValidPin } from "@/lib/codes";

// POST /api/resume — restore a session from a resume code (player) or host
// code. Accepts { resumeCode, gameId } or { resumeCode, pin }. Codes travel in
// the body only — they are bearer tokens.
export async function POST(req: Request) {
  if (!rateLimit(`resume:${clientIp(req)}`, 40, 60_000)) {
    return fail(429, "rate_limited");
  }
  const body = await readJson<{
    resumeCode?: string;
    pin?: string;
    gameId?: string;
  }>(req);

  const code = normalizeResumeCode(body?.resumeCode?.toString() ?? "");
  if (code.length < 6) return fail(400, "invalid_code");

  const game = body?.gameId
    ? await getGame(body.gameId)
    : body?.pin && isValidPin(body.pin)
      ? await getGameByPin(body.pin.trim())
      : null;
  if (!game) return fail(404, "invalid_code");

  if (game.host_code === code) {
    return ok({ role: "host", gameId: game.id, gameStatus: game.status });
  }

  const player = await getPlayerByResume(game.id, code);
  if (!player || player.status === "kicked") return fail(404, "invalid_code");

  return ok({
    role: "player",
    gameId: game.id,
    playerId: player.id,
    displayName: player.display_name,
    gameStatus: game.status,
  });
}
