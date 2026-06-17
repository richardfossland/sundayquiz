"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/client/api";
import { identity, StoredPlayer } from "@/lib/client/identity";
import { isValidPin } from "@/lib/codes";
import { no } from "@/lib/locale/no";
import { PlayerGame } from "./PlayerGame";
import { QuizPlayerGame } from "./QuizPlayerGame";

type Screen =
  | { kind: "init" }
  | { kind: "pin"; error?: string }
  | { kind: "name"; pin: string; error?: string }
  | { kind: "showCode"; player: StoredPlayer }
  | { kind: "resume"; error?: string }
  | { kind: "playing"; player: StoredPlayer };

function JoinFlow() {
  const params = useSearchParams();
  const [screen, setScreen] = useState<Screen>({ kind: "init" });
  const [busy, setBusy] = useState(false);
  const t = no.join;

  // On mount: restore a stored session, or land on PIN/resume entry.
  useEffect(() => {
    const wantsResume = params.get("resume") === "1";
    const stored = identity.player();
    if (!stored) {
      // One-time mount init from localStorage — not a cascading-render risk.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setScreen(wantsResume ? { kind: "resume" } : { kind: "pin" });
      return;
    }
    api
      .resume(stored.resumeCode, { gameId: stored.gameId })
      .then((res) => {
        if (res.role === "player" && res.playerId) {
          setScreen({ kind: "playing", player: stored });
        } else {
          identity.clearPlayer();
          setScreen({ kind: "pin" });
        }
      })
      .catch(() => {
        identity.clearPlayer();
        setScreen(wantsResume ? { kind: "resume" } : { kind: "pin" });
      });
  }, [params]);

  const submitPin = (pin: string) => {
    if (!isValidPin(pin)) {
      setScreen({ kind: "pin", error: t.errors.invalid_pin });
      return;
    }
    setScreen({ kind: "name", pin });
  };

  const submitName = async (pin: string, name: string) => {
    if (!name.trim()) {
      setScreen({ kind: "name", pin, error: t.errors.missing_name });
      return;
    }
    setBusy(true);
    try {
      const res = await api.join(pin, name.trim());
      const player: StoredPlayer = {
        gameId: res.gameId,
        playerId: res.playerId,
        resumeCode: res.resumeCode,
        displayName: res.displayName,
      };
      identity.savePlayer(player);
      setScreen({ kind: "showCode", player });
    } catch (err) {
      const code = (err as Error).message;
      const msg =
        (t.errors as Record<string, string>)[code] ?? t.errors.join_failed;
      setScreen({ kind: "name", pin, error: msg });
    } finally {
      setBusy(false);
    }
  };

  const submitResume = async (code: string, pin: string) => {
    setBusy(true);
    try {
      const res = await api.resume(code, pin ? { pin } : {});
      if (res.role !== "player" || !res.playerId) throw new Error("invalid_code");
      const player: StoredPlayer = {
        gameId: res.gameId,
        playerId: res.playerId,
        resumeCode: code,
        displayName: res.displayName ?? "",
      };
      identity.savePlayer(player);
      setScreen({ kind: "playing", player });
    } catch {
      setScreen({ kind: "resume", error: t.errors.invalid_code });
    } finally {
      setBusy(false);
    }
  };

  if (screen.kind === "playing") {
    return (
      <PlayingRouter
        player={screen.player}
        onSessionLost={() => {
          identity.clearPlayer();
          setScreen({ kind: "pin" });
        }}
      />
    );
  }

  return (
    <main className="center-screen">
      <div className="card card-narrow stack">
        <Link href="/" className="brandmark">
          <span className="glyph">▦</span>Sunday<b>Quiz</b>
        </Link>

        {screen.kind === "init" && <p className="muted">{no.common.loading}</p>}

        {screen.kind === "pin" && (
          <PinForm error={screen.error} onSubmit={submitPin} />
        )}

        {screen.kind === "name" && (
          <NameForm
            error={screen.error}
            busy={busy}
            onSubmit={(name) => submitName(screen.pin, name)}
          />
        )}

        {screen.kind === "showCode" && (
          <div className="stack">
            <h1 style={{ fontSize: 26 }}>{t.codeTitle}</h1>
            <div
              className="text-center mono"
              style={{
                fontSize: 40,
                fontWeight: 700,
                letterSpacing: "0.12em",
                color: "var(--gold)",
                padding: "14px 0",
              }}
            >
              {screen.player.resumeCode}
            </div>
            <p className="muted" style={{ fontSize: 14.5 }}>{t.codeLead}</p>
            <button
              className="btn btn-primary btn-lg btn-block"
              onClick={() => setScreen({ kind: "playing", player: screen.player })}
            >
              {t.codeCta}
            </button>
          </div>
        )}

        {screen.kind === "resume" && (
          <ResumeForm error={screen.error} busy={busy} onSubmit={submitResume} />
        )}
      </div>
    </main>
  );
}

