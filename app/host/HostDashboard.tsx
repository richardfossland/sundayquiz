"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { api } from "@/lib/client/api";
import { createAuthBrowserClient } from "@/lib/supabase/auth-browser";
import type { OwnedGameSummary } from "@/lib/server/host-games";
import { no } from "@/lib/locale/no";

const t = no.hostAuth;

const STATUS_LABEL: Record<OwnedGameSummary["status"], string> = {
  lobby: t.statusLobby,
  live: t.statusLive,
  finished: t.statusFinished,
};

function typeLabel(type: OwnedGameSummary["gameType"]): string {
  return type === "quiz" ? t.typeQuiz : t.typeBingo;
}

export function HostDashboard({
  email,
  games,
}: {
  email: string;
  games: OwnedGameSummary[];
}) {
  const router = useRouter();
  const [rows, setRows] = useState(games);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onDelete(game: OwnedGameSummary) {
    if (!window.confirm(t.confirmDelete(game.title))) return;
    setDeletingId(game.id);
    setError(null);
    try {
      await api.deleteGame(game.id);
      setRows((prev) => prev.filter((g) => g.id !== game.id));
    } catch {
      setError(t.deleteError);
    } finally {
      setDeletingId(null);
    }
  }

  async function signOut() {
    try {
      const supabase = createAuthBrowserClient();
      await supabase.auth.signOut();
    } finally {
      router.replace("/host/login");
      router.refresh();
    }
  }

  return (
    <main className="center-screen" style={{ alignItems: "flex-start", paddingTop: 40 }}>
      <div className="stack" style={{ width: "100%", maxWidth: 680 }}>
        <div className="spread">
          <Link href="/" className="brandmark">
            <span className="glyph">▦</span>Sunday<b>Quiz</b>
          </Link>
          <button className="btn btn-ghost" onClick={signOut} style={{ fontSize: 14 }}>
            {t.signOut}
          </button>
        </div>

        <div className="stack" style={{ gap: 6 }}>
          <h1 style={{ fontSize: 28 }}>{t.dashTitle}</h1>
          <p className="muted">{t.dashLead}</p>
          <p className="muted" style={{ fontSize: 13 }}>{t.signedInAs(email)}</p>
        </div>

        <Link href="/ny" className="btn btn-primary">
          {t.createNew}
        </Link>

        {error && <p className="error-text">{error}</p>}

        {rows.length === 0 ? (
          <div className="card">
            <p className="muted">{t.empty}</p>
          </div>
        ) : (
          <div className="stack">
            {rows.map((game) => (
              <div className="card spread" key={game.id} style={{ alignItems: "center" }}>
                <div className="stack" style={{ gap: 4 }}>
                  <h3 style={{ fontSize: 18 }}>{game.title || "(uten tittel)"}</h3>
                  <p className="muted" style={{ fontSize: 13 }}>
                    {typeLabel(game.gameType)} · {STATUS_LABEL[game.status]} ·{" "}
                    {t.pinLabel} {game.joinPin}
                  </p>
                </div>
                <div className="row" style={{ gap: 8 }}>
                  <Link href={`/host/${game.id}`} className="btn">
                    {t.open}
                  </Link>
                  <button
                    className="btn btn-danger"
                    onClick={() => onDelete(game)}
                    disabled={deletingId === game.id}
                  >
                    {deletingId === game.id ? t.deleting : t.delete}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
