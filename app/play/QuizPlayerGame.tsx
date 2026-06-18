"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/client/api";
import { StoredPlayer } from "@/lib/client/identity";
import { useGameState } from "@/lib/client/useGameState";
import { usePresence } from "@/lib/client/usePresence";
import { QuizPlayerState } from "@/lib/dto";
import { no } from "@/lib/locale/no";
import { Confetti } from "@/app/components/Confetti";

const t = no.quiz;

// Same answer-tile colours/shapes as the board, by option index.
const TILE = [
  { bg: "#d9434e", glyph: "▲" },
  { bg: "#2b7cd3", glyph: "◆" },
  { bg: "#e0a92e", glyph: "●" },
  { bg: "#2e9e6b", glyph: "■" },
];

function errorText(code: string): string {
  return (t.errors as Record<string, string>)[code] ?? t.errors.generic;
}

export function QuizPlayerGame({
  player,
  onSessionLost,
}: {
  player: StoredPlayer;
  onSessionLost: () => void;
}) {
  const [toast, setToast] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const lostRef = useRef(onSessionLost);
  useEffect(() => {
    lostRef.current = onSessionLost;
  });

  const showToast = useCallback((text: string) => {
    setToast(text);
    window.setTimeout(() => setToast(null), 3000);
  }, []);

  const fetcher = useCallback(async () => {
    try {
      return await api.quizPlayerState(
        player.gameId,
        player.playerId,
        player.resumeCode,
      );
    } catch (err) {
      if ((err as Error).message === "forbidden") {
        lostRef.current();
        return null;
      }
      throw err;
    }
  }, [player.gameId, player.playerId, player.resumeCode]);

  const { state, refetch } = useGameState<QuizPlayerState>(
    player.gameId,
    fetcher,
  );

  usePresence(player.gameId, {
    playerId: player.playerId,
    name:
      player.displayName ||
      (state?.roster.find((r) => r.id === player.playerId)?.name ?? ""),
    isHost: false,
  });

  const answer = async (choice: number) => {
    if (!state?.question || busy) return;
    setBusy(true);
    try {
      await api.quizAnswer({
        gameId: player.gameId,
        playerId: player.playerId,
        code: player.resumeCode,
        questionId: state.question.questionId,
        choice,
      });
    } catch (err) {
      showToast(errorText((err as Error).message));
    } finally {
      setBusy(false);
      void refetch();
    }
  };

  if (!state) {
    return (
      <main className="center-screen">
        <p className="muted">{no.common.loading}</p>
      </main>
    );
  }

  return (
    <main style={{ padding: "20px 14px 60px", maxWidth: 560, margin: "0 auto" }}>
      <header className="spread" style={{ marginBottom: 16 }}>
        <span className="brandmark" style={{ fontSize: 18 }}>
          <span className="glyph">▦</span>Sunday<b>Quiz</b>
        </span>
        <span className="badge">{t.yourScore(state.myScore)}</span>
      </header>

      {state.phase === "idle" && <Waiting heading={no.lobby.youAreIn} lead={t.waitForStart} state={state} />}
      {state.phase === "question" && (
        <QuestionView state={state} busy={busy} onAnswer={answer} />
      )}
      {state.phase === "reveal" && <RevealView state={state} />}
      {state.phase === "ended" && <Finished state={state} />}

      {toast && <div className="toast">{toast}</div>}
    </main>
  );
}

function Waiting({
  heading,
  lead,
  state,
}: {
  heading: string;
  lead: string;
  state: QuizPlayerState;
}) {
  const active = state.roster.filter((r) => r.status === "active");
  return (
    <div className="card stack text-center">
      <h1 style={{ fontSize: 30 }}>{heading}</h1>
      <p className="muted">{lead}</p>
      <p className="faint" style={{ fontSize: 14 }}>{no.lobby.playerCount(active.length)}</p>
    </div>
  );
}

