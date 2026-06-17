"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/client/api";
import { identity } from "@/lib/client/identity";
import { QuestionSetSummary } from "@/lib/dto";
import { DEFAULT_QUIZ_CONFIG, PointsMode } from "@/lib/quiz-types";
import { no } from "@/lib/locale/no";

const t = no.quiz;

interface DraftQuestion {
  prompt: string;
  options: [string, string, string, string];
  correctIndex: number;
}

function emptyQuestion(): DraftQuestion {
  return { prompt: "", options: ["", "", "", ""], correctIndex: 0 };
}

function isComplete(q: DraftQuestion): boolean {
  return (
    q.prompt.trim().length > 0 &&
    q.options.every((o) => o.trim().length > 0) &&
    q.correctIndex >= 0 &&
    q.correctIndex <= 3
  );
}

type Step = "set" | "rules" | "summary";
const STEPS: Step[] = ["set", "rules", "summary"];

export function QuizWizard({ onBack }: { onBack: () => void }) {
  const router = useRouter();
  const [step, setStep] = useState<Step>("set");
  const [sets, setSets] = useState<QuestionSetSummary[] | null>(null);
  const [selectedSetId, setSelectedSetId] = useState<string | null>(null);
  const [preview, setPreview] = useState<Record<string, string[]>>({});
  const [custom, setCustom] = useState<DraftQuestion[] | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [draft, setDraft] = useState<DraftQuestion[]>([emptyQuestion()]);
  const [perQuestionSeconds, setPerQuestionSeconds] = useState(
    DEFAULT_QUIZ_CONFIG.perQuestionSeconds,
  );
  const [pointsMode, setPointsMode] = useState<PointsMode>(
    DEFAULT_QUIZ_CONFIG.pointsMode,
  );
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .listQuestionSets()
      .then((r) => setSets(r.sets))
      .catch(() => setSets([]));
  }, []);

  const completeDraft = useMemo(() => draft.filter(isComplete), [draft]);
  const selectedSet = sets?.find((s) => s.id === selectedSetId) ?? null;
  const haveQuestions = custom ? custom.length > 0 : selectedSet !== null;

  const loadPreview = async (id: string) => {
    if (preview[id]) return;
    try {
      const detail = await api.getQuestionSet(id);
      setPreview((p) => ({
        ...p,
        [id]: detail.questions.slice(0, 3).map((q) => q.prompt),
      }));
    } catch {}
  };

  const create = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await api.createQuizGame({
        title: title.trim(),
        quizConfig: { perQuestionSeconds, pointsMode },
        questionSet: custom
          ? {
              title: title.trim() || "Eget sett",
              questions: custom.map((q) => ({
                prompt: q.prompt.trim(),
                options: q.options.map((o) => o.trim()),
                correctIndex: q.correctIndex,
              })),
            }
          : { id: selectedSetId! },
      });
      identity.saveHostCode(res.gameId, res.hostCode);
      router.push(`/host/${res.gameId}`);
    } catch (err) {
      const code = (err as Error).message;
      setError(code === "pool_too_small" ? t.needOne : no.common.error);
      setBusy(false);
    }
  };

  const stepIndex = STEPS.indexOf(step);
  const canNext = step === "set" ? haveQuestions : true;

  return (
    <main className="center-screen" style={{ alignItems: "flex-start", paddingTop: 40 }}>
      <div className="stack" style={{ width: "100%", maxWidth: 620 }}>
        <div className="spread">
          <Link href="/" className="brandmark">
            <span className="glyph">▦</span>Sunday<b>Quiz</b>
          </Link>
          <span className="muted" style={{ fontSize: 14 }}>{t.modeQuiz}</span>
        </div>

        <div className="wizard-progress">
          {STEPS.map((s, i) => (
            <span key={s} className={i <= stepIndex ? "done" : ""} />
          ))}
        </div>

        <div className="card stack">
          {step === "set" && (
            <>
              <h1 style={{ fontSize: 26 }}>{t.stepQuestionSet}</h1>
              {sets === null && <p className="muted">{no.common.loading}</p>}
              {!editorOpen && (
                <div className="stack" style={{ gap: 10 }}>
                  {(sets ?? []).map((s) => (
                    <button
                      key={s.id}
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
                          {t.questionCount(s.questionCount)}
                        </span>
                      </div>
                      {selectedSetId === s.id && preview[s.id] && (
                        <p className="preview" style={{ marginTop: 8 }}>
                          {preview[s.id].join(" · ")} …
                        </p>
                      )}
                    </button>
                  ))}
                  <button
                    className="btn btn-ghost"
                    onClick={() => {
                      setEditorOpen(true);
                      setSelectedSetId(null);
                    }}
                  >
                    ＋ {t.editorTitle}
                  </button>
                  {custom && (
                    <div className="banner banner-info">
                      ✓ {t.questionCount(custom.length)}{" "}
                      <button
                        className="btn btn-ghost"
                        style={{ padding: "4px 10px", fontSize: 13, marginLeft: 8 }}
                        onClick={() => {
                          setDraft(
                            custom.map((q) => ({
                              prompt: q.prompt,
                              options: [...q.options] as [string, string, string, string],
                              correctIndex: q.correctIndex,
                            })),
                          );
                          setEditorOpen(true);
                        }}
                      >
                        Rediger
                      </button>
                    </div>
                  )}
                </div>
              )}
              {editorOpen && (
                <div className="stack">
                  <h2 style={{ fontSize: 20 }}>{t.editorTitle}</h2>
                  <p className="faint" style={{ fontSize: 13.5 }}>{t.editorHint}</p>
                  {draft.map((q, qi) => (
                    <div key={qi} className="card stack" style={{ gap: 8 }}>
                      <div className="spread">
                        <span className="eyebrow">{t.promptLabel} {qi + 1}</span>
                        {draft.length > 1 && (
                          <button
                            className="btn btn-ghost"
                            style={{ padding: "2px 8px", fontSize: 12 }}
                            onClick={() =>
                              setDraft((d) => d.filter((_, i) => i !== qi))
                            }
                          >
                            {t.removeQuestion}
                          </button>
                        )}
                      </div>
                      <input
                        className="input"
                        placeholder={t.promptLabel}
                        maxLength={300}
                        value={q.prompt}
                        onChange={(e) =>
                          setDraft((d) =>
                            d.map((x, i) => (i === qi ? { ...x, prompt: e.target.value } : x)),
                          )
                        }
                      />
                      {q.options.map((opt, oi) => (
                        <label key={oi} className="row" style={{ gap: 8 }}>
                          <input
                            type="radio"
                            name={`correct-${qi}`}
                            checked={q.correctIndex === oi}
                            onChange={() =>
                              setDraft((d) =>
                                d.map((x, i) => (i === qi ? { ...x, correctIndex: oi } : x)),
                              )
                            }
                            style={{ accentColor: "var(--ok)" }}
                            aria-label={t.markCorrect}
                          />
                          <input
                            className="input"
                            placeholder={t.optionLabel(oi + 1)}
                            maxLength={120}
                            value={opt}
                            onChange={(e) =>
                              setDraft((d) =>
                                d.map((x, i) =>
                                  i === qi
                                    ? {
                                        ...x,
                                        options: x.options.map((o, j) =>
                                          j === oi ? e.target.value : o,
                                        ) as [string, string, string, string],
                                      }
                                    : x,
                                ),
                              )
                            }
                          />
                        </label>
                      ))}
                    </div>
                  ))}
                  <button
                    className="btn btn-ghost"
                    onClick={() => setDraft((d) => [...d, emptyQuestion()])}
                  >
                    ＋ {t.addQuestion}
                  </button>
                  <div className="row">
                    <button
                      className="btn btn-primary"
                      disabled={completeDraft.length === 0}
                      onClick={() => {
                        setCustom(completeDraft);
                        setEditorOpen(false);
                      }}
                    >
                      {no.common.confirm}
                    </button>
                    <button className="btn btn-ghost" onClick={() => setEditorOpen(false)}>
                      {no.common.cancel}
                    </button>
                  </div>
                  {completeDraft.length === 0 && (
                    <p className="faint" style={{ fontSize: 13, color: "var(--warn)" }}>
                      {t.needOne}
                    </p>
                  )}
                </div>
              )}
            </>
          )}

          {step === "rules" && (
            <>
              <h1 style={{ fontSize: 26 }}>{no.wizard.stepRules}</h1>
              <div className="field">
                <label>{t.perQuestionLabel}</label>
                <div className="opt-row">
                  {[10, 20, 30, 45].map((n) => (
                    <button
                      key={n}
                      className={`opt ${perQuestionSeconds === n ? "selected" : ""}`}
                      onClick={() => setPerQuestionSeconds(n)}
                    >
                      {n} s
                      {n === 20 && <small>standard</small>}
                    </button>
                  ))}
                </div>
              </div>
              <div className="field">
                <label>{t.pointsLabel}</label>
                <div className="opt-row">
                  {(
                    [
                      ["speed", t.pointsSpeed],
                      ["flat", t.pointsFlat],
                    ] as [PointsMode, string][]
                  ).map(([key, label]) => (
                    <button
                      key={key}
                      className={`opt ${pointsMode === key ? "selected" : ""}`}
                      onClick={() => setPointsMode(key)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="field">
                <label htmlFor="gtitle">{no.wizard.titleLabel}</label>
                <input
                  id="gtitle"
                  className="input"
                  maxLength={80}
                  placeholder={no.wizard.titlePlaceholder}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>
            </>
          )}

          {step === "summary" && (
            <>
              <h1 style={{ fontSize: 26 }}>{no.wizard.stepSummary}</h1>
              <table className="table">
                <tbody>
                  <tr>
                    <td className="muted">{t.stepQuestionSet}</td>
                    <td style={{ fontWeight: 600 }}>
                      {custom
                        ? t.questionCount(custom.length)
                        : selectedSet?.title}
                    </td>
                  </tr>
                  <tr>
                    <td className="muted">{t.perQuestionLabel}</td>
                    <td style={{ fontWeight: 600 }}>{perQuestionSeconds} s</td>
                  </tr>
                  <tr>
                    <td className="muted">{t.pointsLabel}</td>
                    <td style={{ fontWeight: 600 }}>
                      {pointsMode === "speed" ? t.pointsSpeed : t.pointsFlat}
                    </td>
                  </tr>
                  {title.trim() && (
                    <tr>
                      <td className="muted">{no.wizard.titleLabel}</td>
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
                {busy ? no.wizard.creating : no.wizard.create}
              </button>
            </>
          )}

          <div className="spread" style={{ marginTop: 6 }}>
            {stepIndex > 0 ? (
              <button className="btn btn-ghost" onClick={() => setStep(STEPS[stepIndex - 1])}>
                ← {no.wizard.back}
              </button>
            ) : (
              <button className="btn btn-ghost" onClick={onBack}>
                ← {no.wizard.back}
              </button>
            )}
            {step !== "summary" && (
              <button
                className="btn btn-primary"
                disabled={!canNext}
                onClick={() => setStep(STEPS[stepIndex + 1])}
              >
                {no.wizard.next} →
              </button>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
