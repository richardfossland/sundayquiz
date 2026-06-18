"use client";

import { useCallback, useEffect, useState } from "react";
import QRCode from "qrcode";
import { api } from "@/lib/client/api";
import { useGameState } from "@/lib/client/useGameState";
import { usePresence } from "@/lib/client/usePresence";
import { QuizBoardState } from "@/lib/dto";
import { no } from "@/lib/locale/no";
import { Confetti } from "@/app/components/Confetti";

const t = no.quiz;

// The four answer-tile colours/shapes, by option index.
const TILE = [
  { bg: "#d9434e", glyph: "▲" },
  { bg: "#2b7cd3", glyph: "◆" },
  { bg: "#e0a92e", glyph: "●" },
  { bg: "#2e9e6b", glyph: "■" },
];

function computeLeft(startedAt: string | null, seconds: number): number | null {
  if (!startedAt) return null;
  const elapsed = (Date.now() - Date.parse(startedAt)) / 1000;
  return Math.max(0, Math.ceil(seconds - elapsed));
}

function useCountdown(startedAt: string | null, seconds: number) {
  // Seed from the current time so the first paint is correct without a
  // synchronous setState inside the effect (cascading-render lint).
  const [left, setLeft] = useState<number | null>(() =>
    computeLeft(startedAt, seconds),
  );
  useEffect(() => {
    if (!startedAt) return;
    const id = window.setInterval(
      () => setLeft(computeLeft(startedAt, seconds)),
      250,
    );
    return () => window.clearInterval(id);
  }, [startedAt, seconds]);
  return left;
}

export function QuizBoardClient({ gameId }: { gameId: string }) {
  const fetcher = useCallback(() => api.quizBoardState(gameId), [gameId]);
  const { state } = useGameState<QuizBoardState>(gameId, fetcher);
  usePresence(gameId, null);

  if (!state) {
    return (
      <main className="center-screen">
        <p className="muted">{no.common.loading}</p>
      </main>
    );
  }

  return (
    <main className="board-screen">
      <header className="spread">
        <span className="brandmark">
          <span className="glyph">▦</span>Sunday<b>Quiz</b>
          {state.title && (
            <span
              className="muted"
              style={{ fontFamily: "var(--body)", fontWeight: 500, fontSize: 17 }}
            >
              — {state.title}
            </span>
          )}
        </span>
        <span className={`badge ${state.status === "live" ? "badge-live" : ""}`}>
          {state.status === "live"
            ? no.common.live
            : state.status === "lobby"
              ? no.common.lobby
              : no.common.finished}
        </span>
      </header>

      {state.phase === "idle" && <Lobby state={state} />}
      {state.phase === "question" && <Question state={state} />}
      {state.phase === "reveal" && <Reveal state={state} />}
      {state.phase === "ended" && <Finished state={state} />}
    </main>
  );
}

