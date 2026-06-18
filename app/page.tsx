import Link from "next/link";
import { no } from "@/lib/locale/no";

export default function Landing() {
  const t = no.landing;
  return (
    <main className="center-screen">
      <div className="stack" style={{ width: "100%", maxWidth: 760 }}>
        <div className="text-center stack" style={{ gap: 10 }}>
          <span className="brandmark" style={{ justifyContent: "center" }}>
            <span className="glyph" aria-hidden="true">▦</span>
            Sunday<b>Quiz</b>
          </span>
          <h1 style={{ fontSize: "clamp(34px, 6vw, 56px)" }}>{t.heroTitle}</h1>
          <p className="muted" style={{ maxWidth: 540, margin: "0 auto" }}>
            {t.heroLead}
          </p>
        </div>

        <div className="row entrance-row" style={{ alignItems: "stretch", flexWrap: "wrap" }}>
          <Link href="/play" className="card entrance grow">
            <div className="entrance-glyph" aria-hidden="true">📱</div>
            <h2 style={{ fontSize: 24, marginBottom: 6 }}>{t.joinTitle}</h2>
            <p className="muted" style={{ fontSize: 15 }}>{t.joinLead}</p>
            <p style={{ marginTop: 14 }}>
              <span className="btn btn-primary">{t.joinCta}</span>
            </p>
          </Link>
          <Link href="/ny" className="card entrance grow">
            <div className="entrance-glyph" aria-hidden="true">🎛️</div>
            <h2 style={{ fontSize: 24, marginBottom: 6 }}>{t.hostTitle}</h2>
            <p className="muted" style={{ fontSize: 15 }}>{t.hostLead}</p>
            <p style={{ marginTop: 14 }}>
              <span className="btn">{t.hostCta}</span>
            </p>
          </Link>
        </div>

        <div className="card">
          <p className="eyebrow" style={{ marginBottom: 10 }}>{t.howTitle}</p>
          <ol className="stack" style={{ gap: 8, paddingLeft: 22 }}>
            <li className="muted">{t.how1}</li>
            <li className="muted">{t.how2}</li>
            <li className="muted">{t.how3}</li>
          </ol>
        </div>

        <p className="text-center faint" style={{ fontSize: 14 }}>
          <Link href="/host" style={{ color: "var(--gold)" }}>
            {no.hostAuth.dashTitle}
          </Link>
        </p>

        <p className="text-center faint" style={{ fontSize: 14 }}>
          {t.resumeLead}{" "}
          <Link href="/play?resume=1" style={{ color: "var(--gold)" }}>
            {t.resumeCta}
          </Link>
        </p>
      </div>
    </main>
  );
}
