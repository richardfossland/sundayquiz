import Link from "next/link";

// 404 — keep the warm brand frame and a clear way back instead of a bare page.
export default function NotFound() {
  return (
    <main className="center-screen">
      <div
        className="card card-narrow stack text-center"
        style={{ alignItems: "center" }}
      >
        <div className="brandmark" style={{ justifyContent: "center" }}>
          <span className="glyph">▦</span>Sunday<b>Quiz</b>
        </div>
        <div style={{ fontSize: 40 }} aria-hidden="true">🔍</div>
        <h2 style={{ fontSize: 24 }}>Fant ikke siden</h2>
        <p className="muted">
          Lenken er kanskje gammel, eller spillet er avsluttet.
        </p>
        <Link href="/" className="btn btn-primary btn-lg" style={{ marginTop: 6 }}>
          Til forsiden
        </Link>
      </div>
    </main>
  );
}
