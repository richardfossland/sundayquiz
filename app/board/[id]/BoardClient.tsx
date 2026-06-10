"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { api } from "@/lib/client/api";
import { useGameState } from "@/lib/client/useGameState";
import { usePresence } from "@/lib/client/usePresence";
import { BoardState } from "@/lib/dto";
import { no } from "@/lib/locale/no";
import { Confetti } from "@/app/components/Confetti";
import { FinaleGraph } from "./FinaleGraph";

const t = no.board;

export function BoardClient({ gameId }: { gameId: string }) {
  const [moment, setMoment] = useState<{ name: string; rank: number } | null>(null);
  const momentTimer = useRef<number | null>(null);

  const fetcher = useCallback(() => api.boardState(gameId), [gameId]);
  const { state } = useGameState<BoardState>(gameId, fetcher, (event, payload) => {
    if (event === "bingo") {
      setMoment({
        name: (payload.displayName as string) ?? "?",
        rank: (payload.rank as number) ?? 1,
      });
      if (momentTimer.current) window.clearTimeout(momentTimer.current);
      momentTimer.current = window.setTimeout(() => setMoment(null), 6000);
    }
  });

  // Presence: observe only (the board is not a player).
  const present = usePresence(gameId, null);

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
            <span className="muted" style={{ fontFamily: "var(--body)", fontWeight: 500, fontSize: 17 }}>
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

      {state.status === "lobby" && <Lobby state={state} presentCount={present.length} />}
      {state.status === "live" && <Live state={state} />}
      {state.status === "finished" && state.finale && <Finished state={state} />}

      {moment && (
        <div className="bingo-overlay">
          <Confetti count={140} />
          <div className="inner">
            <div className="bingo-word">{no.game.bingo}</div>
            <div className="bingo-name">{moment.name}</div>
            <p className="muted" style={{ fontSize: 22, marginTop: 6 }}>
              {no.game.bingoRank(moment.rank)}
            </p>
          </div>
        </div>
      )}
    </main>
  );
}

function Lobby({ state, presentCount }: { state: BoardState; presentCount: number }) {
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
          <div
            style={{
              background: "var(--paper)",
              borderRadius: 18,
              padding: 14,
              boxShadow: "var(--shadow-2)",
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qr} alt={t.scanQr} width={240} height={240} />
          </div>
        )}
      </div>
      <div className="stack" style={{ gap: 12 }}>
        <p className="muted">
          {active.length === 0
            ? no.lobby.waitingForPlayers
            : no.lobby.playerCount(active.length)}
          {presentCount > 0 && active.length > 0 ? " 🟢" : ""}
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

