"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/client/api";
import { identity } from "@/lib/client/identity";
import { StatementSetSummary } from "@/lib/dto";
import { Audience, DEFAULT_CONFIG, GridSize, WinCondition } from "@/lib/types";
import { no } from "@/lib/locale/no";

const t = no.wizard;

type Step = "gathering" | "set" | "rules" | "summary";
const STEPS: Step[] = ["gathering", "set", "rules", "summary"];

interface CustomSet {
  title: string;
  statements: string[];
}

export default function NewGameWizard() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("gathering");
  const [audience, setAudience] = useState<Audience | null>(null);
  const [sets, setSets] = useState<StatementSetSummary[] | null>(null);
  const [selectedSetId, setSelectedSetId] = useState<string | null>(null);
  const [preview, setPreview] = useState<Record<string, string[]>>({});
  const [custom, setCustom] = useState<CustomSet | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorTitle, setEditorTitle] = useState("");
  const [editorText, setEditorText] = useState("");
  const [aiAvailable, setAiAvailable] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [aiTheme, setAiTheme] = useState("");
  const [aiBusy, setAiBusy] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiRejected, setAiRejected] = useState(0);
  const [gridSize, setGridSize] = useState<GridSize>(DEFAULT_CONFIG.gridSize);
  const [winCondition, setWinCondition] = useState<WinCondition>(
    DEFAULT_CONFIG.winCondition,
  );
  const [pairLimit, setPairLimit] = useState(1);
  const [freeCentre, setFreeCentre] = useState(false);
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .listSets()
      .then((r) => {
        setSets(r.sets);
        setAiAvailable(r.aiAvailable);
      })
      .catch(() => setSets([]));
  }, []);

  const needed = useMemo(() => {
    const total = gridSize * gridSize;
    return freeCentre && gridSize % 2 === 1 ? total - 1 : total;
  }, [gridSize, freeCentre]);

  const editorStatements = useMemo(
    () =>
      editorText
        .split("\n")
        .map((s) => s.trim())
        .filter((s) => s.length > 0),
    [editorText],
  );

  const orderedSets = useMemo(() => {
    if (!sets) return [];
    if (!audience) return sets;
    return [...sets].sort((a, b) => {
      const am = a.audience === audience ? 0 : 1;
      const bm = b.audience === audience ? 0 : 1;
      return am - bm;
    });
  }, [sets, audience]);

  const selectedSet = sets?.find((s) => s.id === selectedSetId) ?? null;
  const poolSize = custom
    ? custom.statements.length
    : selectedSet?.statementCount ?? 0;
  const poolOk = poolSize >= needed;

  const loadPreview = async (id: string) => {
    if (preview[id]) return;
    try {
      const detail = await api.getSet(id);
      setPreview((p) => ({
        ...p,
        [id]: detail.statements.slice(0, 4).map((s) => s.text),
      }));
    } catch {}
  };

  const copyToEditor = async (id: string) => {
    try {
      const detail = await api.getSet(id);
      setEditorTitle(`${detail.title} (tilpasset)`);
      setEditorText(detail.statements.map((s) => s.text).join("\n"));
      setEditorOpen(true);
      setSelectedSetId(null);
      setCustom(null);
    } catch {}
  };

  // AI draft → land it in the editor so the host reviews/edits before using it.
  // Never auto-commits: the host still presses "Bruk dette", then "Opprett".
  const generateWithAi = async () => {
    setAiBusy(true);
    setAiError(null);
    setAiRejected(0);
    try {
      const res = await api.generateSet(aiTheme.trim(), audience ?? "generell");
      setEditorTitle(res.title);
      setEditorText(res.statements.join("\n"));
      setAiRejected(res.rejectedCount);
      setAiOpen(false);
      setEditorOpen(true);
      setSelectedSetId(null);
      setCustom(null);
    } catch (err) {
      const code = (err as Error).message;
      setAiError(
        code === "ai_empty"
          ? t.aiEmpty
          : code === "ai_unavailable"
            ? t.aiUnavailable
            : t.aiError,
      );
    } finally {
      setAiBusy(false);
    }
  };

  const create = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await api.createGame({
        title: title.trim(),
        config: {
          gridSize,
          winCondition,
          maxVerificationsPerPair: pairLimit,
          freeCentre,
        },
        statementSet: custom
          ? { title: custom.title, statements: custom.statements }
          : { id: selectedSetId! },
      });
      identity.saveHostCode(res.gameId, res.hostCode);
      router.push(`/host/${res.gameId}`);
    } catch (err) {
      const code = (err as Error).message;
      setError(
        code === "pool_too_small"
          ? t.poolWarning(poolSize, needed)
          : no.common.error,
      );
      setBusy(false);
    }
  };

  const stepIndex = STEPS.indexOf(step);
  const canNext =
    step === "gathering"
      ? audience !== null
      : step === "set"
        ? custom !== null || selectedSetId !== null
        : step === "rules"
          ? poolOk
          : true;

  return (
    <main className="center-screen" style={{ alignItems: "flex-start", paddingTop: 40 }}>
      <div className="stack" style={{ width: "100%", maxWidth: 620 }}>
        <div className="spread">
          <Link href="/" className="brandmark">
            <span className="glyph">▦</span>Sunday<b>Quiz</b>
          </Link>
          <span className="muted" style={{ fontSize: 14 }}>{t.title}</span>
        </div>

        <div className="wizard-progress">
          {STEPS.map((s, i) => (
            <span key={s} className={i <= stepIndex ? "done" : ""} />
          ))}
        </div>

        <div className="card stack">
          {step === "gathering" && (
            <>
              <h1 style={{ fontSize: 26 }}>{t.stepGathering}</h1>
              <div className="opt-row">
                {(
                  [
                    ["kirke", t.gatheringKirke],
                    ["skole", t.gatheringSkole],
                    ["generell", t.gatheringAnnet],
                  ] as [Audience, string][]
                ).map(([key, label]) => (
                  <button
                    key={key}
                    className={`opt ${audience === key ? "selected" : ""}`}
                    onClick={() => setAudience(key)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </>
          )}

          {step === "set" && (
            <>
              <h1 style={{ fontSize: 26 }}>{t.stepSet}</h1>
              {sets === null && <p className="muted">{no.common.loading}</p>}
              {!editorOpen && (
                <div className="stack" style={{ gap: 10 }}>
                  {orderedSets.map((s) => (
                    <div key={s.id}>
                      <button
                        className={`set-card ${selectedSetId === s.id ? "selected" : ""}`}
                        onClick={() => {
                          setSelectedSetId(s.id);
                          setCustom(null);
                          void loadPreview(s.id);
                        }}
                      >
                        <div className="spread">
                          <h3>{s.title}</h3>
                          <span className="faint" style={{ fontSize: 13 }}>
                            {t.setStatements(s.statementCount)}
                          </span>
                        </div>
                        {selectedSetId === s.id && preview[s.id] && (
                          <p className="preview" style={{ marginTop: 8 }}>
                            {preview[s.id].join(" · ")} …
                          </p>
                        )}
                      </button>
                      {selectedSetId === s.id && (
                        <button
                          className="btn btn-ghost"
                          style={{ marginTop: 6, fontSize: 13, padding: "7px 14px" }}
                          onClick={() => copyToEditor(s.id)}
                        >
                          {t.setCustomize}
                        </button>
                      )}
                    </div>
                  ))}
                  <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
                    <button
                      className="btn btn-ghost"
                      onClick={() => {
                        setEditorOpen(true);
                        setSelectedSetId(null);
                        setAiRejected(0);
                      }}
                    >
                      ＋ {t.setCreate}
                    </button>
                    {aiAvailable && (
                      <button
                        className="btn btn-ghost"
                        onClick={() => {
                          setAiOpen(true);
                          setAiError(null);
                          setSelectedSetId(null);
                          setCustom(null);
                        }}
                      >
                        {t.setAi}
                      </button>
                    )}
                  </div>
                  {!aiAvailable && (
                    <p className="faint" style={{ fontSize: 13 }}>
                      {t.aiUnavailable}
                    </p>
                  )}
                </div>
              )}
              {aiOpen && !editorOpen && (
                <div className="stack">
                  <h2 style={{ fontSize: 20 }}>{t.aiTitle}</h2>
                  <p className="faint" style={{ fontSize: 13 }}>
                    {t.aiHint}
                  </p>
                  <div className="field">
                    <label htmlFor="aitheme">{t.aiThemeLabel}</label>
                    <input
                      id="aitheme"
                      className="input"
                      maxLength={120}
                      placeholder={t.aiThemePlaceholder}
                      value={aiTheme}
                      onChange={(e) => setAiTheme(e.target.value)}
                    />
                  </div>
                  {aiError && (
                    <div className="banner banner-error">{aiError}</div>
                  )}
                  <div className="row">
                    <button
                      className="btn btn-primary"
                      disabled={aiBusy || aiTheme.trim().length < 2}
                      onClick={generateWithAi}
                    >
                      {aiBusy ? t.aiGenerating : t.aiGenerate}
                    </button>
                    <button
                      className="btn btn-ghost"
                      onClick={() => setAiOpen(false)}
                    >
                      {no.common.cancel}
                    </button>
                  </div>
                </div>
              )}
              {editorOpen && (
                <div className="stack">
                  <h2 style={{ fontSize: 20 }}>{t.editorTitle}</h2>
                  {aiRejected > 0 && (
                    <div className="banner banner-info">
                      ✨ {t.aiReviewHint} {t.aiRejectedNote(aiRejected)}
                    </div>
                  )}
                  <div className="field">
                    <label htmlFor="settitle">{t.editorNameLabel}</label>
                    <input
                      id="settitle"
                      className="input"
                      maxLength={80}
                      value={editorTitle}
                      onChange={(e) => setEditorTitle(e.target.value)}
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="setbody">{t.editorHint}</label>
                    <textarea
                      id="setbody"
                      className="input"
                      placeholder={t.editorPlaceholder}
                      value={editorText}
                      onChange={(e) => setEditorText(e.target.value)}
                    />
                  </div>
                  <p
                    className={editorStatements.length >= needed ? "muted" : "faint"}
                    style={{
                      fontSize: 14,
                      color:
                        editorStatements.length >= needed
                          ? "var(--ok)"
                          : "var(--warn)",
                    }}
                  >
                    {t.editorCount(editorStatements.length, needed)}
                  </p>
                  <div className="row">
                    <button
                      className="btn btn-primary"
                      disabled={editorStatements.length === 0}
                      onClick={() => {
                        setCustom({
                          title: editorTitle.trim() || "Eget sett",
                          statements: editorStatements,
                        });
                        setEditorOpen(false);
                      }}
                    >
                      {t.setUse}
                    </button>
                    <button className="btn btn-ghost" onClick={() => setEditorOpen(false)}>
                      {no.common.cancel}
                    </button>
                  </div>
                </div>
              )}
              {custom && !editorOpen && (
                <div className="banner banner-info">
                  ✓ {custom.title} — {t.setStatements(custom.statements.length)}{" "}
                  <button
                    className="btn btn-ghost"
                    style={{ padding: "4px 10px", fontSize: 13, marginLeft: 8 }}
                    onClick={() => setEditorOpen(true)}
                  >
                    Rediger
                  </button>
                </div>
              )}
            </>
          )}

          {step === "rules" && (
            <>
              <h1 style={{ fontSize: 26 }}>{t.stepRules}</h1>
              <div className="field">
                <label>{t.gridLabel}</label>
                <div className="opt-row">
                  {([3, 4, 5] as GridSize[]).map((n) => (
                    <button
                      key={n}
                      className={`opt ${gridSize === n ? "selected" : ""}`}
                      onClick={() => setGridSize(n)}
                    >
                      {n}×{n}
                      {n === 4 && <small>standard</small>}
                    </button>
                  ))}
                </div>
              </div>
              <div className="field">
                <label>{t.winLabel}</label>
                <div className="opt-row">
                  {(
                    [
                      ["line", t.winLine],
                      ["two_lines", t.winTwoLines],
                      ["blackout", t.winBlackout],
                    ] as [WinCondition, string][]
                  ).map(([key, label]) => (
                    <button
                      key={key}
                      className={`opt ${winCondition === key ? "selected" : ""}`}
                      onClick={() => setWinCondition(key)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="field">
                <label>{t.pairLabel}</label>
                <div className="opt-row">
                  {[1, 2, 3].map((n) => (
                    <button
                      key={n}
                      className={`opt ${pairLimit === n ? "selected" : ""}`}
                      onClick={() => setPairLimit(n)}
                    >
                      {n}
                      {n === 1 && <small>anbefalt</small>}
                    </button>
                  ))}
                </div>
                <p className="faint" style={{ fontSize: 13 }}>{t.pairHint}</p>
              </div>
              {gridSize % 2 === 1 && (
                <label className="row" style={{ cursor: "pointer", fontSize: 15 }}>
                  <input
                    type="checkbox"
                    checked={freeCentre}
                    onChange={(e) => setFreeCentre(e.target.checked)}
                    style={{ width: 18, height: 18, accentColor: "var(--gold)" }}
                  />
                  {t.freeCentreLabel}
                </label>
              )}
              <div className="field">
                <label htmlFor="gtitle">{t.titleLabel}</label>
                <input
                  id="gtitle"
                  className="input"
                  maxLength={80}
                  placeholder={t.titlePlaceholder}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>
              {!poolOk && (
                <div className="banner banner-error">
                  {t.poolWarning(poolSize, needed)}
                </div>
              )}
            </>
          )}

          {step === "summary" && (
            <>
              <h1 style={{ fontSize: 26 }}>{t.stepSummary}</h1>
              <table className="table">
                <tbody>
                  <tr>
                    <td className="muted">{t.stepSet}</td>
                    <td style={{ fontWeight: 600 }}>
                      {custom ? custom.title : selectedSet?.title}
                    </td>
                  </tr>
                  <tr>
                    <td className="muted">{t.gridLabel}</td>
                    <td style={{ fontWeight: 600 }}>
                      {gridSize}×{gridSize}
                      {freeCentre && gridSize % 2 === 1 ? " + gratis midtrute" : ""}
                    </td>
                  </tr>
                  <tr>
                    <td className="muted">{t.winLabel}</td>
                    <td style={{ fontWeight: 600 }}>
                      {winCondition === "line"
                        ? t.winLine
                        : winCondition === "two_lines"
                          ? t.winTwoLines
                          : t.winBlackout}
                    </td>
                  </tr>
                  <tr>
                    <td className="muted">{t.pairLabel}</td>
                    <td style={{ fontWeight: 600 }}>{pairLimit}</td>
                  </tr>
                  {title.trim() && (
                    <tr>
                      <td className="muted">{t.titleLabel}</td>
                      <td style={{ fontWeight: 600 }}>{title.trim()}</td>
                    </tr>
                  )}
                </tbody>
              </table>
              {error && <div className="banner banner-error">{error}</div>}
              <button
                className="btn btn-primary btn-lg btn-block"
                disabled={busy}
                onClick={create}
              >
                {busy ? t.creating : t.create}
              </button>
            </>
          )}

          <div className="spread" style={{ marginTop: 6 }}>
            {stepIndex > 0 ? (
              <button
                className="btn btn-ghost"
                onClick={() => setStep(STEPS[stepIndex - 1])}
              >
                ← {t.back}
              </button>
            ) : (
              <span />
            )}
            {step !== "summary" && (
              <div className="row">
                {step === "rules" && poolOk && (
                  <button className="btn btn-ghost" onClick={() => setStep("summary")}>
                    {t.skipDefaults}
                  </button>
                )}
                <button
                  className="btn btn-primary"
                  disabled={!canNext}
                  onClick={() => setStep(STEPS[stepIndex + 1])}
                >
                  {t.next} →
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
