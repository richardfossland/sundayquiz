// Quiz-mode domain types. The platform shell (games/players/lifecycle) is
// generic (spec §2); these types are NET-NEW in-mode state for the live-quiz
// live Q&A game_type, and share NOTHING with bingo's in-game logic.

export type PointsMode = "speed" | "flat";

export interface QuizConfig {
  questionSetId: string;
  /** Seconds a question stays open before the host can reveal/advance. */
  perQuestionSeconds: number;
  /** 'speed' = faster correct answers score more; 'flat' = fixed points. */
  pointsMode: PointsMode;
}

export const DEFAULT_QUIZ_CONFIG: Omit<QuizConfig, "questionSetId"> = {
  perQuestionSeconds: 20,
  pointsMode: "speed",
};

/** Max points a single question can award (per-question ceiling). */
export const MAX_QUESTION_POINTS = 1000;
/** Floor for a correct speed answer right at the buzzer (never below this). */
export const MIN_SPEED_POINTS = 100;

// A quiz question carries 4 answer options; exactly one is correct.
export interface QuestionRow {
  id: string;
  set_id: string;
  prompt: string;
  /** 4 answer texts, index 0..3 → colour/shape on the board. */
  options: string[];
  correct_index: number;
  sort_order: number;
}

export interface QuestionSetRow {
  id: string;
  title: string;
  audience: "kirke" | "skole" | "generell";
  is_builtin: boolean;
  game_id: string | null;
}

// ---------- live quiz state (one row per game, mirrors the bingo board idea
// but for the single shared question stream the host advances) ----------

export type QuizPhase = "idle" | "question" | "reveal" | "ended";

export interface QuizStateRow {
  id: string;
  game_id: string;
  /** 0-based index into the ordered question list; -1 before the first. */
  current_index: number;
  phase: QuizPhase;
  /** When the current question opened (drives the speed score + countdown). */
  question_started_at: string | null;
}

export interface AnswerRow {
  id: string;
  game_id: string;
  question_id: string;
  player_id: string;
  /** 0..3 chosen option index. */
  choice: number;
  correct: boolean;
  points: number;
  answered_at: string;
}
