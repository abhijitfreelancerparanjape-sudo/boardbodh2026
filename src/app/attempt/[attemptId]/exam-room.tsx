"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { AttemptQuestionView } from "@/lib/attempts/attempt";
import { QUESTION_FORMAT_LABEL } from "@/types/db";

function fmtClock(s: number): string {
  if (s < 0) s = 0;
  const m = Math.floor(s / 60);
  const x = s % 60;
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(m)}:${p(x)}`;
}

export function ExamRoom({
  attemptId,
  examName,
  deadlineISO,
  questions,
}: {
  attemptId: string;
  examName: string;
  deadlineISO: string;
  questions: AttemptQuestionView[];
}) {
  const router = useRouter();
  const deadline = new Date(deadlineISO).getTime();
  const totalSeconds = Math.max(1, Math.round((deadline - Date.now()) / 1000));
  const [remaining, setRemaining] = useState(() =>
    Math.max(0, Math.floor((deadline - Date.now()) / 1000))
  );
  const [answers, setAnswers] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    for (const q of questions) init[q.question.id] = q.answer ?? "";
    return init;
  });
  const [submitting, setSubmitting] = useState(false);
  const submittedRef = useRef(false);

  const doSubmit = useCallback(async () => {
    if (submittedRef.current) return;
    submittedRef.current = true;
    setSubmitting(true);
    try {
      await fetch(`/api/attempts/${attemptId}/submit`, { method: "POST" });
    } finally {
      router.push(`/attempt/${attemptId}/review`);
    }
  }, [attemptId, router]);

  // Server-authoritative timer: always derived from the fixed deadline, never
  // an accumulating tick. Auto-submits when the window closes.
  useEffect(() => {
    const id = setInterval(() => {
      const r = Math.max(0, Math.floor((deadline - Date.now()) / 1000));
      setRemaining(r);
      if (r <= 0) {
        clearInterval(id);
        doSubmit();
      }
    }, 250);
    return () => clearInterval(id);
  }, [deadline, doSubmit]);

  // Debounced autosave per question.
  const saveTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  function onAnswer(questionId: string, value: string) {
    setAnswers((a) => ({ ...a, [questionId]: value }));
    clearTimeout(saveTimers.current[questionId]);
    saveTimers.current[questionId] = setTimeout(() => {
      fetch(`/api/attempts/${attemptId}/answer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questionId, answer: value }),
      }).catch(() => {});
    }, 600);
  }

  const low = remaining <= 20;
  const pct = Math.max(0, Math.min(100, (remaining / totalSeconds) * 100));

  return (
    <main className="mx-auto max-w-3xl px-6 pb-24">
      {/* Sticky timer bar */}
      <div
        className={`sticky top-0 z-20 -mx-6 mb-6 flex items-center gap-4 border-b px-6 py-4 backdrop-blur ${
          low ? "border-terracotta/40 bg-terracotta/5" : "border-ink/10 bg-bone/80"
        }`}
      >
        <div>
          <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-ink/50">
            Time remaining
          </div>
          <div
            className={`font-mono text-2xl tabular-nums ${low ? "text-terracotta" : "text-ink"}`}
          >
            {fmtClock(remaining)}
          </div>
        </div>
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-ink/10">
          <div
            className={`h-full rounded-full ${low ? "bg-terracotta" : "bg-sage"}`}
            style={{ width: `${pct}%` }}
          />
        </div>
        <button
          onClick={doSubmit}
          disabled={submitting}
          className="rounded-full bg-ink px-5 py-2 text-sm font-medium text-bone transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {submitting ? "Submitting…" : "Submit"}
        </button>
      </div>

      <h1 className="font-display text-2xl tracking-tight text-ink">{examName}</h1>
      <p className="mt-1 text-sm text-ink/55">
        Answer below. Your work autosaves. The marking scheme unlocks after you submit.
      </p>

      <ol className="mt-8 space-y-6">
        {questions.map((q, i) => (
          <li key={q.id} className="rounded-2xl border border-ink/10 bg-white/50 p-6">
            <div className="flex items-baseline justify-between gap-4">
              <span className="font-mono text-xs font-medium text-terracotta">Q{i + 1}</span>
              <span className="text-[10px] uppercase tracking-[0.14em] text-ink/45">
                {QUESTION_FORMAT_LABEL[q.question.question_format]} · {Number(q.question.marks)} marks
              </span>
            </div>
            <p className="mt-2 text-[15px] leading-relaxed text-ink">{q.question.prompt}</p>

            <div className="mt-4">
              <AnswerInput
                format={q.question.question_format}
                options={q.question.options}
                value={answers[q.question.id] ?? ""}
                onChange={(v) => onAnswer(q.question.id, v)}
              />
            </div>
          </li>
        ))}
      </ol>
    </main>
  );
}

function AnswerInput({
  format,
  options,
  value,
  onChange,
}: {
  format: string;
  options: string[] | null;
  value: string;
  onChange: (v: string) => void;
}) {
  if (format === "mcq" && Array.isArray(options)) {
    return (
      <div className="space-y-2">
        {options.map((opt) => (
          <label
            key={opt}
            className={`flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-2.5 text-sm ${
              value === opt ? "border-terracotta bg-terracotta/5 text-ink" : "border-ink/10 text-ink/80"
            }`}
          >
            <input
              type="radio"
              name={`q-${format}-${opt}`}
              checked={value === opt}
              onChange={() => onChange(opt)}
              className="h-4 w-4 accent-terracotta"
            />
            {opt}
          </label>
        ))}
      </div>
    );
  }

  if (format === "true_false") {
    return (
      <div className="flex gap-2">
        {["True", "False"].map((opt) => (
          <button
            key={opt}
            type="button"
            onClick={() => onChange(opt)}
            className={`rounded-full border px-5 py-2 text-sm ${
              value === opt
                ? "border-terracotta bg-terracotta text-bone"
                : "border-ink/15 text-ink/75"
            }`}
          >
            {opt}
          </button>
        ))}
      </div>
    );
  }

  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      rows={format === "long" ? 6 : 3}
      placeholder="Write your answer…"
      className="w-full rounded-xl border border-ink/15 bg-bone/40 p-3 text-sm text-ink outline-none focus:border-sage"
    />
  );
}
