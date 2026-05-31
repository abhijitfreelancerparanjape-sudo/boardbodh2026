import Link from "next/link";
import {
  getPrimarySubject,
  getExamSequence,
  getCurriculum,
  getNextExam,
} from "@/lib/data/curriculum";
import { EXAM_KIND_LABEL } from "@/types/db";

// Reads live data per request.
export const dynamic = "force-dynamic";

export default async function Dashboard() {
  const subject = await getPrimarySubject();

  if (!subject) {
    return (
      <main className="mx-auto flex min-h-screen max-w-2xl flex-col items-center justify-center px-6 text-center">
        <h1 className="font-display text-3xl text-ink">No curriculum yet</h1>
        <p className="mt-3 text-ink/70">
          Run <code className="rounded bg-ink/5 px-1.5 py-0.5 text-sm">npm run seed</code> to
          load the mock Physics content.
        </p>
      </main>
    );
  }

  const [exams, curriculum] = await Promise.all([
    getExamSequence(subject.id),
    getCurriculum(subject.id),
  ]);

  // Phase 0: no per-student progress yet, so a fresh student is at index 0.
  const currentExamIndex = 0;
  const nextExam = getNextExam(exams, currentExamIndex);

  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      {/* Header */}
      <div className="flex items-center gap-2">
        <span className="inline-block h-2 w-2 rounded-full bg-sage" />
        <span className="text-xs font-medium uppercase tracking-[0.2em] text-sage">
          {subject.name} · {subject.board} · Class {subject.grade}
        </span>
      </div>
      <h1 className="mt-3 font-display text-4xl tracking-tight text-ink sm:text-5xl">
        Your progression
      </h1>
      <p className="mt-3 text-ink/70">
        A fixed path through the year. Finish each exam to unlock the next.
      </p>

      {/* Next up */}
      {nextExam && (
        <section className="mt-10 rounded-2xl border border-terracotta/30 bg-terracotta/5 p-6">
          <div className="text-xs font-medium uppercase tracking-[0.18em] text-terracotta">
            Next up
          </div>
          <h2 className="mt-2 font-display text-2xl text-ink">{nextExam.name}</h2>
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-ink/70">
            <span>{EXAM_KIND_LABEL[nextExam.kind]}</span>
            <span aria-hidden>·</span>
            <span>{nextExam.duration_minutes} minutes</span>
            <span aria-hidden>·</span>
            <span>
              Step {nextExam.sequence_index} of {exams.length}
            </span>
          </div>
          <Link
            href={`/exam/${nextExam.id}`}
            className="mt-5 inline-block rounded-full bg-ink px-5 py-2 text-sm font-medium text-bone transition-opacity hover:opacity-90"
          >
            Start this exam →
          </Link>
        </section>
      )}

      {/* Full ordered sequence */}
      <section className="mt-12">
        <h3 className="text-xs font-medium uppercase tracking-[0.18em] text-ink/50">
          The sequence
        </h3>
        <ol className="mt-4 space-y-2">
          {exams.map((exam, i) => {
            const isNext = i === currentExamIndex;
            const isDone = i < currentExamIndex;
            return (
              <li
                key={exam.id}
                className={`flex items-center gap-4 rounded-xl border px-4 py-3 ${
                  isNext
                    ? "border-terracotta/40 bg-terracotta/5"
                    : "border-ink/10 bg-white/40"
                }`}
              >
                <span
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-medium ${
                    isNext
                      ? "bg-terracotta text-bone"
                      : isDone
                        ? "bg-sage text-bone"
                        : "bg-ink/10 text-ink/60"
                  }`}
                >
                  {exam.sequence_index}
                </span>
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium text-ink">{exam.name}</div>
                  <div className="text-xs text-ink/55">
                    {EXAM_KIND_LABEL[exam.kind]} · {exam.duration_minutes} min
                  </div>
                </div>
                {isNext && (
                  <span className="ml-auto text-xs font-medium text-terracotta">Next</span>
                )}
              </li>
            );
          })}
        </ol>
      </section>

      {/* Curriculum */}
      <section className="mt-12">
        <h3 className="text-xs font-medium uppercase tracking-[0.18em] text-ink/50">
          Curriculum
        </h3>
        <div className="mt-4 space-y-6">
          {curriculum.map((chapter) => (
            <div key={chapter.id}>
              <div className="font-display text-lg text-ink">
                {chapter.sequence_index}. {chapter.name}
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                {chapter.concepts.map((concept) => (
                  <span
                    key={concept.id}
                    className="rounded-full border border-sage/30 bg-sage/5 px-3 py-1 text-xs text-ink/75"
                  >
                    {concept.name}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      <div className="mt-14">
        <Link href="/" className="text-sm text-ink/50 underline-offset-4 hover:underline">
          ← Back
        </Link>
      </div>
    </main>
  );
}
