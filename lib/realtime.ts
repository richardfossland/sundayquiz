// Realtime channel + event names. Shared by client (subscribe) and server
// (broadcast). One channel per game carries both broadcast events and
// presence; payloads are hints to refetch authoritative state, never the
// source of truth. Targeted events carry targetPlayerId and are filtered
// client-side — payloads hold only names/statement text already visible in
// the room (spec §0.10); resume codes never ride a broadcast.

export const channels = {
  game: (gameId: string) => `quiz:${gameId}`,
};

export const events = {
  /** Game lifecycle changed (lobby→live→finished) → refetch + reroute. */
  status: "status",
  /** A player joined/left/kicked → refetch roster. */
  roster: "roster",
  /** New pending mark for {targetPlayerId} (the verifier) → refetch incoming. */
  markPending: "mark_pending",
  /** A mark resolved (confirmed/rejected/expired) → claimer updates cell,
   * board screen refetches ticker/progress. */
  markResolved: "mark_resolved",
  /** A board hit the win condition → full-screen moment + toasts. */
  bingo: "bingo",

  // ---------- quiz mode ----------
  /** The host advanced the quiz (opened a question, revealed, or ended) →
   * everyone refetches state and reroutes their UI. */
  quizAdvance: "quiz_advance",
  /** A player submitted an answer → board/host refetch the live count bar. */
  quizAnswer: "quiz_answer",
} as const;
