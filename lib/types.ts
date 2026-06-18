// Domain types for SundayQuiz. The platform shell (games/players/lifecycle) is
// generic; bingo is the first game_type. Quiz mode later adds its own config —
// the shell types stay untouched (spec §2).

export type GameStatus = "lobby" | "live" | "finished";
export type GameType = "bingo" | "quiz";

export type GridSize = 3 | 4 | 5;
export type WinCondition = "line" | "two_lines" | "blackout";
export type Audience = "kirke" | "skole" | "generell";

export interface BingoConfig {
  gridSize: GridSize;
  winCondition: WinCondition;
  /** Max confirmed+pending verifications between one pair, both directions
   * combined (THE anti-cluster rule, spec §0.3). */
  maxVerificationsPerPair: number;
  /** Only meaningful for odd grids. */
  freeCentre: boolean;
  statementSetId: string;
}

export const DEFAULT_CONFIG: Omit<BingoConfig, "statementSetId"> = {
  gridSize: 4,
  winCondition: "line",
  maxVerificationsPerPair: 1,
  freeCentre: false,
};

export type PlayerStatus = "active" | "left" | "kicked";
export type MarkStatus = "pending" | "confirmed" | "rejected" | "expired";

/** One board cell, row-major. Free centre is `{ free: true }`. */
export type BoardCell = { statementId: string; text: string } | { free: true };

export function isFreeCell(cell: BoardCell): cell is { free: true } {
  return "free" in cell && cell.free === true;
}

// ---------- DB row shapes (snake_case, as returned by PostgREST) ----------

// `config` is type-specific: BingoConfig for bingo games, QuizConfig for quiz
// games. Routing is by `game_type`; the per-mode code narrows config via the
// bingoConfig()/quizConfig() helpers below.
export type GameConfig = BingoConfig | import("./quiz-types").QuizConfig;

export interface GameRow {
  id: string;
  join_pin: string;
  host_code: string;
  game_type: GameType;
  title: string;
  status: GameStatus;
  config: GameConfig;
  created_at: string;
  started_at: string | null;
  ended_at: string | null;
}

/** Narrow a bingo game's config (only valid when game_type === 'bingo'). */
export function bingoConfig(game: GameRow): BingoConfig {
  return game.config as BingoConfig;
}

export interface PlayerRow {
  id: string;
  game_id: string;
  display_name: string;
  resume_code: string;
  is_host: boolean;
  status: PlayerStatus;
  joined_at: string;
}

export interface BoardRow {
  id: string;
  game_id: string;
  player_id: string;
  cells: BoardCell[];
  bingo_at: string | null;
  bingo_rank: number | null;
}

export interface MarkRow {
  id: string;
  game_id: string;
  board_id: string;
  cell_index: number;
  claimer_id: string;
  verifier_id: string;
  statement_id: string | null;
  statement_text: string;
  status: MarkStatus;
  created_at: string;
  resolved_at: string | null;
}

export interface StatementSetRow {
  id: string;
  title: string;
  audience: Audience;
  is_builtin: boolean;
  game_id: string | null;
}

export interface StatementRow {
  id: string;
  set_id: string;
  text: string;
  sort_order: number;
}
