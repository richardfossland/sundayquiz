import "server-only";

// RPC error codes (raised in supabase/migrations/0002_mark_rpcs.sql) → HTTP
// statuses. Anything unrecognised is a 500.

const STATUS_BY_CODE: Record<string, number> = {
  game_not_live: 409,
  invalid_claimer: 403,
  invalid_verifier: 409,
  board_not_found: 404,
  invalid_cell: 400,
  cell_free: 400,
  cell_taken: 409,
  already_pending: 409,
  pair_limit: 409,
  mark_not_found: 404,
  mark_not_pending: 409,
  not_your_mark: 403,
  set_not_found: 404,
  pool_too_small: 400,
  // quiz mode
  game_not_found: 404,
  not_quiz: 409,
  invalid_action: 400,
  not_in_question: 409,
  question_open: 409,
  no_open_question: 409,
  wrong_question: 409,
  invalid_choice: 400,
  invalid_player: 403,
  already_answered: 409,
};

export function rpcErrorStatus(message: string): {
  status: number;
  code: string;
} {
  const code = message.trim();
  const status = STATUS_BY_CODE[code];
  return status ? { status, code } : { status: 500, code: "internal" };
}
