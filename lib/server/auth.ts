import "server-only";

// Code-based auth (spec §0.7): players authenticate with playerId+resumeCode,
// hosts with the game's host code. Codes travel in request bodies only.

import { normalizeResumeCode } from "@/lib/codes";
import { getGame, getPlayer } from "@/lib/server/store";
import { GameRow, PlayerRow } from "@/lib/types";

export async function requireGame(gameId: string): Promise<GameRow | null> {
  if (!gameId) return null;
  return getGame(gameId);
}

/** Validate player credentials; null = 403. Kicked players lose access. */
export async function requirePlayer(
  game: GameRow,
  playerId: string | undefined,
  resumeCode: string | undefined,
): Promise<PlayerRow | null> {
  if (!playerId || !resumeCode) return null;
  const player = await getPlayer(game.id, playerId);
  if (!player) return null;
  if (player.resume_code !== normalizeResumeCode(resumeCode)) return null;
  if (player.status === "kicked") return null;
  return player;
}

export function requireHost(game: GameRow, hostCode: string | undefined): boolean {
  if (!hostCode) return false;
  return game.host_code === normalizeResumeCode(hostCode);
}
