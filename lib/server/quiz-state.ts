import "server-only";

// Assembles the per-role QUIZ view DTOs from authoritative rows. Parallel to
// lib/server/state.ts (bingo) but separate (spec §2). The correct answer index
// is withheld from board/player views while a question is open — it is only
// surfaced at phase 'reveal'/'ended', so a tampered client can't peek.

import {
  QuizBoardState,
  QuizHostState,
  QuizLeaderRow,
  QuizPlayerState,
} from "@/lib/dto";
import { GameRow, PlayerRow } from "@/lib/types";
import { QuizConfig, QuestionRow } from "@/lib/quiz-types";
import { leaderboard } from "@/lib/quiz-scoring";
import { listPlayers } from "@/lib/server/store";
import {
  getQuizState,
  listAnswers,
  listQuestions,
} from "@/lib/server/quiz-store";

function quizConfig(game: GameRow): QuizConfig {
  return game.config as QuizConfig;
}

function rosterOf(players: PlayerRow[]) {
  return players.map((p) => ({
    id: p.id,
    name: p.display_name,
    isHost: p.is_host,
    status: p.status,
  }));
}

/** Shared core: roster + leaderboard + cursor, loaded once. */
async function loadCore(game: GameRow) {
  const cfg = quizConfig(game);
  const [players, state, answers, questions] = await Promise.all([
    listPlayers(game.id),
    getQuizState(game.id),
    listAnswers(game.id),
    listQuestions(cfg.questionSetId),
  ]);
  const activePlayers = players.filter((p) => p.status === "active");
  const lb: QuizLeaderRow[] = leaderboard(
    activePlayers.map((p) => ({ id: p.id, name: p.display_name })),
    answers.map((a) => ({
      playerId: a.player_id,
      points: a.points,
      correct: a.correct,
    })),
  );
  const phase = state?.phase ?? "idle";
  const currentIndex = state?.current_index ?? -1;
  const openQuestion: QuestionRow | null =
    phase === "question" || phase === "reveal"
      ? (questions[currentIndex] ?? null)
      : null;
  const revealed = phase === "reveal" || phase === "ended";
  return {
    cfg,
    players,
    activePlayers,
    answers,
    questions,
    state,
    phase,
    currentIndex,
    openQuestion,
    revealed,
    leaderboard: lb,
  };
}

export async function buildQuizBoardState(
  game: GameRow,
): Promise<QuizBoardState> {
  const c = await loadCore(game);
  let question: QuizBoardState["question"] = null;
  if (c.openQuestion) {
    const forQ = c.answers.filter((a) => a.question_id === c.openQuestion!.id);
    const counts = [0, 0, 0, 0];
    for (const a of forQ) counts[a.choice] = (counts[a.choice] ?? 0) + 1;
    question = {
      prompt: c.openQuestion.prompt,
      options: c.openQuestion.options,
      answerCounts: counts,
      totalAnswers: forQ.length,
      correctIndex: c.revealed ? c.openQuestion.correct_index : null,
    };
  }
  return {
    gameType: "quiz",
    gameId: game.id,
    title: game.title,
    status: game.status,
    config: c.cfg,
    joinPin: game.join_pin,
    roster: rosterOf(c.players),
    phase: c.phase,
    questionNumber: c.currentIndex + 1,
    totalQuestions: c.questions.length,
    questionStartedAt:
      c.phase === "question" ? (c.state?.question_started_at ?? null) : null,
    leaderboard: c.leaderboard,
    question,
  };
}

export async function buildQuizPlayerState(
  game: GameRow,
  player: PlayerRow,
): Promise<QuizPlayerState> {
  const c = await loadCore(game);
  let question: QuizPlayerState["question"] = null;
  let myAnswer: QuizPlayerState["myAnswer"] = null;
  if (c.openQuestion) {
    question = {
      questionId: c.openQuestion.id,
      prompt: c.openQuestion.prompt,
      options: c.openQuestion.options,
      correctIndex: c.revealed ? c.openQuestion.correct_index : null,
    };
    const mine = c.answers.find(
      (a) => a.question_id === c.openQuestion!.id && a.player_id === player.id,
    );
    if (mine) {
      myAnswer = {
        choice: mine.choice,
        // hide correctness until reveal so a tapped tile doesn't leak the key
        correct: c.revealed ? mine.correct : false,
        points: c.revealed ? mine.points : 0,
      };
    }
  }
  const myScore = c.leaderboard.find((l) => l.playerId === player.id)?.score ?? 0;
  return {
    gameType: "quiz",
    gameId: game.id,
    title: game.title,
    status: game.status,
    config: c.cfg,
    roster: rosterOf(c.players),
    phase: c.phase,
    questionNumber: c.currentIndex + 1,
    totalQuestions: c.questions.length,
    questionStartedAt:
      c.phase === "question" ? (c.state?.question_started_at ?? null) : null,
    leaderboard: c.leaderboard,
    playerId: player.id,
    question,
    myAnswer,
    myScore,
  };
}

export async function buildQuizHostState(game: GameRow): Promise<QuizHostState> {
  const base = await buildQuizBoardState(game);
  const c = await loadCore(game);
  const answeredCount = c.openQuestion
    ? c.answers.filter((a) => a.question_id === c.openQuestion!.id).length
    : 0;
  return {
    ...base,
    answeredCount,
    activeCount: c.activePlayers.length,
  };
}
