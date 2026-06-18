"use client";

import { no } from "@/lib/locale/no";

// Route-level error boundary — a transient render/runtime error shows a
// friendly recovery screen instead of a blank, unrecoverable page.
export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="center-screen">
      <div
        className="card card-narrow stack text-center"
        style={{ alignItems: "center" }}
        role="alert"
      >
        <div className="brandmark" style={{ justifyContent: "center" }}>
          <span className="glyph">▦</span>Sunday<b>Quiz</b>
        </div>
        <div style={{ fontSize: 40 }} aria-hidden="true">🎲</div>
        <h2 style={{ fontSize: 24 }}>{no.common.error}</h2>
        <p className="muted">
          Prøv på nytt — framgangen i spillet er trygt lagret på serveren.
        </p>
        <div className="row" style={{ marginTop: 6, flexWrap: "wrap", justifyContent: "center" }}>
          <button className="btn btn-primary btn-lg" onClick={() => reset()}>
            {no.common.retry}
          </button>
          <button
            className="btn btn-lg"
            onClick={() => {
              window.location.href = "/";
            }}
          >
            Til forsiden
          </button>
        </div>
      </div>
    </main>
  );
}
