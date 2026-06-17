// Public view shapes returned by the state endpoint, per role. Resume codes
// and host codes never appear in any DTO — they are bearer tokens that travel
// only in request bodies.

import { BingoConfig, GameStatus, MarkStatus } from "./types";
import { QuizConfig, QuizPhase } from "./quiz-types";

export interface RosterEntry {
  id: string;
  name: string;
  isHost: boolean;
  status: "active" | "left" | "kicked";
}

export interface CellView {
  index: number;
  text: string;
  free: boolean;
  mark: {
    status: Extract<MarkStatus, "pending" | "confirmed">;
    verifierId: string;
    verifierName: string;
  } | null;
}

export interface PendingPrompt {
  markId: string;
  claimerId: string;
  claimerName: string;
  statementText: string;
  createdAt: string;
}

export interface TickerItem {
  claimerName: string;
  verifierName: string;
  statementText: string;
  at: string;
}

export interface PodiumEntry {
  playerId: string;
  name: string;
  rank: number;
  at: string;
  secondsFromStart: number | null;
}

export interface Finale {
  players: { id: string; name: string; degree: number }[];
  edges: { claimerId: string; verifierId: string; statementText: string }[];
  podium: PodiumEntry[];
  totals: {
    confirmedMarks: number;
    uniquePairs: number;
    playersConnected: number;
  };
}

interface StateBase {
  gameId: string;
  title: string;
  status: GameStatus;
  config: BingoConfig;
  roster: RosterEntry[];
}

export interface BoardState extends StateBase {
  joinPin: string;
  progress: { confirmed: number; totalCells: number };
  ticker: TickerItem[];
  podium: PodiumEntry[];
  finale: Finale | null;
}

export interface PlayerState extends StateBase {
  playerId: string;
  board: {
    cells: CellView[];
    bingoAt: string | null;
    bingoRank: number | null;
  } | null; // null while in lobby
  incoming: PendingPrompt[]; // oldest first — client shows one at a time
  outgoing: {
    markId: string;
    cellIndex: number;
    verifierId: string;
    verifierName: string;
  } | null;
  podium: PodiumEntry[];
}

export interface HostState extends BoardState {
  pendingMarks: {
    markId: string;
    claimerName: string;
    verifierName: string;
    statementText: string;
    ageSec: number;
  }[];
}

// ---------- quiz mode view shapes (parallel to the bingo DTOs above; share
// nothing with the marking surfaces, spec §2) ----------

export interface QuizLeaderRow {
  playerId: string;
  name: string;
  score: number;
  correctCount: number;
}

interface QuizStateBase {
  gameId: string;
  title: string;
  status: GameStatus;
  config: QuizConfig;
  roster: RosterEntry[];
  gameType: "quiz";
  phase: QuizPhase;
  questionNumber: number; // 1-based for display (0 before the first)
  totalQuestions: number;
  /** Server time when the open question started (drives the client countdown);
   * null unless phase === 'question'. */
  questionStartedAt: string | null;
  leaderboard: QuizLeaderRow[];
}

/** The big screen: shows the question + 4 options + live answer counts, or a
 * between-questions leaderboard. Never leaks the correct index while a question
 * is open (only at 'reveal'/'ended'). */
export interface QuizBoardState extends QuizStateBase {
  joinPin: string;
  question: {
    prompt: string;
    options: string[];
    /** Number of submitted answers per option index (live bar). */
    answerCounts: number[];
    totalAnswers: number;
    /** Revealed only when phase is 'reveal' or 'ended'. */
    correctIndex: number | null;
  } | null;
}

/** A participant's phone: the 4 tappable tiles + whether they've locked in. */
export interface QuizPlayerState extends QuizStateBase {
  playerId: string;
  question: {
    questionId: string;
    prompt: string;
    options: string[];
    correctIndex: number | null; // revealed only at reveal/ended
  } | null;
  /** This player's locked-in choice for the open question, if any. */
  myAnswer: { choice: number; correct: boolean; points: number } | null;
  myScore: number;
}

/** Host phone: board view + per-option counts + how many have answered. */
export interface QuizHostState extends QuizBoardState {
  answeredCount: number;
  activeCount: number;
}

export interface StatementSetSummary {
  id: string;
  title: string;
  audience: "kirke" | "skole" | "generell";
  isBuiltin: boolean;
  statementCount: number;
}

export interface StatementSetDetail {
  id: string;
  title: string;
  audience: "kirke" | "skole" | "generell";
  isBuiltin: boolean;
  statements: { id: string; text: string }[];
}

export interface QuestionSetSummary {
  id: string;
  title: string;
  audience: "kirke" | "skole" | "generell";
  isBuiltin: boolean;
  questionCount: number;
}

export interface QuestionSetDetail {
  id: string;
  title: string;
  audience: "kirke" | "skole" | "generell";
  isBuiltin: boolean;
  questions: {
    id: string;
    prompt: string;
    options: string[];
    correctIndex: number;
  }[];
}
