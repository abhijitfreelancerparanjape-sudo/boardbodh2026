import Link from "next/link";
import { redirect } from "next/navigation";
import { getStudentId } from "@/lib/auth/student";
import { getReview } from "@/lib/attempts/attempt";
import { ReviewSelfAssess } from "./review-client";

export const dynamic = "force-dynamic";

export default async function ReviewPage({
  params,
}: {
  params: Promise<{ attemptId: string }>;
}) {
  const { attemptId } = await params;
  const userId = await getStudentId();

  if (!userId) {
    return (
      <main className="mx-auto flex min-h-screen max-w-2xl flex-col items-center justify-center px-6 text-center">
        <h1 className="font-display text-3xl text-ink">Sign in to view this</h1>
        <Link href="/dashboard" className="mt-4 text-sm text-terracotta underline-offset-4 hover:underline">
          Back to your progression
        </Link>
      </main>
    );
  }

  let review;
  try {
    review = await getReview({ attemptId, userId });
  } catch (e) {
    if ((e as Error).message === "Attempt not submitted yet") {
      redirect(`/attempt/${attemptId}`);
    }
    return (
      <main className="mx-auto flex min-h-screen max-w-2xl flex-col items-center justify-center px-6 text-center">
        <h1 className="font-display text-3xl text-ink">Attempt not found</h1>
        <Link href="/dashboard" className="mt-4 text-sm text-terracotta underline-offset-4 hover:underline">
          Back to your progression
        </Link>
      </main>
    );
  }

  return (
    <ReviewSelfAssess
      attemptId={attemptId}
      examName={review.exam.name}
      late={review.late}
      maxMarks={review.maxMarks}
      autoScoreTotal={review.autoScoreTotal}
      finalized={review.finalized}
      finalTotal={review.finalized ? (review.attempt.auto_score ?? 0) + (review.selfScoreTotal ?? 0) : null}
      weakConcepts={review.weakConcepts}
      questions={review.questions.map((q) => ({
        attemptQuestionId: q.attemptQuestionId,
        prompt: q.question.prompt,
        format: q.question.question_format,
        marks: q.max,
        answer: q.answer,
        isAuto: q.isAuto,
        correct: q.correct,
        correctAnswer: q.correctAnswer,
        awarded: q.awarded,
        rubric: q.rubric.map((rc) => ({
          id: rc.id,
          text: rc.text,
          criticality: rc.criticality,
          marks: Number(rc.marks),
        })),
        selfScores: q.selfScores,
      }))}
    />
  );
}