// Routes a playing session to the right in-mode UI. The board state is public
// and carries the game_type (quiz state includes `gameType: "quiz"`), so one
// lightweight fetch decides which client renders.
function PlayingRouter({
  player,
  onSessionLost,
}: {
  player: StoredPlayer;
  onSessionLost: () => void;
}) {
  const [gameType, setGameType] = useState<"bingo" | "quiz" | null>(null);
  useEffect(() => {
    let alive = true;
    api
      .boardState(player.gameId)
      .then((s) => {
        if (alive) {
          setGameType(
            (s as { gameType?: string }).gameType === "quiz" ? "quiz" : "bingo",
          );
        }
      })
      .catch(() => alive && setGameType("bingo"));
    return () => {
      alive = false;
    };
  }, [player.gameId]);

  if (gameType === null) {
    return (
      <main className="center-screen">
        <p className="muted">{no.common.loading}</p>
      </main>
    );
  }
  return gameType === "quiz" ? (
    <QuizPlayerGame player={player} onSessionLost={onSessionLost} />
  ) : (
    <PlayerGame player={player} onSessionLost={onSessionLost} />
  );
}

function PinForm({
  error,
  onSubmit,
}: {
  error?: string;
  onSubmit: (pin: string) => void;
}) {
  const [pin, setPin] = useState("");
  const t = no.join;
  return (
    <form
      className="stack"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(pin);
      }}
    >
      <h1 style={{ fontSize: 26 }}>{no.landing.joinTitle}</h1>
      <div className="field">
        <label htmlFor="pin">{t.pinLabel}</label>
        <input
          id="pin"
          className="input input-pin"
          inputMode="numeric"
          autoComplete="off"
          maxLength={6}
          placeholder="000000"
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
          autoFocus
        />
      </div>
      {error && <div className="banner banner-error">{error}</div>}
      <button className="btn btn-primary btn-lg btn-block" type="submit">
        {t.cta}
      </button>
      <Link href="/play?resume=1" className="text-center faint" style={{ fontSize: 14 }}>
        {t.resumeTitle}
      </Link>
    </form>
  );
}

function NameForm({
  error,
  busy,
  onSubmit,
}: {
  error?: string;
  busy: boolean;
  onSubmit: (name: string) => void;
}) {
  const [name, setName] = useState("");
  const t = no.join;
  return (
    <form
      className="stack"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(name);
      }}
    >
      <h1 style={{ fontSize: 26 }}>{t.nameLabel}</h1>
      <div className="field">
        <label htmlFor="name">{t.nameLabel}</label>
        <input
          id="name"
          className="input"
          maxLength={40}
          placeholder={t.namePlaceholder}
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoFocus
        />
      </div>
      <p className="faint" style={{ fontSize: 13.5 }}>{t.nameHint}</p>
      {error && <div className="banner banner-error">{error}</div>}
      <button className="btn btn-primary btn-lg btn-block" disabled={busy} type="submit">
        {busy ? no.common.loading : t.cta}
      </button>
    </form>
  );
}

function ResumeForm({
  error,
  busy,
  onSubmit,
}: {
  error?: string;
  busy: boolean;
  onSubmit: (code: string, pin: string) => void;
}) {
  const [code, setCode] = useState("");
  const [pin, setPin] = useState("");
  const t = no.join;
  return (
    <form
      className="stack"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(code.trim(), pin.trim());
      }}
    >
      <h1 style={{ fontSize: 26 }}>{t.resumeTitle}</h1>
      <div className="field">
        <label htmlFor="rcode">{t.resumeLabel}</label>
        <input
          id="rcode"
          className="input mono"
          placeholder="XXXX-00"
          maxLength={8}
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          autoFocus
        />
      </div>
      <div className="field">
        <label htmlFor="rpin">{t.pinLabel}</label>
        <input
          id="rpin"
          className="input mono"
          inputMode="numeric"
          maxLength={6}
          placeholder="000000"
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
        />
      </div>
      {error && <div className="banner banner-error">{error}</div>}
      <button className="btn btn-primary btn-lg btn-block" disabled={busy} type="submit">
        {busy ? no.common.loading : t.resumeCta}
      </button>
    </form>
  );
}

export default function PlayPage() {
  return (
    <Suspense
      fallback={
        <main className="center-screen">
          <p className="muted">{no.common.loading}</p>
        </main>
      }
    >
      <JoinFlow />
    </Suspense>
  );
}
