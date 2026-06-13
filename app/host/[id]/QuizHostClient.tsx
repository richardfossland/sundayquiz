"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/client/api";
import { identity } from "@/lib/client/identity";
import { useGameState } from "@/lib/client/useGameState";
import { QuizHostState } from "@/lib/dto";
import { normalizeResumeCode } from "@/lib/codes";
import { no } from "@/lib/locale/no";

const t = no.quiz;

export function QuizHostClient({ gameId }: { gameId: string }) {
  const [hostCode, setHostCode] = useState<string | null>(null);
  const [codeInput, setCodeInput] = useState("");
  const [codeError, setCodeError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [checkedStorage, setCheckedStorage] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHostCode(identity.hostCode(gameId));
    setCheckedStorage(true);
  }, [gameId]);

  const fetcher = useCallback(async () => {
    if (!hostCode) return null;
    try {
      return await api.quizHostState(gameId, hostCode);
    } catch (err) {
      if ((err as Error).message === "forbidden") {
        setHostCode(null);
        return null;
      }
      throw err;
    }
  }, [gameId, hostCode]);

  const { state, refetch } = useGameState<QuizHostState>(
    hostCode ? gameId : null,
    hostCode ? fetcher : null,
  );

  const advance = async (action: "next" | "reveal" | "end") => {
    if (!hostCode) return;
    if (action === "end" && !window.confirm(no.host.endConfirm)) return;
    setBusy(true);
    try {
      await api.quizAdvance(gameId, hostCode, action);
    } catch (err) {
      window.alert((err as Error).message);
    } finally {
      setBusy(false);
      void refetch();
    }
  };

  if (!checkedStorage) {
    return (
      <main className="center-screen">
        <p className="muted">{no.common.loading}</p>
      </main>
    );
  }

  if (!hostCode) {
    return (
      <main className="center-screen">
        <form
          className="card card-narrow stack"
          onSubmit={async (e) => {
            e.preventDefault();
            const code = normalizeResumeCode(codeInput);
            try {
              const res = await api.resume(code, { gameId });
              if (res.role !== "host") throw new Error("invalid_code");
              identity.saveHostCode(gameId, code);
              setHostCode(code);
            } catch {
              setCodeError(no.join.errors.invalid_code);
            }
          }}
        >
          <h1 style={{ fontSize: 26 }}>{no.host.hostCodeTitle}</h1>
          <div className="field">
            <label htmlFor="hcode">{no.host.hostCodeTitle}</label>
            <input
              id="hcode"
              className="input mono"
              placeholder="XXXX-00"
              maxLength={8}
              value={codeInput}
              onChange={(e) => setCodeInput(e.target.value.toUpperCase())}
              autoFocus
            />
          </div>
          {codeError && <div className="banner banner-error">{codeError}</div>}
          <button className="btn btn-primary btn-block" type="submit">
            {no.common.confirm}
          </button>
        </form>
      </main>
    );
  }

  if (!state) {
    return (
      <main className="center-screen">
        <p className="muted">{no.common.loading}</p>
      </main>
    );
  }

  const active = state.roster.filter((r) => r.status === "active");
  const phase = state.phase;
  const isLast = state.questionNumber >= state.totalQuestions;

  return (
    <main style={{ padding: "20px 16px 80px", maxWidth: 680, margin: "0 auto" }}>
      <header className="spread" style={{ marginBottom: 18 }}>
        <span className="brandmark" style={{ fontSize: 18 }}>
          <span className="glyph">▦</span>Sunday<b>Quiz</b>
        </span>
        <span className={`badge ${state.status === "live" ? "badge-live" : ""}`}>
          {state.status === "live"
            ? no.common.live
            : state.status === "lobby"
              ? no.common.lobby
              : no.common.finished}
        </span>
      </header>

      <div className="stack">
        <div className="card stack">
          <div className="spread">
            <h1 style={{ fontSize: 24 }}>{no.host.title}</h1>
            <span className="mono" style={{ color: "var(--gold)", fontSize: 22, fontWeight: 700 }}>
              {state.joinPin}
            </span>
          </div>
          <Link href={`/board/${gameId}`} target="_blank" className="btn">
            {no.host.showBoard}
          </Link>

          {phase !== "ended" && state.status !== "finished" && (
            <div className="stack" style={{ gap: 10 }}>
              {phase === "question" ? (
                <>
                  <p className="muted">
                    {t.answered(state.answeredCount, state.activeCount)} ·{" "}
                    {t.questionOf(state.questionNumber, state.totalQuestions)}
                  </p>
                  <button className="btn btn-primary btn-lg" disabled={busy} onClick={() => advance("reveal")}>
                    {t.reveal}
                  </button>
                </>
              ) : (
                <button className="btn btn-primary btn-lg" disabled={busy} onClick={() => advance("next")}>
                  {phase === "idle" ? t.firstQuestion : isLast ? t.end : t.nextQuestion}
                </button>
              )}
              <button className="btn btn-danger" disabled={busy} onClick={() => advance("end")}>
                {t.end}
              </button>
              {phase === "idle" && <p className="faint" style={{ fontSize: 13 }}>{t.waitingFirst}</p>}
            </div>
          )}
        </div>

        {state.leaderboard.length > 0 && (
          <div className="card stack" style={{ gap: 8 }}>
            <p className="eyebrow">{t.leaderboard}</p>
            {state.leaderboard.slice(0, 8).map((r, i) => (
              <div key={r.playerId} className="spread">
                <span className="row" style={{ gap: 10 }}>
                  <span className={`rankpill ${i === 0 ? "r1" : ""}`}>{i + 1}</span>
                  <span style={{ fontWeight: 600 }}>{r.name}</span>
                </span>
                <span className="faint" style={{ fontVariantNumeric: "tabular-nums" }}>
                  {t.yourScore(r.score)}
                </span>
              </div>
            ))}
          </div>
        )}

        <div className="card stack">
          <p className="eyebrow">{no.host.players} ({active.length})</p>
          <div className="stack" style={{ gap: 8 }}>
            {active.map((p) => (
              <div key={p.id} className="spread">
                <span className="row" style={{ gap: 10 }}>
                  <span className="avatar">{p.name.slice(0, 1).toUpperCase()}</span>
                  <span style={{ fontWeight: 600 }}>
                    {p.name}
                    {p.isHost && <span className="faint"> (vert)</span>}
                  </span>
                </span>
                {state.status !== "finished" && (
                  <button
                    className="btn btn-ghost"
                    style={{ padding: "6px 14px", fontSize: 13 }}
                    onClick={async () => {
                      if (!window.confirm(no.host.kickConfirm(p.name))) return;
                      await api.kickPlayer(gameId, hostCode, p.id);
                      void refetch();
                    }}
                  >
                    {no.host.kick}
                  </button>
                )}
              </div>
            ))}
            {active.length === 0 && <p className="faint">{no.lobby.waitingForPlayers}</p>}
          </div>
        </div>

        <div className="card stack" style={{ gap: 8 }}>
          <p className="eyebrow">{no.host.hostCodeTitle}</p>
          <p className="mono" style={{ fontSize: 22, fontWeight: 700, color: "var(--gold)" }}>
            {hostCode}
          </p>
          <p className="faint" style={{ fontSize: 13.5 }}>{no.host.hostCodeLead}</p>
        </div>
      </div>
    </main>
  );
}