function Live({ state }: { state: BoardState }) {
  const pct =
    state.progress.totalCells > 0
      ? Math.min(100, (state.progress.confirmed / state.progress.totalCells) * 100)
      : 0;

  return (
    <div className="stack grow" style={{ gap: 24 }}>
      <div className="stack" style={{ gap: 8 }}>
        <div className="spread">
          <span className="eyebrow">{t.progressLabel}</span>
          <span className="muted" style={{ fontVariantNumeric: "tabular-nums" }}>
            {state.progress.confirmed} / {state.progress.totalCells}
          </span>
        </div>
        <div className="progress-shell">
          <div className="progress-fill" style={{ width: `${pct}%` }} />
        </div>
      </div>

      <div className="board-live">
        <section className="card stack" style={{ minHeight: 320 }}>
          <p className="eyebrow">{t.tickerHeading}</p>
          <div className="ticker-list">
            {state.ticker.length === 0 && (
              <p className="faint">{no.lobby.waitingForPlayers}</p>
            )}
            {state.ticker.map((item, i) => (
              <div key={`${item.at}-${i}`} className="ticker-item">
                <span className="names">{item.claimerName}</span>
                <span className="check">✓</span>
                <span className="names">{item.verifierName}</span>
                <span className="what">— {item.statementText}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="card stack">
          <p className="eyebrow">{t.bingoHeading}</p>
          {state.podium.length === 0 && <p className="faint">{t.noBingosYet}</p>}
          <div className="stack" style={{ gap: 10 }}>
            {state.podium.map((p) => (
              <div key={p.playerId} className="row">
                <span className={`rankpill ${p.rank === 1 ? "r1" : ""}`}>{p.rank}</span>
                <span style={{ fontWeight: 700, fontSize: 19 }}>{p.name}</span>
                {p.secondsFromStart !== null && (
                  <span className="faint" style={{ marginLeft: "auto", fontVariantNumeric: "tabular-nums" }}>
                    {Math.floor(p.secondsFromStart / 60)}:{String(p.secondsFromStart % 60).padStart(2, "0")}
                  </span>
                )}
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

function Finished({ state }: { state: BoardState }) {
  const f = state.finale!;
  const mostSocial = [...f.players].sort((a, b) => b.degree - a.degree)[0];
  const fastest = f.podium[0];

  return (
    <div className="stack grow" style={{ gap: 24 }}>
      <h1 className="text-center" style={{ fontSize: "clamp(30px, 4.5vw, 52px)" }}>
        {t.finishedHeading}
      </h1>

      <div className="stat-grid">
        <div className="stat">
          <div className="num">{f.totals.confirmedMarks}</div>
          <div className="lbl">{t.statsConversations}</div>
        </div>
        <div className="stat">
          <div className="num">{f.totals.uniquePairs}</div>
          <div className="lbl">{t.statsPairs}</div>
        </div>
        <div className="stat">
          <div className="num">{f.totals.playersConnected}</div>
          <div className="lbl">{t.statsConnected}</div>
        </div>
        {mostSocial && mostSocial.degree > 0 && (
          <div className="stat">
            <div className="num" style={{ fontSize: "clamp(22px, 2.6vw, 32px)" }}>
              {mostSocial.name}
            </div>
            <div className="lbl">{t.mostSocial} · {mostSocial.degree} møter</div>
          </div>
        )}
        {fastest && fastest.secondsFromStart !== null && (
          <div className="stat">
            <div className="num" style={{ fontSize: "clamp(22px, 2.6vw, 32px)" }}>
              {fastest.name}
            </div>
            <div className="lbl">
              {t.fastestBingo} · {Math.floor(fastest.secondsFromStart / 60)}:
              {String(fastest.secondsFromStart % 60).padStart(2, "0")}
            </div>
          </div>
        )}
      </div>

      <div className="board-live">
        <section className="stack" style={{ gap: 10 }}>
          <p className="eyebrow">{t.graphHeading}</p>
          <FinaleGraph finale={f} />
        </section>

        <section className="card stack">
          <p className="eyebrow">{t.bingoHeading}</p>
          {f.podium.length === 0 && <p className="faint">{t.noBingosYet}</p>}
          {f.podium.length > 0 && (
            <>
              <div className="podium" style={{ marginTop: 8 }}>
                {f.podium.slice(0, 3).map((p) => (
                  <div key={p.playerId} className="podium-col" style={{ order: p.rank === 1 ? 1 : p.rank === 2 ? 0 : 2 }}>
                    <p style={{ fontWeight: 700, marginBottom: 6 }}>{p.name}</p>
                    <div
                      className={`podium-bar ${p.rank === 1 ? "p1" : ""}`}
                      style={{ height: p.rank === 1 ? 120 : p.rank === 2 ? 86 : 64 }}
                    >
                      {p.rank}
                    </div>
                  </div>
                ))}
              </div>
              <div className="stack" style={{ gap: 6, marginTop: 10 }}>
                {f.podium.slice(3).map((p) => (
                  <div key={p.playerId} className="row">
                    <span className="rankpill">{p.rank}</span>
                    <span style={{ fontWeight: 600 }}>{p.name}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
