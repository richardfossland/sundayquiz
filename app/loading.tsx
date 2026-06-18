import { no } from "@/lib/locale/no";

// Route-level loading UI — shown during navigation/suspense instead of a blank
// screen. Keeps the warm brand frame so transitions never feel broken.
export default function Loading() {
  return (
    <main className="center-screen" aria-busy="true">
      <div className="stack text-center" style={{ alignItems: "center", gap: 14 }}>
        <span className="brandmark" style={{ justifyContent: "center" }}>
          <span className="glyph">▦</span>Sunday<b>Quiz</b>
        </span>
        <p className="muted" role="status">{no.common.loading}</p>
      </div>
    </main>
  );
}