function Lobby({ state }: { state: QuizBoardState }) {
  const [qr, setQr] = useState<string | null>(null);
  const joinUrl =
    (process.env.NEXT_PUBLIC_BASE_URL ??
      (typeof window !== "undefined" ? window.location.origin : "")) + "/play";
  useEffect(() => {
    QRCode.toDataURL(joinUrl, {
      width: 280,
      margin: 1,
      color: { dark: "#11141b", light: "#faf7f0" },
    })
      .then(setQr)
      .catch(() => setQr(null));
  }, [joinUrl]);
  const active = state.roster.filter((r) => r.status === "active");
  return (
    <div className="stack grow" style={{ justifyContent: "center", textAlign: "center", gap: 26 }}>
      <h1 style={{ fontSize: "clamp(30px, 4.5vw, 52px)" }}>{t.lobbyHeading}</h1>
      <div className="row" style={{ justifyContent: "center", gap: 44, flexWrap: "wrap" }}>
        <div className="stack" style={{ gap: 8 }}>
          <p className="eyebrow">{no.lobby.joinAt}</p>
          <p style={{ fontSize: 24, fontWeight: 700 }}>{joinUrl.replace(/^https?:\/\//, "")}</p>
          <p className="eyebrow" style={{ marginTop: 12 }}>{no.lobby.withPin}</p>
          <div className="pin-hero">{state.joinPin}</div>
        </div>
        {qr && (
          <div style={{ background: "var(--paper)", borderRadius: 18, padding: 14, boxShadow: "var(--shadow-2)" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qr} alt={no.board.scanQr} width={240} height={240} />
          </div>
        )}
      </div>
      <div className="stack" style={{ gap: 12 }}>
        <p className="muted">
          {active.length === 0
            ? no.lobby.waitingForPlayers
            : no.lobby.playerCount(active.length)}
        </p>
        <div className="chips" style={{ maxWidth: 900, margin: "0 auto" }}>
          {active.map((r) => (
            <span key={r.id} className="chip">
              <span className="avatar">{r.name.slice(0, 1).toUpperCase()}</span>
              {r.name}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function Question({ state }: { state: QuizBoardState }) {
  const q = state.question;
  const left = useCountdown(state.questionStartedAt, state.config.perQuestionSeconds);
  if (!q) return <p className="muted">{no.common.loading}</p>;
  const maxCount = Math.max(1, ...q.answerCounts);
  return (
    <div className="stack grow" style={{ gap: 18 }}>
      <div className="spread">
        <span className="eyebrow">{t.questionOf(state.questionNumber, state.totalQuestions)}</span>
        <span className="quiz-timer" aria-live="polite">
          {left === null ? "" : left <= 0 ? t.timesUp : t.timeLeft(left)}
        </span>
      </div>
      <h1 style={{ fontSize: "clamp(26px, 3.6vw, 46px)", textAlign: "center", margin: "10px 0 6px" }}>
        {q.prompt}
      </h1>
      <p className="muted text-center">{t.countAnswers(q.totalAnswers)}</p>
      <div className="quiz-tiles">
        {q.options.map((opt, i) => (
          <div key={i} className="quiz-tile" style={{ background: TILE[i].bg }}>
            <span className="quiz-glyph">{TILE[i].glyph}</span>
            <span className="quiz-opt">{opt}</span>
            <span
              className="quiz-bar"
              style={{ width: `${(q.answerCounts[i] / maxCount) * 100}%` }}
            />
            <span className="quiz-count">{q.answerCounts[i]}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Reveal({ state }: { state: QuizBoardState }) {
  const q = state.question;
  if (!q) return <Leaderboard state={state} heading={t.leaderboard} />;
  const maxCount = Math.max(1, ...q.answerCounts);
  return (
    <div className="stack grow" style={{ gap: 18 }}>
      <span className="eyebrow">{t.questionOf(state.questionNumber, state.totalQuestions)}</span>
      <h1 style={{ fontSize: "clamp(24px, 3vw, 40px)", textAlign: "center" }}>{q.prompt}</h1>
      <div className="quiz-tiles">
        {q.options.map((opt, i) => {
          const isCorrect = q.correctIndex === i;
          return (
            <div
              key={i}
              className={`quiz-tile ${isCorrect ? "correct" : "dim"}`}
              style={{ background: isCorrect ? TILE[i].bg : "#3a3f4b" }}
            >
              <span className="quiz-glyph">{TILE[i].glyph}</span>
              <span className="quiz-opt">{opt}</span>
              {isCorrect && <span className="quiz-check">✓</span>}
              <span className="quiz-bar" style={{ width: `${(q.answerCounts[i] / maxCount) * 100}%` }} />
              <span className="quiz-count">{q.answerCounts[i]}</span>
            </div>
          );
        })}
      </div>
      <Leaderboard state={state} heading={t.leaderboard} compact />
    </div>
  );
}

function Leaderboard({
  state,
  heading,
  compact,
}: {
  state: QuizBoardState;
  heading: string;
  compact?: boolean;
}) {
  const rows = state.leaderboard.slice(0, compact ? 5 : 10);
  return (
    <section className="card stack" style={{ gap: 10 }}>
      <p className="eyebrow">{heading}</p>
      {rows.length === 0 && <p className="faint">{no.lobby.waitingForPlayers}</p>}
      {rows.map((r, i) => (
        <div key={r.playerId} className="row">
          <span className={`rankpill ${i === 0 ? "r1" : ""}`}>{i + 1}</span>
          <span style={{ fontWeight: 700, fontSize: 19 }}>{r.name}</span>
          <span className="faint" style={{ marginLeft: "auto", fontVariantNumeric: "tabular-nums" }}>
            {t.yourScore(r.score)}
          </span>
        </div>
      ))}
    </section>
  );
}

function Finished({ state }: { state: QuizBoardState }) {
  const winner = state.leaderboard[0];
  return (
    <div className="stack grow" style={{ gap: 24 }}>
      {winner && winner.score > 0 && <Confetti count={140} />}
      <h1 className="text-center" style={{ fontSize: "clamp(30px, 4.5vw, 52px)" }}>
        {t.finishedHeading}
      </h1>
      {winner && winner.score > 0 && (
        <div className="text-center stack" style={{ gap: 4 }}>
          <p className="eyebrow">{t.winner}</p>
          <p style={{ fontSize: "clamp(26px, 3.4vw, 44px)", fontWeight: 800, color: "var(--gold)" }}>
            {winner.name}
          </p>
          <p className="muted">{t.yourScore(winner.score)}</p>
        </div>
      )}
      <Leaderboard state={state} heading={t.leaderboard} />
    </div>
  );
}
