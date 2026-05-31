"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function BeginExam({ examId }: { examId: string }) {
  const router = useRouter();
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function begin() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/exams/${examId}/attempt`, { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Could not start the attempt");
      router.push(`/attempt/${json.attemptId}`);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <div className="mt-6">
      <label className="flex cursor-pointer items-start gap-3 text-sm text-ink/80">
        <input
          type="checkbox"
          checked={agreed}
          onChange={(e) => setAgreed(e.target.checked)}
          className="mt-0.5 h-4 w-4 accent-terracotta"
        />
        <span>I understand the timer cannot be paused and I will submit within the window.</span>
      </label>

      <button
        onClick={begin}
        disabled={!agreed || busy}
        className="mt-5 w-full rounded-full bg-terracotta px-6 py-3 text-sm font-medium text-bone transition-opacity enabled:hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {busy ? "Starting…" : "Start the clock"}
      </button>

      {error && <p className="mt-3 text-sm text-terracotta">{error}</p>}
    </div>
  );
}
