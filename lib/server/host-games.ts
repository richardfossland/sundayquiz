import "server-only";

// Owner-scoped game queries for the Sunday Account host dashboard. The owner is
// `quiz.games.host_user_id` — nullable, so anonymous (code-only) games keep
// working with it left null. Only games created while a host was signed in get
// stamped (see app/api/games/route.ts).

import { createServiceClient } from "@/lib/supabase/service";
import { GameType, GameStatus } from "@/lib/types";

type Db = ReturnType<typeof createServiceClient>;
function db(): Db {
  return createServiceClient();
}

export interface OwnedGameSummary {
  id: string;
  title: string;
  gameType: GameType;
  status: GameStatus;
  joinPin: string;
  createdAt: string;
}

/** Map a raw game row to the dashboard summary (no host_code — that stays out
 * of the signed-in surface; the console reads it from localStorage). */
export function toOwnedSummary(row: {
  id: string;
  title: string;
  game_type: GameType;
  status: GameStatus;
  join_pin: string;
  created_at: string;
}): OwnedGameSummary {
  return {
    id: row.id,
    title: row.title,
    gameType: row.game_type,
    status: row.status,
    joinPin: row.join_pin,
    createdAt: row.created_at,
  };
}

/** All games owned by this Sunday user, newest first. */
export async function listGamesByOwner(
  userId: string,
): Promise<OwnedGameSummary[]> {
  const { data, error } = await db()
    .from("games")
    .select("id,title,game_type,status,join_pin,created_at")
    .eq("host_user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return ((data as Parameters<typeof toOwnedSummary>[0][]) ?? []).map(
    toOwnedSummary,
  );
}

/** Look up a single game's owner (for the DELETE authz check). Returns the
 * host_user_id or null (null = anonymous game, not owned by anyone). */
export async function getGameOwner(gameId: string): Promise<string | null | undefined> {
  const { data } = await db()
    .from("games")
    .select("host_user_id")
    .eq("id", gameId)
    .maybeSingle();
  if (!data) return undefined; // game does not exist
  return (data as { host_user_id: string | null }).host_user_id;
}

/** Delete a game the given user owns. Children (players, boards, marks,
 * game-local statement/question sets, quiz_state/answers) cascade via the FK
 * `on delete cascade` in the schema. Returns false if the game isn't owned by
 * this user (or doesn't exist) — the caller maps that to 403/404. */
export async function deleteOwnedGame(
  gameId: string,
  userId: string,
): Promise<boolean> {
  const owner = await getGameOwner(gameId);
  if (owner === undefined) return false; // not found
  if (owner !== userId) return false; // not the owner (incl. anonymous games)

  const { error } = await db()
    .from("games")
    .delete()
    .eq("id", gameId)
    .eq("host_user_id", userId);
  if (error) throw new Error(error.message);
  return true;
}

/** Stamp the owner on a freshly created game (best-effort: a failure here must
 * NOT break anonymous create, so the route logs + ignores). */
export async function stampGameOwner(
  gameId: string,
  userId: string,
): Promise<void> {
  const { error } = await db()
    .from("games")
    .update({ host_user_id: userId })
    .eq("id", gameId);
  if (error) throw new Error(error.message);
}
