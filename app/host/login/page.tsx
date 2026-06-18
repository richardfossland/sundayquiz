"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

import { createAuthBrowserClient } from "@/lib/supabase/auth-browser";
import { no } from "@/lib/locale/no";

const t = no.hostAuth;

function HostLoginInner() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const params = useSearchParams();
  const authError = params.get("error") === "auth";

  async function sendMagicLink(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const supabase = createAuthBrowserClient();
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
      });
      if (error) throw error;
      setSent(true);
    } catch {
      setError(t.sendError);
    } finally {
      setBusy(false);
    }
  }

  async function signInWithGoogle() {
    const supabase = createAuthBrowserClient();
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
  }

  return (
    <main className="center-screen">
      <div className="stack" style={{ width: "100%", maxWidth: 440 }}>
        <div className="text-center stack" style={{ gap: 8 }}>
          <span className="brandmark" style={{ justifyContent: "center" }}>
            <span className="glyph">▦</span>
            Sunday<b>Quiz</b>
          </span>
          <h1 style={{ fontSize: 28 }}>{t.loginTitle}</h1>
          <p className="muted" style={{ maxWidth: 380, margin: "0 auto" }}>
            {t.loginLead}
          </p>
        </div>

        {(error || authError) && (
          <p className="error-text">{error ?? t.authError}</p>
        )}

        <div className="card stack">
          {sent ? (
            <p>{t.magicLinkSent(email)}</p>
          ) : (
            <form onSubmit={sendMagicLink} className="stack">
              <div className="field">
                <label htmlFor="email">{t.emailLabel}</label>
                <input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={t.emailPlaceholder}
                  autoComplete="email"
                />
              </div>
              <button className="btn btn-primary btn-block" disabled={busy}>
                {busy ? t.sending : t.sendMagicLink}
              </button>
            </form>
          )}
        </div>

        <div className="text-center muted" style={{ fontSize: 13 }}>
          {t.or}
        </div>

        <button className="btn btn-block" onClick={signInWithGoogle}>
          {t.google}
        </button>

        <div className="text-center" style={{ marginTop: 8 }}>
          <Link href="/" className="muted" style={{ fontSize: 14 }}>
            {t.backToPlay}
          </Link>
        </div>
      </div>
    </main>
  );
}

export default function HostLoginPage() {
  return (
    <Suspense fallback={null}>
      <HostLoginInner />
    </Suspense>
  );
}
