// End-to-end proof of the timed attempt flow against a running dev server.
//
//   1. start an attempt (server records started_at + serves a never-repeat set)
//   2. GATE: self-assess BEFORE submit must be rejected (rubric stays hidden)
//   3. answer every question
//   4. submit (locks the attempt)
//   5. self-assess AFTER submit succeeds and returns a score
//   6. LATE: a fresh attempt left past its window submits as late=true
//
// Run the dev server with a short window so the gate/late paths are quick:
//   DEMO_FAST_SECONDS=6 npm run dev
// then:  npm run attempt:demo
//
// In non-production the API resolves the demo student automatically, so no
// auth cookie is needed. Uses fetch/PostgREST (Node 20 friendly).
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
try {
  const txt = readFileSync(join(root, ".env.local"), "utf8");
  for (const line of txt.split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
} catch {}

const SB = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SVC = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BASE = process.env.BASE ?? "http://localhost:3000";
const CH1 = "40000000-0000-0000-0000-000000000001";
const DEMO_EMAIL = "demo.student@boardbodh.test";
const admin = { apikey: SVC, Authorization: `Bearer ${SVC}`, "Content-Type": "application/json" };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function demoUserId() {
  const list = await fetch(`${SB}/auth/v1/admin/users?per_page=200`, { headers: admin }).then((r) => r.json());
  return (list.users ?? []).find((u) => u.email === DEMO_EMAIL)?.id ?? null;
}
async function clearAttempts(userId) {
  if (!userId) return;
  await fetch(`${SB}/rest/v1/attempts?user_id=eq.${userId}`, { method: "DELETE", headers: { ...admin, Prefer: "return=minimal" } });
  await fetch(`${SB}/rest/v1/questions_seen?user_id=eq.${userId}`, { method: "DELETE", headers: { ...admin, Prefer: "return=minimal" } });
}
async function attemptQuestions(attemptId) {
  return fetch(`${SB}/rest/v1/attempt_questions?attempt_id=eq.${attemptId}&select=question_id,position&order=position`, { headers: admin }).then((r) => r.json());
}
async function rubricFor(questionIds) {
  const inList = `(${questionIds.join(",")})`;
  return fetch(`${SB}/rest/v1/rubric_components?question_id=in.${inList}&select=id,question_id,marks`, { headers: admin }).then((r) => r.json());
}
const api = (path, body) =>
  fetch(`${BASE}${path}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined })
    .then(async (r) => ({ status: r.status, json: await r.json().catch(() => ({})) }));

const uid = await demoUserId();
await clearAttempts(uid);

// 1. start
const start = await api(`/api/exams/${CH1}/attempt`);
if (start.status !== 200) throw new Error("start failed: " + JSON.stringify(start.json));
const attemptId = start.json.attemptId;
const aqs = await attemptQuestions(attemptId);
console.log(`1. started attempt ${attemptId.slice(-6)} with ${aqs.length} questions`);

// 2. gate: self-assess before submit must fail
const early = await api(`/api/attempts/${attemptId}/self-assess`, { awards: {} });
console.log(`2. self-assess BEFORE submit -> ${early.status} ${early.json.error ? `("${early.json.error}")` : ""} ${early.status === 400 ? "[GATE OK]" : "[GATE FAIL]"}`);

// 3. answer everything
for (const aq of aqs) {
  await api(`/api/attempts/${attemptId}/answer`, { questionId: aq.question_id, answer: "Demo answer" });
}
console.log(`3. answered ${aqs.length} questions`);

// 4. submit
const sub = await api(`/api/attempts/${attemptId}/submit`);
console.log(`4. submit -> ${sub.status} status=${sub.json.status} late=${sub.json.late}`);

// 5. self-assess after submit (award full marks on every component)
const rubric = await rubricFor(aqs.map((a) => a.question_id));
const awards = {};
for (const rc of rubric) awards[rc.id] = Number(rc.marks);
const assess = await api(`/api/attempts/${attemptId}/self-assess`, { awards });
console.log(`5. self-assess AFTER submit -> ${assess.status} score=${assess.json.selfScore}/${assess.json.maxMarks}`);

// 6. late path: a fresh attempt, wait past the (short) window, then submit
const fast = Number(process.env.DEMO_FAST_SECONDS ?? 0);
if (fast > 0 && fast <= 20) {
  const s2 = await api(`/api/exams/${CH1}/attempt`);
  if (s2.status === 200) {
    console.log(`6. started attempt ${s2.json.attemptId.slice(-6)}, waiting ${fast + 1}s past the window…`);
    await sleep((fast + 1) * 1000);
    const late = await api(`/api/attempts/${s2.json.attemptId}/submit`);
    console.log(`   submit after window -> status=${late.json.status} late=${late.json.late} ${late.json.late ? "[LATE OK]" : ""}`);
  }
} else {
  console.log("6. (set DEMO_FAST_SECONDS=6 on the dev server to also exercise the late/timeout path)");
}
console.log("\ndone");
