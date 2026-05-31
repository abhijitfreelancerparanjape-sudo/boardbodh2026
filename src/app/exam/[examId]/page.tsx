import Link from "next/link";
import { getExamById } from "@/lib/data/curriculum";
import { EXAM_KIND_LABEL } from "@/types/db";
import { BeginExam } from "./begin-exam";

export const dynamic = "force-dynamic";

export default async function ExamRules({
  params,
}: {
  params: Promise<{ examId: string }>;
}) {
  const { examId } = await params;
  const exam = await getExamById(examId);

  if (!exam) {
    return (
      <main className="mx-auto flex min-h-screen max-w-2xl flex-col items-center justify-center px-6 text-center">
        <h1 className="font-display text-3xl text-ink">Exam not found</h1>
        <Link href="/dashboard" className="mt-4 text-sm text-terracotta underline-offset-4 hover:underline">
          Back to your progression
        </Link>
      </main>
    );
  }

  const count = exam.scope?.question_count ?? null;
  const rules: [string, string][] = [
    [`${exam.duration_minutes} minutes`, "The clock starts when you begin and cannot be paused."],
    ["Submit to finish", "Submitting locks your answers. The clock auto-submits at zero."],
    ["Marking scheme stays hidden", "The rubric unlocks only after you submit. No peeking."],
    ["Self-assessment", "You score yourself against each weighted rubric point."],
  ];

  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <Link href="/dashboard" className="text-sm text-ink/50 underline-offset-4 hover:underline">
        ← Back to your progression
      </Link>

      <div className="mt-6 rounded-2xl border border-ink/10 bg-white/50 p-8">
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-sage">Before you begin</p>
        <h1 className="mt-2 font-display text-3xl tracking-tight text-ink">{exam.name}</h1>
        <p className="mt-2 text-sm text-ink/60">
          {EXAM_KIND_LABEL[exam.kind]} · {exam.duration_minutes} minutes
          {count ? ` · ${count} questions` : ""}
        </p>

        <div className="mt-6 space-y-3">
          {rules.map(([head, sub]) => (
            <div key={head} className="flex gap-3 rounded-xl border border-ink/10 bg-bone/60 p-4">
              <span className="mt-1 inline-block h-2 w-2 shrink-0 rounded-full bg-terracotta" />
              <div>
                <div className="text-sm font-medium text-ink">{head}</div>
                <div className="text-sm text-ink/60">{sub}</div>
              </div>
            </div>
          ))}
        </div>

        <BeginExam examId={exam.id} />
      </div>
    </main>
  );
}
