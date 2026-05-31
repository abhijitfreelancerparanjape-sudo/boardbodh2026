// End-to-end proof of the timed attempt flow + scoring + weakness surfacing,
// against a running dev server.
//
//   1. start an attempt (server records started_at + serves a never-repeat set)
//   2. GATE: self-assess BEFORE submit must be rejected (rubric stays hidden)
//   3. answer (objective correctly; free-text with text)
//   4. submit (locks the attempt)
//   5. self-assess free-text (full marks, except one zeroed to create a gap)
//      -> objective auto-scored, total computed, 2-3 weakest concepts surfaced
//
// Run the dev server, then:  npm run attempt:demo
// Uses fetch/PostgREST (Node 20 friendly). Non-prod resolves the demo student.
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
const FREE_TEXT = ["short", "long", "compare_contrast"];
const admin = { apikey: SVC, Authorization: `Bearer ${SVC}`, "Content-Type": "application/json" };

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
async function questionsByIds(ids) {
  const inList = `(${ids.join(",")})`;
  return fetch(`${SB}/rest/v1/questions?id=in.${inList}&select=id,question_format,concept_id`, { headers: admin }).then((r) => r.json());
}
async function rubricByIds(ids) {
  const inList = `(${ids.join(",")})`;
  return fetch(`${SB}/rest/v1/rubric_components?question_id=in.${inList}&select=id,question_id,marks,text`, { headers: admin }).then((r) => r.json());
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
const qIds = aqs.map((a) => a.question_id);
const qs = await questionsByIds(qIds);
const rubric = await rubricByIds(qIds);
const qById = new Map(qs.map((q) => [q.id, q]));
const rubricByQ = new Map();
for (const rc of rubric) rubricByQ.set(rc.question_id, [...(rubricByQ.get(rc.question_id) ?? []), rc]);

const formats = qIds.map((id) => qById.get(id).question_format);
console.log(`1. started attempt ${attemptId.slice(-6)} with ${aqs.length} questions [${formats.join(", ")}]`);

// 2. gate
const early = await api(`/api/attempts/${attemptId}/self-assess`, { awards: {} });
console.log(`2. self-assess BEFORE submit -> ${early.status} ${early.status === 400 ? "[GATE OK]" : "[GATE FAIL]"}`);

// 3. answer. Deliberately get the first two objective questions WRONG so two
//    concepts come out weak; answer the rest correctly / free-text with text.
let wrongCount = 0;
const wrongConceptIds = [];
for (let i = 0; i < qIds.length; i++) {
  const id = qIds[i];
  const q = qById.get(id);
  const isFree = FREE_TEXT.includes(q.question_format);
  let answer;
  if (!isFree && wrongCount < 2) {
    answer = "DELIBERATELY WRONG";
    wrongCount++;
    wrongConceptIds.push(q.concept_id);
  } else {
    answer = isFree ? "Demo written answer." : (rubricByQ.get(id)?.[0]?.text ?? "");
  }
  await api(`/api/attempts/${attemptId}/answer`, { questionId: id, answer });
}
console.log(`3. answered (${wrongCount} objective deliberately wrong, rest correct)`);

// 4. submit
const sub = await api(`/api/attempts/${attemptId}/submit`);
console.log(`4. submit -> status=${sub.json.status} late=${sub.json.late}`);

// 5. self-assess free-text: full marks, except zero the FIRST free-text question (create a gap)
const freeTextQids = qIds.filter((id) => FREE_TEXT.includes(qById.get(id).question_format));
const zeroedQid = freeTextQids[0];
const awards = {};
for (const qid of freeTextQids) {
  for (const rc of rubricByQ.get(qid) ?? []) {
    awards[rc.id] = qid === zeroedQid ? 0 : Number(rc.marks);
  }
}
const assess = await api(`/api/attempts/${attemptId}/self-assess`, { awards });
const j = assess.json;
console.log(`5. scored -> auto=${j.autoScore} self=${j.selfScore} total=${j.total}/${j.maxMarks}`);
if (freeTextQids.length) {
  console.log(`   (${freeTextQids.length} free-text question(s) self-assessed; one zeroed to create a gap)`);
}
console.log("   weakest concepts:");
for (const w of j.weakConcepts ?? []) {
  console.log(`     - ${w.name}: ${w.awarded}/${w.max} (${Math.round(w.ratio * 100)}%)`);
}
console.log((j.weakConcepts ?? []).length ? "\nPASS: weakness surfaced" : "\n(no weakness surfaced)");
