"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { CRITICALITY_LABEL, QUESTION_FORMAT_LABEL, type Criticality } from "@/types/db";

interface RubricView {
  id: string;
  text: string;
  criticality: Criticality;
  marks: number;
}
interface ReviewQ {
  attemptQuestionId: string;
  prompt: string;
  format: string;
  marks: number;
  answer: string | null;
  isAuto: boolean;
  correct: boolean | null;
  correctAnswer: string | null;
  awarded: number;
  rubric: RubricView[];
  selfScores: Record<string, number>;
}
interface WeakConcept {
  id: string;
  name: string;
  awarded: number;
  max: number;
  ratio: number;
}

const CRIT_COLOR: Record<Criticality, string> = {
  high: "text-terracotta",
  medium: "text-ink/70",
  low: "text-ink/45",
};

function fmtFormat(f: string) {
  return QUESTION_FORMAT_LABEL[f as keyof typeof QUESTION_FORMAT_LABEL] ?? f;
}

function ScoreView({
  examName,
  total,
  maxMarks,
  weakConcepts,
}: {
  examName: string;
  total: number;
  maxMarks: number;
  weakConcepts: WeakConcept[];
}) {
  const pct = maxMarks > 0 ? Math.round((total / maxMarks) * 100) : 0;
  return (
    <main className="mx-auto max-w-xl px-6 py-16 text-center">
      <p className="text-xs font-medium uppercase tracking-[0.2em] text-sage">Result</p>
      <h1 className="mt-3 font-display text-3xl text-ink">{examName}</h1>
      <div className="mt-8 rounded-3xl bg-ink p-12 text-bone">
        <div className="font-display text-6xl">
          {total}
          <span className="text-3xl text-bone/50">/{maxMarks}</span>
        </div>
        <div className="mt-2 font-mono text-lg text-terracotta">{pct}%</div>
        <div className="mt-5 h-2 overflow-hidden rounded-full bg-bone/15">
          <div className="h-full rounded-full bg-terracotta" style={{ width: `${pct}%` }} />
        </div>
      </div>

      <div className="mt-8 text-left">
        <h2 className="text-xs font-medium uppercase tracking-[0.18em] text-ink/50">
          Focus next on
        </h2>
        {weakConcepts.length === 0 ? (
          <p className="mt-3 rounded-xl border border-sage/30 bg-sage/5 p-4 text-sm text-ink/70">
            No weak concepts in this attempt. Strong work.
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {weakConcepts.map((w) => (
              <li
                key={w.id}
                className="flex items-center justify-between rounded-xl border border-terracotta/30 bg-terracotta/5 px-4 py-3"
              >
                <span className="text-sm font-medium text-ink">{w.name}</span>
                <span className="font-mono text-xs text-terracotta">
                  {w.awarded}/{w.max} ({Math.round(w.ratio * 100)}%)
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <Link
        href="/dashboard"
        className="mt-8 inline-block rounded-full bg-terracotta px-6 py-3 text-sm font-medium text-bone hover:opacity-90"
      >
        Back to your progression
      </Link>
    </main>
  );
}

export function ReviewSelfAssess({
  attemptId,
  examName,
  late,
  maxMarks,
  autoScoreTotal,
  finalized,
  finalTotal,
  weakConcepts,
  questions,
}: {
  attemptId: string;
  examName: string;
  late: boolean;
  maxMarks: number;
  autoScoreTotal: number;
  finalized: boolean;
  finalTotal: number | null;
  weakConcepts: WeakConcept[];
  questions: ReviewQ[];
}) {
  const freeText = useMemo(() => questions.filter((q) => !q.isAuto), [questions]);

  const [awards, setAwards] = useState<Record<string, number>>(() => {
    const init: Record<string, number> = {};
    for (const q of freeText) for (const [cid, m] of Object.entries(q.selfScores)) init[cid] = m;
    return init;
  });
  const [done, setDone] = useState(finalized);
  const [result, setResult] = useState<{ total: number; weak: WeakConcept[] } | null>(
    finalized ? { total: finalTotal ?? 0, weak: weakConcepts } : null
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const totalFreeComponents = useMemo(
    () => freeText.reduce((s, q) => s + q.rubric.length, 0),
    [freeText]
  );
  const markedComponents = Object.keys(awards).length;
  const freeTextRunning = Object.values(awards).reduce((s, m) => s + Number(m || 0), 0);
  const running = autoScoreTotal + freeTextRunning;
  const allMarked = markedComponents >= totalFreeComponents;

  async function finalize() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/attempts/${attemptId}/self-assess`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ awards }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Could not save");
      setResult({ total: json.total, weak: json.weakConcepts ?? [] });
      setDone(true);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  if (done && result) {
    return (
      <ScoreView examName={examName} total={result.total} maxMarks={maxMarks} weakConcepts={result.weak} />
    );
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <div className="rounded-2xl border border-sage/30 bg-sage/5 p-5 text-center">
        <p className="font-display text-xl text-ink">Paper submitted</p>
        <p className="mt-1 text-sm text-ink/60">
          Objective questions are auto-scored. Score yourself on the written answers against the
          rubric, then see your result and weakest concepts.
        </p>
        {late && (
          <span className="mt-3 inline-block rounded-full bg-terracotta/10 px-3 py-1 text-xs text-terracotta">
            Submitted at the time limit
          </span>
        )}
      </div>

      <div className="mt-6 flex items-center justify-between">
        <h1 className="font-display text-2xl text-ink">Review</h1>
        <div className="text-right">
          <div className="font-mono text-2xl text-ink">
            {running}
            <span className="text-base text-ink/40">/{maxMarks}</span>
          </div>
          <div className="text-xs text-ink/50">
            auto {autoScoreTotal} · {markedComponents}/{totalFreeComponents} rubric points marked
          </div>
        </div>
      </div>

      <ol className="mt-6 space-y-5">
        {questions.map((q, i) => (
          <li key={q.attemptQuestionId} className="rounded-2xl border border-ink/10 bg-white/50 p-6">
            <div className="flex items-baseline justify-between gap-4">
              <span className="font-mono text-xs font-medium text-terracotta">Q{i + 1}</span>
              <span className="text-[10px] uppercase tracking-[0.14em] text-ink/45">
                {fmtFormat(q.format)} · {q.marks} marks{q.isAuto ? " · auto" : " · self"}
              </span>
            </div>
            <p className="mt-2 text-[15px] leading-relaxed text-ink">{q.prompt}</p>

            <div className="mt-4 rounded-xl border border-ink/10 bg-bone/50 p-4">
              <div className="text-[10px] uppercase tracking-[0.14em] text-ink/45">Your answer</div>
              <p className="mt-1 whitespace-pre-wrap text-sm text-ink/80">
                {q.answer && q.answer.trim() ? q.answer : "— (left blank)"}
              </p>
            </div>

            {q.isAuto ? (
              <div
                className={`mt-4 flex items-center justify-between rounded-xl border p-4 ${
                  q.correct ? "border-sage/40 bg-sage/5" : "border-terracotta/30 bg-terracotta/5"
                }`}
              >
                <div>
                  <div className="text-[10px] uppercase tracking-[0.14em] text-ink/45">
                    {q.correct ? "Correct" : "Incorrect"} · correct answer
                  </div>
                  <p className="mt-1 text-sm text-ink/80">{q.correctAnswer}</p>
                </div>
                <span
                  className={`shrink-0 font-mono text-sm ${q.correct ? "text-sage" : "text-terracotta"}`}
                >
                  {q.awarded}/{q.marks}
                </span>
              </div>
            ) : (
              <div className="mt-4">
                <div className="text-[10px] uppercase tracking-[0.14em] text-sage">
                  Marking scheme · award yourself marks
                </div>
                <div className="mt-2 space-y-3">
                  {q.rubric.map((rc) => (
                    <div key={rc.id} className="rounded-xl border border-ink/10 p-3">
                      <div className="flex items-start justify-between gap-3">
                        <p className="text-sm text-ink/85">{rc.text}</p>
                        <span
                          className={`shrink-0 text-[10px] font-medium uppercase ${CRIT_COLOR[rc.criticality]}`}
                        >
                          {CRITICALITY_LABEL[rc.criticality]}
                        </span>
                      </div>
                      <div className="mt-2 flex items-center gap-2">
                        <span className="text-xs text-ink/50">Marks ({rc.marks}):</span>
                        {Array.from({ length: rc.marks + 1 }).map((_, m) => (
                          <button
                            key={m}
                            type="button"
                            onClick={() => setAwards((a) => ({ ...a, [rc.id]: m }))}
                            className={`h-8 w-8 rounded-lg border font-mono text-sm ${
                              awards[rc.id] === m
                                ? "border-terracotta bg-terracotta text-bone"
                                : "border-ink/15 text-ink/60"
                            }`}
                          >
                            {m}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </li>
        ))}
      </ol>

      {error && <p className="mt-4 text-sm text-terracotta">{error}</p>}

      <button
        onClick={finalize}
        disabled={!allMarked || saving}
        className="mt-6 w-full rounded-full bg-terracotta px-6 py-3 text-sm font-medium text-bone transition-opacity enabled:hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {saving
          ? "Scoring…"
          : allMarked
            ? "See my result and weak concepts"
            : `Mark all ${totalFreeComponents} written rubric points`}
      </button>
    </main>
  );
}
