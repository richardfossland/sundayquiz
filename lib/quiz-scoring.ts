// Quiz scoring — TypeScript twin of quiz.score_answer in
// supabase/migrations/0004_quiz_mode.sql. The SQL function is authoritative (it
// runs inside quiz.submit_answer); this twin exists for client-side display
// ("du fikk 820 poeng!") and so the scoring is unit-testable. Keep the two in
// lockstep — any change here MUST be mirrored in the plpgsql, and vice versa.
//
// Mirrors the lib/winning.ts ↔ quiz.eval_win discipline used by bingo.

import {
  MAX_QUESTION_POINTS,
  MIN_SPEED_POINTS,
  PointsMode,
} from "./quiz-types";

/**
 * Points for one answer.
 *
 * - Wrong answers always score 0.
 * - 'flat': every correct answer scores MAX_QUESTION_POINTS, regardless of
 *   speed.
 * - 'speed': a correct answer decays linearly from MAX_QUESTION_POINTS (instant)
 *   down to MIN_SPEED_POINTS (right at the buzzer). After the window closes the
 *   answer still counts as correct but scores the floor — late answers are
 *   never rejected here (the server decides whether the window is open).
 *
 * elapsedMs is clamped to [0, windowMs]; windowMs <= 0 falls back to the floor
 * for correct speed answers (degenerate config, never trusted to divide by 0).
 */
export function scoreAnswer(args: {
  correct: boolean;
  pointsMode: PointsMode;
  elapsedMs: number;
  windowMs: number;
}): number {
  const { correct, pointsMode, elapsedMs, windowMs } = args;
  if (!correct) return 0;
  if (pointsMode === "flat") return MAX_QUESTION_POINTS;

  if (windowMs <= 0) return MIN_SPEED_POINTS;
  const clamped = Math.max(0, Math.min(elapsedMs, windowMs));
  const fraction = clamped / windowMs; // 0 (instant) … 1 (buzzer)
  const span = MAX_QUESTION_POINTS - MIN_SPEED_POINTS;
  return Math.round(MAX_QUESTION_POINTS - fraction * span);
}

export interface ScoreRow {
  playerId: string;
  name: string;
  score: number;
  /** Number of questions answered correctly (tie-break + display). */
  correctCount: number;
}

/**
 * Leaderboard from per-answer points: sum per player, sort by total score
 * descending, then by correctCount descending, then by name for a stable,
 * deterministic order (so the SQL twin and this agree exactly). Players with no
 * answers are included at 0 so the board shows the whole room.
 */
export function leaderboard(
  players: { id: string; name: string }[],
  answers: { playerId: string; points: number; correct: boolean }[],
): ScoreRow[] {
  const byPlayer = new Map<string, { score: number; correctCount: number }>();
  for (const p of players) byPlayer.set(p.id, { score: 0, correctCount: 0 });
  for (const a of answers) {
    const agg = byPlayer.get(a.playerId);
    if (!agg) continue; // answer from a player not in the roster → ignore
    agg.score += a.points;
    if (a.correct) agg.correctCount += 1;
  }
  return players
    .map((p) => ({
      playerId: p.id,
      name: p.name,
      score: byPlayer.get(p.id)!.score,
      correctCount: byPlayer.get(p.id)!.correctCount,
    }))
    .sort(
      (a, b) =>
        b.score - a.score ||
        b.correctCount - a.correctCount ||
        a.name.localeCompare(b.name, "nb"),
    );
}
