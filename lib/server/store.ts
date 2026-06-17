import "server-only";

// Data access for the quiz schema. All functions use the service-role client;
// nothing here is reachable from the browser. Throwing helpers keep route
// handlers small — they catch and map error messages to HTTP statuses.

import { createServiceClient } from "@/lib/supabase/service";
import {
  generatePin,
  generateResumeCode,
  generateHostCode,
} from "@/lib/codes";
import { generateBoard, PoolStatement } from "@/lib/server/boards";
import {
  BingoConfig,
  BoardCell,
  BoardRow,
  GameRow,
  MarkRow,
  PlayerRow,
  StatementRow,
  StatementSetRow,
  bingoConfig,
} from "@/lib/types";

type Db = ReturnType<typeof createServiceClient>;

function db(): Db {
  return createServiceClient();
}

function isUniqueViolation(err: { code?: string } | null): boolean {
  return err?.code === "23505";
}

// ---------- games ----------

export interface CreateGameInput {
  title: string;
  config: Omit<BingoConfig, "statementSetId">;
  statementSet: { id: string } | { title: string; statements: string[] };
}

export async function createGame(input: CreateGameInput): Promise<{
  game: GameRow;
  joinPin: string;
  hostCode: string;
}> {
  const client = db();
  const hostCode = generateHostCode();

  // PIN uniqueness among non-finished games is a partial unique index; retry
  // on collision.
  let game: GameRow | null = null;
  for (let i = 0; i < 7 && !game; i++) {
    const joinPin = generatePin();
    const { data, error } = await client
      .from("games")
      .insert({
        join_pin: joinPin,
        host_code: hostCode,
        title: input.title,
        config: { ...input.config, statementSetId: null },
      })
      .select()
      .single();
    if (error) {
      if (isUniqueViolation(error)) continue;
      throw new Error(error.message);
    }
    game = data as GameRow;
  }
  if (!game) throw new Error("pin_generation_failed");

  // Resolve the statement set: existing id, or a game-local custom set.
  let setId: string;
  if ("id" in input.statementSet) {
    const set = await getStatementSet(input.statementSet.id);
    // Only bundled / non-game-local sets may be referenced by id; this blocks
    // binding a board to another game's private custom set.
    if (!set || set.game_id !== null) throw new Error("set_not_found");
    setId = set.id;
  } else {
    const { data: set, error } = await client
      .from("statement_sets")
      .insert({
        title: input.statementSet.title || "Eget sett",
        audience: "generell",
        game_id: game.id,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    setId = (set as StatementSetRow).id;
    const rows = input.statementSet.statements.map((text, i) => ({
      set_id: setId,
      text,
      sort_order: i + 1,
    }));
    const { error: stErr } = await client.from("statements").insert(rows);
    if (stErr) throw new Error(stErr.message);
  }

  const config: BingoConfig = { ...input.config, statementSetId: setId };
  const { data: updated, error: cfgErr } = await client
    .from("games")
    .update({ config })
    .eq("id", game.id)
    .select()
    .single();
  if (cfgErr) throw new Error(cfgErr.message);

  const final = updated as GameRow;
  return { game: final, joinPin: final.join_pin, hostCode };
}

export async function getGame(id: string): Promise<GameRow | null> {
  const { data } = await db().from("games").select().eq("id", id).maybeSingle();
  return (data as GameRow) ?? null;
}

export async function getGameByPin(pin: string): Promise<GameRow | null> {
  const { data } = await db()
    .from("games")
    .select()
    .eq("join_pin", pin)
    .neq("status", "finished")
    .maybeSingle();
  return (data as GameRow) ?? null;
}

export async function setGameStatus(
  id: string,
  status: "live" | "finished",
): Promise<void> {
  const patch: Record<string, unknown> = { status };
  if (status === "live") patch.started_at = new Date().toISOString();
  if (status === "finished") patch.ended_at = new Date().toISOString();
  const { error } = await db().from("games").update(patch).eq("id", id);
  if (error) throw new Error(error.message);
}

// ---------- players ----------

export async function addPlayer(
  gameId: string,
  displayName: string,
  isHost = false,
): Promise<PlayerRow> {
  const client = db();
  for (let i = 0; i < 7; i++) {
    const { data, error } = await client
      .from("players")
      .insert({
        game_id: gameId,
        display_name: displayName,
        resume_code: generateResumeCode(),
        is_host: isHost,
      })
      .select()
      .single();
    if (error) {
      if (isUniqueViolation(error)) continue; // resume-code clash → retry
      throw new Error(error.message);
    }
    return data as PlayerRow;
  }
  throw new Error("code_generation_failed");
}

export async function getPlayer(
  gameId: string,
  playerId: string,
): Promise<PlayerRow | null> {
  const { data } = await db()
    .from("players")
    .select()
    .eq("game_id", gameId)
    .eq("id", playerId)
    .maybeSingle();
  return (data as PlayerRow) ?? null;
}

export async function getPlayerByResume(
  gameId: string,
  resumeCode: string,
): Promise<PlayerRow | null> {
  const { data } = await db()
    .from("players")
    .select()
    .eq("game_id", gameId)
    .eq("resume_code", resumeCode)
    .maybeSingle();
  return (data as PlayerRow) ?? null;
}

export async function listPlayers(gameId: string): Promise<PlayerRow[]> {
  const { data } = await db()
    .from("players")
    .select()
    .eq("game_id", gameId)
    .order("joined_at", { ascending: true });
  return (data as PlayerRow[]) ?? [];
}

export async function setPlayerStatus(
  gameId: string,
  playerId: string,
  status: "left" | "kicked",
): Promise<void> {
  const { error } = await db()
    .from("players")
    .update({ status })
    .eq("game_id", gameId)
    .eq("id", playerId);
  if (error) throw new Error(error.message);
}

// ---------- statement sets ----------

export async function listStatementSets(): Promise<
  (StatementSetRow & { statements: { count: number }[] })[]
> {
  const { data, error } = await db()
    .from("statement_sets")
    .select("id,title,audience,is_builtin,game_id,statements(count)")
    .is("game_id", null)
    .order("title");
  if (error) throw new Error(error.message);
  return (data as (StatementSetRow & { statements: { count: number }[] })[]) ?? [];
}

export async function getStatementSet(
  id: string,
): Promise<StatementSetRow | null> {
  const { data } = await db()
    .from("statement_sets")
    .select()
    .eq("id", id)
    .maybeSingle();
  return (data as StatementSetRow) ?? null;
}

export async function listStatements(setId: string): Promise<StatementRow[]> {
  const { data, error } = await db()
    .from("statements")
    .select()
    .eq("set_id", setId)
    .order("sort_order");
  if (error) throw new Error(error.message);
  return (data as StatementRow[]) ?? [];
}

// ---------- boards ----------

export async function getBoardForPlayer(
  gameId: string,
  playerId: string,
): Promise<BoardRow | null> {
  const { data } = await db()
    .from("boards")
    .select()
    .eq("game_id", gameId)
    .eq("player_id", playerId)
    .maybeSingle();
  return (data as BoardRow) ?? null;
}

export async function listBoards(gameId: string): Promise<BoardRow[]> {
  const { data } = await db().from("boards").select().eq("game_id", gameId);
  return (data as BoardRow[]) ?? [];
}

/** Generate + insert boards for the given players. Conflict-safe: a player
 * who already has a board keeps it (unique on game_id, player_id). */
export async function createBoards(
  game: GameRow,
  playerIds: string[],
): Promise<void> {
  if (playerIds.length === 0) return;
  const cfg = bingoConfig(game);
  const pool: PoolStatement[] = (
    await listStatements(cfg.statementSetId)
  ).map((s) => ({ id: s.id, text: s.text }));

  const rows = playerIds.map((playerId) => ({
    game_id: game.id,
    player_id: playerId,
    cells: generateBoard(
      pool,
      cfg.gridSize,
      cfg.freeCentre,
    ) satisfies BoardCell[],
  }));
  const { error } = await db()
    .from("boards")
    .upsert(rows, { onConflict: "game_id,player_id", ignoreDuplicates: true });
  if (error) throw new Error(error.message);
}

// ---------- marks ----------

export async function listMarks(gameId: string): Promise<MarkRow[]> {
  const { data, error } = await db()
    .from("marks")
    .select()
    .eq("game_id", gameId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data as MarkRow[]) ?? [];
}

export async function getMark(markId: string): Promise<MarkRow | null> {
  const { data } = await db()
    .from("marks")
    .select()
    .eq("id", markId)
    .maybeSingle();
  return (data as MarkRow) ?? null;
}

/** Lazy expiry site #3 (state reads). Returns the rows that flipped so the
 * caller can broadcast mark_resolved hints. */
export async function expireStaleMarks(gameId: string): Promise<MarkRow[]> {
  const { data, error } = await db().rpc("expire_stale_marks", {
    p_game_id: gameId,
  });
  if (error) throw new Error(error.message);
  return (data as MarkRow[]) ?? [];
}

export async function rpcCreateMark(args: {
  gameId: string;
  claimerId: string;
  cellIndex: number;
  verifierId: string;
}): Promise<MarkRow> {
  const { data, error } = await db().rpc("create_mark", {
    p_game_id: args.gameId,
    p_claimer_id: args.claimerId,
    p_cell_index: args.cellIndex,
    p_verifier_id: args.verifierId,
  });
  if (error) throw new Error(error.message);
  return data as MarkRow;
}

export interface RespondResult {
  mark: MarkRow;
  bingo: { rank: number; at: string } | null;
  reason?: string;
}

export async function rpcRespondMark(args: {
  markId: string;
  verifierId: string;
  accept: boolean;
}): Promise<RespondResult> {
  const { data, error } = await db().rpc("respond_mark", {
    p_mark_id: args.markId,
    p_verifier_id: args.verifierId,
    p_accept: args.accept,
  });
  if (error) throw new Error(error.message);
  return data as RespondResult;
}

/** Cancel one's OWN pending mark (claimer action) — frees the cell so they can
 * try a different person without waiting out the 60s timeout. Scoped to the
 * caller's own pending marks; returns null if it wasn't theirs/pending. */
export async function cancelOwnMark(args: {
  gameId: string;
  claimerId: string;
  markId: string;
}): Promise<MarkRow | null> {
  const { data, error } = await db()
    .from("marks")
    .update({ status: "expired", resolved_at: new Date().toISOString() })
    .eq("id", args.markId)
    .eq("game_id", args.gameId)
    .eq("claimer_id", args.claimerId)
    .eq("status", "pending")
    .select()
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as MarkRow) ?? null;
}

/** Force-expire a single pending mark (host action) or all pendings touching a
 * kicked player. */
export async function forceExpireMarks(filter: {
  gameId: string;
  markId?: string;
  playerId?: string;
}): Promise<MarkRow[]> {
  let q = db()
    .from("marks")
    .update({ status: "expired", resolved_at: new Date().toISOString() })
    .eq("game_id", filter.gameId)
    .eq("status", "pending");
  if (filter.markId) q = q.eq("id", filter.markId);
  if (filter.playerId) {
    q = q.or(
      `claimer_id.eq.${filter.playerId},verifier_id.eq.${filter.playerId}`,
    );
  }
  const { data, error } = await q.select();
  if (error) throw new Error(error.message);
  return (data as MarkRow[]) ?? [];
}
