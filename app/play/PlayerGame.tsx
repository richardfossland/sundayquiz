"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/client/api";
import { StoredPlayer } from "@/lib/client/identity";
import { useGameState } from "@/lib/client/useGameState";
import { usePresence } from "@/lib/client/usePresence";
import { PendingPrompt, PlayerState } from "@/lib/dto";
import { no } from "@/lib/locale/no";
import { Confetti } from "@/app/components/Confetti";

const t = no.game;

function errorText(code: string): string {
  return (t.errors as Record<string, string>)[code] ?? t.errors.generic;
}

export function PlayerGame({
  player,
  onSessionLost,
}: {
  player: StoredPlayer;
  onSessionLost: () => void;
}) {
  const [toast, setToast] = useState<{ text: string; gold?: boolean } | null>(null);
  const [pickerCell, setPickerCell] = useState<number | null>(null);
  const [celebrate, setCelebrate] = useState<number | null>(null); // bingo rank
  const lostRef = useRef(onSessionLost);
  useEffect(() => {
    lostRef.current = onSessionLost;
  });

  const showToast = useCallback((text: string, gold = false) => {
    setToast({ text, gold });
    window.setTimeout(() => setToast(null), 3500);
  }, []);

  const fetcher = useCallback(async () => {
    try {
      return await api.playerState(
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

  const { state, refetch } = useGameState<PlayerState>(
    player.gameId,
    fetcher,
    (event, payload) => {
      if (
        event === "mark_resolved" &&
        payload.targetPlayerId === player.playerId
      ) {
        if (payload.status === "rejected") showToast(t.notConfirmed);
        if (payload.status === "expired") showToast(t.expired);
      }
    },
  );

  // Celebrate own bingo exactly once per achieved rank — persisted so a reload
  // or reconnect of an already-won board does NOT re-trigger the overlay.
  const celebratedKey = `quiz:celebrated:${player.gameId}:${player.playerId}`;
  useEffect(() => {
    const rank = state?.board?.bingoRank ?? null;
    if (rank === null) return;
    let already: string | null = null;
    try {
      already = localStorage.getItem(celebratedKey);
    } catch {}
    if (already === String(rank)) return;
    try {
      localStorage.setItem(celebratedKey, String(rank));
    } catch {}
    // Firing a one-shot celebration on a server-state transition — not a
    // cascading render.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCelebrate(rank);
    const tid = window.setTimeout(() => setCelebrate(null), 4200);
    return () => window.clearTimeout(tid);
  }, [state?.board?.bingoRank, celebratedKey]);

  usePresence(player.gameId, {
    playerId: player.playerId,
    name: player.displayName || (state?.roster.find((r) => r.id === player.playerId)?.name ?? ""),
    isHost: false,
  });

  if (!state) {
    return (
      <main className="center-screen">
        <p className="muted">{no.common.loading}</p>
      </main>
    );
  }

  const incoming = state.incoming[0] ?? null;

  return (
    <main style={{ padding: "20px 14px 120px", maxWidth: 560, margin: "0 auto" }}>
      <header className="spread" style={{ marginBottom: 16 }}>
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

      {state.status === "lobby" && <LobbyWait state={state} />}
      {state.status === "live" && (
        <LiveBoard
          state={state}
          onTapCell={(i) => setPickerCell(i)}
          onCancelOutgoing={async () => {
            const markId = state.outgoing?.markId;
            if (!markId) return;
            try {
              await api.cancelMark({
                gameId: player.gameId,
                playerId: player.playerId,
                code: player.resumeCode,
                markId,
              });
            } catch (err) {
              showToast(errorText((err as Error).message));
            }
            void refetch();
          }}
        />
      )}
      {state.status === "finished" && <FinishedSummary state={state} />}

      {/* one sheet at a time: incoming verification beats the picker */}
      {incoming && state.status === "live" ? (
        <PromptSheet
          prompt={incoming}
          queued={state.incoming.length - 1}
          onRespond={async (accept) => {
            try {
              const res = await api.respondMark({
                gameId: player.gameId,
                playerId: player.playerId,
                code: player.resumeCode,
                markId: incoming.markId,
                accept,
              });
              if (res.status === "expired") {
                // the prompt timed out before we answered
                showToast(t.promptGone);
              } else if (res.bingo) {
                // the claimer got bingo off our confirmation — fun to know
                showToast(t.bingoRank(res.bingo.rank), true);
              }
            } catch (err) {
              showToast(errorText((err as Error).message));
            }
            void refetch();
          }}
        />
      ) : pickerCell !== null && state.status === "live" ? (
        <PickerSheet
          state={state}
          selfId={player.playerId}
          onClose={() => setPickerCell(null)}
          onPick={async (verifierId) => {
            try {
              await api.createMark({
                gameId: player.gameId,
                playerId: player.playerId,
                code: player.resumeCode,
                cellIndex: pickerCell,
                verifierId,
              });
            } catch (err) {
              showToast(errorText((err as Error).message));
            }
            setPickerCell(null);
            void refetch();
          }}
        />
      ) : null}

      {celebrate !== null && (
        <div className="bingo-overlay" onClick={() => setCelebrate(null)}>
          <Confetti />
          <div className="inner stack" style={{ gap: 10 }}>
            <div className="bingo-word">{t.bingo}</div>
            <div className="bingo-name">{t.bingoRank(celebrate)}</div>
            <p className="muted">{t.keepGoing}</p>
          </div>
        </div>
      )}

      {toast && (
        <div className={`toast ${toast.gold ? "gold" : ""}`}>{toast.text}</div>
      )}
    </main>
  );
}

function LobbyWait({ state }: { state: PlayerState }) {
  const active = state.roster.filter((r) => r.status === "active");
  return (
    <div className="card stack text-center">
      <h1 style={{ fontSize: 30 }}>{no.lobby.youAreIn}</h1>
      <p className="muted">{no.lobby.waitForStart}</p>
      <p className="faint" style={{ fontSize: 14 }}>
        {no.lobby.playerCount(active.length)}
      </p>
      <div className="chips">
        {active.map((r) => (
          <span key={r.id} className="chip">
            <span className="avatar">{r.name.slice(0, 1).toUpperCase()}</span>
            {r.name}
          </span>
        ))}
      </div>
    </div>
  );
}

function LiveBoard({
  state,
  onTapCell,
  onCancelOutgoing,
}: {
  state: PlayerState;
  onTapCell: (index: number) => void;
  onCancelOutgoing: () => void;
}) {
  if (!state.board) {
    return <p className="muted">{no.common.loading}</p>;
  }
  const grid = state.config.gridSize;
  const hasOutgoing = state.outgoing !== null;

  return (
    <div className="stack">
      <p className="muted" style={{ fontSize: 14.5 }}>
        {hasOutgoing ? t.tapToCancel : t.tapToClaim}
      </p>
      <div className={`bingo-grid g${grid}`}>
        {state.board.cells.map((cell) => {
          if (cell.free) {
            return (
              <button
                key={cell.index}
                className="bingo-cell free"
                disabled
                aria-label={`${t.freeCell} — alltid markert`}
              >
                {t.freeCell} ✓
              </button>
            );
          }
          const mark = cell.mark;
          const isPendingHere =
            state.outgoing?.cellIndex === cell.index && mark?.status !== "confirmed";
          const cls = mark?.status === "confirmed"
            ? "confirmed"
            : isPendingHere || mark?.status === "pending"
              ? "pending"
              : "";
          const confirmed = mark?.status === "confirmed";
          const waitingName =
            mark?.verifierName ?? state.outgoing?.verifierName ?? "…";
          const label = confirmed
            ? `${cell.text} — ${t.confirmedBy(mark!.verifierName)}`
            : isPendingHere
              ? `${cell.text} — ${t.waitingFor(waitingName)}, trykk for å avbryte`
              : mark?.status === "pending"
                ? `${cell.text} — ${t.waitingFor(waitingName)}`
                : cell.text;
          return (
            <button
              key={cell.index}
              className={`bingo-cell ${cls}`}
              disabled={confirmed}
              onClick={() => {
                if (isPendingHere) onCancelOutgoing();
                else if (mark === null && !hasOutgoing) onTapCell(cell.index);
              }}
              aria-label={label}
            >
              <span>{cell.text}</span>
              {confirmed && <span className="who">✓ {mark!.verifierName}</span>}
              {(isPendingHere || mark?.status === "pending") && !confirmed && (
                <span className="who">{t.waitingFor(waitingName)}</span>
              )}
            </button>
          );
        })}
      </div>
      {state.board.bingoRank !== null && (
        <div className="banner banner-info text-center">
          {t.bingoRank(state.board.bingoRank)} {t.keepGoing}
        </div>
      )}
    </div>
  );
}

function PickerSheet({
  state,
  selfId,
  onClose,
  onPick,
}: {
  state: PlayerState;
  selfId: string;
  onClose: () => void;
  onPick: (verifierId: string) => void;
}) {
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const candidates = state.roster.filter(
    (r) =>
      r.id !== selfId &&
      r.status === "active" &&
      r.name.toLowerCase().includes(q.trim().toLowerCase()),
  );
  return (
    <>
      <div className="sheet-backdrop" onClick={onClose} />
      <div className="sheet" role="dialog" aria-modal="true">
        <h2>{t.pickPerson}</h2>
        <p className="muted" style={{ fontSize: 14, marginTop: 4 }}>
          {t.pickPersonHint}
        </p>
        <input
          className="input"
          style={{ marginTop: 12 }}
          placeholder={t.searchPlaceholder}
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <div className="picker-list">
          {candidates.length === 0 && (
            <p className="faint" style={{ padding: "10px 4px" }}>{t.nobodyElse}</p>
          )}
          {candidates.map((r) => (
            <button
              key={r.id}
              className="picker-row"
              disabled={busy}
              onClick={() => {
                setBusy(true);
                onPick(r.id);
              }}
            >
              <span className="avatar">{r.name.slice(0, 1).toUpperCase()}</span>
              {r.name}
            </button>
          ))}
        </div>
        <button className="btn btn-ghost btn-block" style={{ marginTop: 14 }} onClick={onClose}>
          {no.common.cancel}
        </button>
      </div>
    </>
  );
}

function PromptSheet({
  prompt,
  queued,
  onRespond,
}: {
  prompt: PendingPrompt;
  queued: number;
  onRespond: (accept: boolean) => void;
}) {
  const [busy, setBusy] = useState(false);
  const respond = (accept: boolean) => {
    if (busy) return;
    setBusy(true);
    onRespond(accept);
  };
  return (
    <>
      <div className="sheet-backdrop" />
      <div className="sheet stack" role="dialog" aria-modal="true">
        <h2>{t.promptTitle}</h2>
        <p className="statement">
          {t.promptBody(prompt.claimerName, prompt.statementText)}
        </p>
        <div className="row">
          <button
            className="btn btn-ok btn-lg grow"
            disabled={busy}
            onClick={() => respond(true)}
          >
            {t.promptYes}
          </button>
          <button
            className="btn btn-lg grow"
            disabled={busy}
            onClick={() => respond(false)}
          >
            {t.promptNo}
          </button>
        </div>
        {queued > 0 && (
          <p className="faint text-center" style={{ fontSize: 13 }}>
            {t.promptQueued(queued)}
          </p>
        )}
      </div>
    </>
  );
}

function FinishedSummary({ state }: { state: PlayerState }) {
  const own = state.podium.find((p) => p.playerId === state.playerId);
  return (
    <div className="card stack text-center">
      <h1 style={{ fontSize: 30 }}>{no.board.finishedHeading}</h1>
      {own ? (
        <p className="banner banner-info">{t.bingoRank(own.rank)}</p>
      ) : (
        <p className="muted">{no.board.noBingosYet}</p>
      )}
      {state.podium.length > 0 && (
        <div className="stack" style={{ gap: 8 }}>
          {state.podium.slice(0, 5).map((p) => (
            <div key={p.playerId} className="row" style={{ justifyContent: "center" }}>
              <span className={`rankpill ${p.rank === 1 ? "r1" : ""}`}>{p.rank}</span>
              <span style={{ fontWeight: 600 }}>{p.name}</span>
            </div>
          ))}
        </div>
      )}
      <p className="muted" style={{ fontSize: 14.5 }}>
        Se storskjermen for hele bildet av kvelden 🎉
      </p>
    </div>
  );
}
