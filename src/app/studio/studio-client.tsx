"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { SignOut } from "@/components/sign-out";
import { CRITICALITY_LABEL, QUESTION_FORMAT_LABEL, type Criticality } from "@/types/db";
import type { ConceptOption, DraftQuestion, UsageSummary } from "@/lib/data/studio";

const CRIT_COLOR: Record<Criticality, string> = {
  high: "text-terracotta",
  medium: "text-ink/70",
  low: "text-ink/45",
};

const inr = (n: number) => "₹" + n.toLocaleString("en-IN", { maximumFractionDigits: 2 });
const usd = (n: number) => "$" + n.toFixed(4);

export function Studio({
  adminEmail,
  concepts,
  drafts,
  usage,
}: {
  adminEmail: string;
  concepts: ConceptOption[];
  drafts: DraftQuestion[];
  usage: UsageSummary;
}) {
  const router = useRouter();
  const [conceptId, setConceptId] = useState(concepts[0]?.id ?? "");
  const [board, setBoard] = useState("CBSE");
  const [band, setBand] = useState("board_level");
  const [count, setCount] = useState(5);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function generate() {
    setBusy(true);
    setErr(null);
    setMsg(null);
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conceptId, board, band, count }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Generation failed");
      setMsg(`Drafted ${json.generated} question(s). Cost: ${usd(json.costUsd)} (${inr(json.costInr)}).`);
      router.refresh();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function act(id: string, method: "POST" | "DELETE") {
    setErr(null);
    try {
      const res = await fetch(`/api/studio/questions/${id}`, { method });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? "Action failed");
      router.refresh();
    } catch (e) {
      setErr((e as Error).message);
    }
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <div className="mb-10 flex items-center justify-between">
        <span className="text-sm text-ink/55">Studio · {adminEmail}</span>
        <div className="flex items-center gap-4">
          <Link href="/dashboard" className="text-sm text-ink/55 underline-offset-4 hover:underline">
            Dashboard
          </Link>
          <SignOut />
        </div>
      </div>

      <p className="text-xs font-medium uppercase tracking-[0.2em] text-sage">Content studio</p>
      <h1 className="mt-2 font-display text-4xl tracking-tight text-ink">Draft with AI</h1>
      <p className="mt-3 text-ink/70">
        Generate original board-style questions with Claude. They land as drafts; you approve each
        one before it goes live. Cost is logged per generation.
      </p>

      {/* Generate panel */}
      <section className="mt-8 rounded-2xl border border-ink/10 bg-ink p-6 text-bone">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="text-sm">
            <span className="text-bone/70">Concept</span>
            <select
              value={conceptId}
              onChange={(e) => setConceptId(e.target.value)}
              className="mt-1 w-full rounded-lg border border-bone/20 bg-bone/10 px-3 py-2 text-sm text-bone"
            >
              {concepts.map((c) => (
                <option key={c.id} value={c.id} className="text-ink">
                  {c.chapter} — {c.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            <span className="text-bone/70">Board style</span>
            <select
              value={board}
              onChange={(e) => setBoard(e.target.value)}
              className="mt-1 w-full rounded-lg border border-bone/20 bg-bone/10 px-3 py-2 text-sm text-bone"
            >
              <option className="text-ink" value="CBSE">CBSE</option>
              <option className="text-ink" value="Maharashtra">Maharashtra</option>
            </select>
          </label>
          <label className="text-sm">
            <span className="text-bone/70">Difficulty band</span>
            <select
              value={band}
              onChange={(e) => setBand(e.target.value)}
              className="mt-1 w-full rounded-lg border border-bone/20 bg-bone/10 px-3 py-2 text-sm text-bone"
            >
              <option className="text-ink" value="foundational">Foundational</option>
              <option className="text-ink" value="board_level">Board level</option>
              <option className="text-ink" value="advanced">Advanced</option>
            </select>
          </label>
          <label className="text-sm">
            <span className="text-bone/70">How many</span>
            <input
              type="number"
              min={1}
              max={10}
              value={count}
              onChange={(e) => setCount(Math.max(1, Math.min(10, Number(e.target.value) || 1)))}
              className="mt-1 w-full rounded-lg border border-bone/20 bg-bone/10 px-3 py-2 text-sm text-bone"
            />
          </label>
        </div>
        <button
          onClick={generate}
          disabled={busy || !conceptId}
          className="mt-5 w-full rounded-full bg-terracotta px-6 py-3 text-sm font-medium text-bone transition-opacity enabled:hover:opacity-90 disabled:opacity-50"
        >
          {busy ? "Generating with Claude…" : "Generate draft questions"}
        </button>
        {msg && <p className="mt-3 text-sm text-sage">{msg}</p>}
        {err && <p className="mt-3 text-sm text-terracotta">{err}</p>}
      </section>

      {/* Review queue */}
      <section className="mt-12">
        <h2 className="text-xs font-medium uppercase tracking-[0.18em] text-ink/50">
          Drafts to review · {drafts.length}
        </h2>
        {drafts.length === 0 ? (
          <p className="mt-3 text-sm text-ink/55">No drafts yet. Generate some above.</p>
        ) : (
          <ol className="mt-4 space-y-5">
            {drafts.map((q) => (
              <li key={q.id} className="rounded-2xl border border-ink/10 bg-white/50 p-6">
                <div className="flex items-start justify-between gap-4">
                  <span className="text-[10px] uppercase tracking-[0.14em] text-ink/45">
                    {QUESTION_FORMAT_LABEL[q.question_format]} · {q.difficulty_band} · {q.marks} marks ·{" "}
                    {q.conceptName}
                  </span>
                  {q.flag ? (
                    <span className="shrink-0 rounded-full bg-terracotta/10 px-2 py-0.5 text-[10px] font-medium text-terracotta">
                      ⚠ needs a look
                    </span>
                  ) : (
                    <span className="shrink-0 rounded-full bg-sage/15 px-2 py-0.5 text-[10px] font-medium text-sage">
                      ✓ looks clean
                    </span>
                  )}
                </div>

                <p className="mt-2 text-[15px] leading-relaxed text-ink">{q.prompt}</p>

                {q.options && (
                  <ul className="mt-2 space-y-1 text-sm text-ink/75">
                    {q.options.map((o) => (
                      <li key={o}>{o}</li>
                    ))}
                  </ul>
                )}

                {q.flag && <p className="mt-2 text-sm italic text-terracotta">{q.flag.reason}</p>}

                <div className="mt-3 rounded-xl border border-ink/10 bg-bone/50 p-3">
                  <div className="text-[10px] uppercase tracking-[0.14em] text-sage">Marking scheme</div>
                  <ul className="mt-2 space-y-1.5">
                    {q.rubric.map((rc) => (
                      <li key={rc.id} className="flex items-start justify-between gap-3 text-sm">
                        <span className="text-ink/80">{rc.text}</span>
                        <span className={`shrink-0 text-[10px] font-medium uppercase ${CRIT_COLOR[rc.criticality]}`}>
                          {CRITICALITY_LABEL[rc.criticality]} · {rc.marks}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="mt-4 flex gap-2">
                  <button
                    onClick={() => act(q.id, "POST")}
                    className="rounded-full bg-sage px-4 py-2 text-sm font-medium text-bone hover:opacity-90"
                  >
                    Approve · go live
                  </button>
                  <button
                    onClick={() => act(q.id, "DELETE")}
                    className="rounded-full border border-ink/15 px-4 py-2 text-sm text-ink/70 hover:border-terracotta hover:text-terracotta"
                  >
                    Discard
                  </button>
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>

      {/* Cost log */}
      <section className="mt-12">
        <h2 className="text-xs font-medium uppercase tracking-[0.18em] text-ink/50">
          Generation cost log
        </h2>
        <div className="mt-3 flex flex-wrap gap-4 rounded-2xl border border-ink/10 bg-white/50 p-5">
          <div>
            <div className="font-display text-2xl text-ink">{inr(usage.totalInr)}</div>
            <div className="text-xs text-ink/50">total ({usd(usage.totalUsd)})</div>
          </div>
          <div>
            <div className="font-display text-2xl text-ink">{usage.totalGenerated}</div>
            <div className="text-xs text-ink/50">questions generated</div>
          </div>
          <div>
            <div className="font-display text-2xl text-ink">{usage.calls}</div>
            <div className="text-xs text-ink/50">API calls</div>
          </div>
        </div>

        {usage.rows.length > 0 && (
          <div className="mt-3 overflow-x-auto rounded-2xl border border-ink/10">
            <table className="w-full text-left text-xs">
              <thead className="bg-ink/5 text-ink/55">
                <tr>
                  <th className="px-3 py-2 font-medium">When</th>
                  <th className="px-3 py-2 font-medium">Model</th>
                  <th className="px-3 py-2 font-medium">Band</th>
                  <th className="px-3 py-2 font-medium">Gen</th>
                  <th className="px-3 py-2 font-medium">In/Out tok</th>
                  <th className="px-3 py-2 font-medium">Cost</th>
                </tr>
              </thead>
              <tbody>
                {usage.rows.map((r) => (
                  <tr key={r.id} className="border-t border-ink/10">
                    <td className="px-3 py-2 text-ink/70">{new Date(r.created_at).toLocaleString("en-IN")}</td>
                    <td className="px-3 py-2 text-ink/70">{r.model}</td>
                    <td className="px-3 py-2 text-ink/70">{r.difficulty_band ?? "-"}</td>
                    <td className="px-3 py-2 text-ink/70">
                      {r.generated}/{r.requested}
                      {r.status === "error" ? " (err)" : ""}
                    </td>
                    <td className="px-3 py-2 text-ink/70">
                      {r.input_tokens}/{r.output_tokens}
                    </td>
                    <td className="px-3 py-2 text-ink/70">
                      {inr(Number(r.cost_inr))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="mt-2 text-xs text-ink/40">
          INR is approximate (USD_TO_INR). Totals cover the most recent {usage.calls} calls.
        </p>
      </section>
    </main>
  );
}
