"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/client/api";
import { identity } from "@/lib/client/identity";
import { useGameState } from "@/lib/client/useGameState";
import { HostState } from "@/lib/dto";
import { normalizeResumeCode } from "@/lib/codes";
import { no } from "@/lib/locale/no";

const t = no.host;

export function HostClient({ gameId }: { gameId: string }) {
  const [hostCode, setHostCode] = useState<string | null>(null);
  const [codeInput, setCodeInput] = useState("");
  const [codeError, setCodeError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [playAlong, setPlayAlong] = useState(false);
  const [playName, setPlayName] = useState("");
  const [checkedStorage, setCheckedStorage] = useState(false);

  useEffect(() => {
    // One-time mount init from localStorage — not a cascading-render risk.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHostCode(identity.hostCode(gameId));
    setCheckedStorage(true);
  }, [gameId]);

  const fetcher = useCallback(async () => {
    if (!hostCode) return null;
    try {
      return await api.hostState(gameId, hostCode);
    } catch (err) {
      if ((err as Error).message === "forbidden") {
        setHostCode(null);
        return null;
      }
      throw err;
    }
  }, [gameId, hostCode]);

  const { state, refetch } = useGameState<HostState>(
    hostCode ? gameId : null,
    hostCode ? fetcher : null,
  );

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
          <h1 style={{ fontSize: 26 }}>{t.hostCodeTitle}</h1>
          <div className="field">
            <label htmlFor="hcode">{t.hostCodeTitle}</label>
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

  const activePlayers = state.roster.filter((r) => r.status === "active");

  const start = async () => {
    if (!window.confirm(t.startConfirm)) return;
    setBusy(true);
    try {
      const res = await api.startGame(
        gameId,
        hostCode,
        playAlong && playName.trim() ? { displayName: playName.trim() } : undefined,
      );
      if (res.playerId && res.resumeCode) {
        identity.savePlayer({
          gameId,
          playerId: res.playerId,
          resumeCode: res.resumeCode,
          displayName: playName.trim(),
        });
      }
    } catch (err) {
      window.alert((err as Error).message);
    } finally {
      setBusy(false);
      void refetch();
    }
  };

  const end = async () => {
    if (!window.confirm(t.endConfirm)) return;
    setBusy(true);
    try {
      await api.endGame(gameId, hostCode);
    } finally {
      setBusy(false);
      void refetch();
    }
  };

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
            <h1 style={{ fontSize: 24 }}>{t.title}</h1>
            <span className="mono" style={{ color: "var(--gold)", fontSize: 22, fontWeight: 700 }}>
              {state.joinPin}
            </span>
          </div>
          <div className="row" style={{ flexWrap: "wrap" }}>
            <Link href={`/board/${gameId}`} target="_blank" className="btn">
              {t.showBoard}
            </Link>
            {state.status === "lobby" && (
              <button className="btn btn-primary" disabled={busy} onClick={start}>
                {t.start}
              </button>
            )}
            {state.status === "live" && (
              <button className="btn btn-danger" disabled={busy} onClick={end}>
                {t.end}
              </button>
            )}
          </div>

          {state.status === "lobby" && (
            <div className="stack" style={{ gap: 8 }}>
              <label className="row" style={{ cursor: "pointer", fontSize: 15 }}>
                <input
                  type="checkbox"
                  checked={playAlong}
                  onChange={(e) => setPlayAlong(e.target.checked)}
                  style={{ width: 18, height: 18, accentColor: "var(--gold)" }}
                />
                {t.playAlong}
              </label>
              {playAlong && (
                <>
                  <input
                    className="input"
                    placeholder={no.join.namePlaceholder}
                    maxLength={40}
                    value={playName}
                    onChange={(e) => setPlayName(e.target.value)}
                  />
                  <p className="faint" style={{ fontSize: 13 }}>{t.playAlongHint}</p>
                </>
              )}
            </div>
          )}

          {state.status === "live" && (
            <div className="row" style={{ gap: 22 }}>
              <span className="muted" style={{ fontSize: 14.5 }}>
                <b style={{ color: "var(--txt)" }}>{state.progress.confirmed}</b>{" "}
                {t.marksCount}
              </span>
              <span className="muted" style={{ fontSize: 14.5 }}>
                <b style={{ color: "var(--txt)" }}>{state.podium.length}</b> {t.bingos}
              </span>
            </div>
          )}
          {identity.player()?.gameId === gameId && state.status !== "finished" && (
            <Link href="/play" className="btn btn-ghost">
              {t.yourCode}: {identity.player()?.resumeCode} → spill
            </Link>
          )}
        </div>

        {state.status === "live" && state.pendingMarks.length > 0 && (
          <div className="card stack">
            <p className="eyebrow">{t.pending}</p>
            {state.pendingMarks.map((m) => (
              <div key={m.markId} className="spread" style={{ fontSize: 14.5 }}>
                <span className="muted">
                  <b style={{ color: "var(--txt)" }}>{m.claimerName}</b> →{" "}
                  <b style={{ color: "var(--txt)" }}>{m.verifierName}</b> — {m.statementText}{" "}
                  <span className="faint">({m.ageSec}s)</span>
                </span>
                <button
                  className="btn btn-ghost"
                  style={{ padding: "6px 14px", fontSize: 13 }}
                  onClick={async () => {
                    await api.expireMark(gameId, hostCode, m.markId);
                    void refetch();
                  }}
                >
                  {t.forceExpire}
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="card stack">
          <p className="eyebrow">
            {t.players} ({activePlayers.length})
          </p>
          <div className="stack" style={{ gap: 8 }}>
            {activePlayers.map((p) => (
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
                      if (!window.confirm(t.kickConfirm(p.name))) return;
                      await api.kickPlayer(gameId, hostCode, p.id);
                      void refetch();
                    }}
                  >
                    {t.kick}
                  </button>
                )}
              </div>
            ))}
            {activePlayers.length === 0 && (
              <p className="faint">{no.lobby.waitingForPlayers}</p>
            )}
          </div>
        </div>

        <div className="card stack" style={{ gap: 8 }}>
          <p className="eyebrow">{t.hostCodeTitle}</p>
          <p className="mono" style={{ fontSize: 22, fontWeight: 700, color: "var(--gold)" }}>
            {hostCode}
          </p>
          <p className="faint" style={{ fontSize: 13.5 }}>{t.hostCodeLead}</p>
        </div>
      </div>
    </main>
  );
}
