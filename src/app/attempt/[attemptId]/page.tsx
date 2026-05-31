import Link from "next/link";
import { redirect } from "next/navigation";
import { getStudentId } from "@/lib/auth/student";
import { getAttemptState } from "@/lib/attempts/attempt";
import { ExamRoom } from "./exam-room";

export const dynamic = "force-dynamic";

export default async function AttemptPage({
  params,
}: {
  params: Promise<{ attemptId: string }>;
}) {
  const { attemptId } = await params;
  const userId = await getStudentId();

  if (!userId) {
    return (
      <main className="mx-auto flex min-h-screen max-w-2xl flex-col items-center justify-center px-6 text-center">
        <h1 className="font-display text-3xl text-ink">Sign in to take an exam</h1>
        <p className="mt-3 text-ink/60">Student sign-in arrives in the next step.</p>
        <Link href="/dashboard" className="mt-4 text-sm text-terracotta underline-offset-4 hover:underline">
          Back to your progression
        </Link>
      </main>
    );
  }

  let state;
  try {
    state = await getAttemptState({ attemptId, userId });
  } catch {
    return (
      <main className="mx-auto flex min-h-screen max-w-2xl flex-col items-center justify-center px-6 text-center">
        <h1 className="font-display text-3xl text-ink">Attempt not found</h1>
        <Link href="/dashboard" className="mt-4 text-sm text-terracotta underline-offset-4 hover:underline">
          Back to your progression
        </Link>
      </main>
    );
  }

  if (state.locked) {
    redirect(`/attempt/${attemptId}/review`);
  }

  return (
    <ExamRoom
      attemptId={attemptId}
      examName={state.exam.name}
      deadlineISO={state.deadlineISO}
      questions={state.questions}
    />
  );
}