function QuestionView({
  state,
  busy,
  onAnswer,
}: {
  state: QuizPlayerState;
  busy: boolean;
  onAnswer: (choice: number) => void;
}) {
  const q = state.question;
  if (!q) return <p className="muted">{no.common.loading}</p>;
  const locked = state.myAnswer !== null;
  return (
    <div className="stack" style={{ gap: 14 }}>
      <p className="eyebrow text-center">
        {t.questionOf(state.questionNumber, state.totalQuestions)}
      </p>
      <h1 style={{ fontSize: 22, textAlign: "center" }}>{q.prompt}</h1>
      {locked ? (
        <div className="card stack text-center" style={{ gap: 6 }}>
          <p style={{ fontWeight: 700, fontSize: 18 }}>{t.locked}</p>
          <p className="muted">
            {t.youPicked}: <b>{q.options[state.myAnswer!.choice]}</b>
          </p>
          <p className="faint">{t.betweenLead}</p>
        </div>
      ) : (
        <p className="muted text-center">{t.tapAnswer}</p>
      )}
      <div className="quiz-answer-grid">
        {q.options.map((opt, i) => (
          <button
            key={i}
            className="quiz-answer"
            style={{ background: TILE[i].bg, opacity: locked ? 0.45 : 1 }}
            disabled={locked || busy}
            onClick={() => onAnswer(i)}
            aria-label={opt}
          >
            <span className="quiz-glyph">{TILE[i].glyph}</span>
            <span>{opt}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function RevealView({ state }: { state: QuizPlayerState }) {
  const q = state.question;
  const mine = state.myAnswer;
  const correct = mine?.correct ?? false;
  return (
    <div className="stack" style={{ gap: 14 }}>
      {correct && <Confetti count={70} />}
      <p className="eyebrow text-center">
        {t.questionOf(state.questionNumber, state.totalQuestions)}
      </p>
      <div
        className={`card stack text-center ${correct ? "" : ""}`}
        style={{ gap: 8 }}
      >
        <p style={{ fontSize: 26, fontWeight: 800, color: correct ? "var(--ok)" : "var(--warn)" }}>
          {mine ? (correct ? t.correct : t.wrong) : t.wrong}
        </p>
        {q && q.correctIndex !== null && (
          <p className="muted">
            {t.correctAnswer}: <b>{q.options[q.correctIndex]}</b>
          </p>
        )}
        {correct && mine && mine.points > 0 && (
          <p style={{ fontWeight: 700, color: "var(--gold)" }}>{t.plusPoints(mine.points)}</p>
        )}
      </div>
      <MiniBoard state={state} />
    </div>
  );
}

function MiniBoard({ state }: { state: QuizPlayerState }) {
  return (
    <div className="card stack" style={{ gap: 8 }}>
      <p className="eyebrow">{t.leaderboard}</p>
      {state.leaderboard.slice(0, 5).map((r, i) => (
        <div
          key={r.playerId}
          className="spread"
          style={{ fontWeight: r.playerId === state.playerId ? 800 : 500 }}
        >
          <span className="row" style={{ gap: 8 }}>
            <span className={`rankpill ${i === 0 ? "r1" : ""}`}>{i + 1}</span>
            {r.name}
          </span>
          <span className="faint">{t.yourScore(r.score)}</span>
        </div>
      ))}
    </div>
  );
}

function Finished({ state }: { state: QuizPlayerState }) {
  const me = state.leaderboard.find((r) => r.playerId === state.playerId);
  const rank = state.leaderboard.findIndex((r) => r.playerId === state.playerId) + 1;
  return (
    <div className="stack" style={{ gap: 14 }}>
      {rank === 1 && me && me.score > 0 && <Confetti count={100} />}
      <div className="card stack text-center">
        <h1 style={{ fontSize: 28 }}>{t.finishedHeading}</h1>
        {me && (
          <p className="banner banner-info">
            {rank}. plass — {t.yourScore(me.score)}
          </p>
        )}
      </div>
      <MiniBoard state={state} />
    </div>
  );
}
