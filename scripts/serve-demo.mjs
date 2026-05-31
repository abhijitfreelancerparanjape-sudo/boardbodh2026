// Demonstrates never-repeat serving end-to-end against a running dev server.
//
//   1. ensure a demo auth user exists (Supabase admin API)
//   2. clear that user's questions_seen so the demo is repeatable
//   3. POST /api/exams/{CHAPTER_1}/serve twice
//   4. show that serve #2 returns a DIFFERENT set (seen excluded)
//
// Requires the dev server running (npm run dev) and BASE pointing at it.
// Uses fetch/PostgREST so it runs on Node 20.
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

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SVC = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BASE = process.env.BASE ?? "http://localhost:3000";
const CHAPTER_1_EXAM = "40000000-0000-0000-0000-000000000001";
const DEMO_EMAIL = "demo.student@boardbodh.test";

const admin = { apikey: SVC, Authorization: `Bearer ${SVC}`, "Content-Type": "application/json" };

async function ensureDemoUser() {
  // Try to find the user first.
  const list = await fetch(`${URL}/auth/v1/admin/users?per_page=200`, { headers: admin }).then((r) => r.json());
  const found = (list.users ?? []).find((u) => u.email === DEMO_EMAIL);
  if (found) return found.id;
  const created = await fetch(`${URL}/auth/v1/admin/users`, {
    method: "POST",
    headers: admin,
    body: JSON.stringify({ email: DEMO_EMAIL, password: "demo-password-123", email_confirm: true }),
  }).then((r) => r.json());
  if (!created.id) throw new Error("could not create demo user: " + JSON.stringify(created));
  return created.id;
}

async function clearSeen(userId) {
  const res = await fetch(`${URL}/rest/v1/questions_seen?user_id=eq.${userId}`, {
    method: "DELETE",
    headers: { ...admin, Prefer: "return=minimal" },
  });
  if (!res.ok) throw new Error("clear seen failed: " + (await res.text()));
}

async function serve(userId) {
  const res = await fetch(`${BASE}/api/exams/${CHAPTER_1_EXAM}/serve`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(`serve failed ${res.status}: ${JSON.stringify(json)}`);
  return json;
}

async function seenCount(userId) {
  const res = await fetch(`${URL}/rest/v1/questions_seen?user_id=eq.${userId}&select=question_id`, {
    headers: { ...admin, Prefer: "count=exact" },
  });
  return res.headers.get("content-range");
}

const userId = await ensureDemoUser();
console.log("demo user:", userId);
await clearSeen(userId);

const a = await serve(userId);
const idsA = a.questions.map((q) => q.id);
console.log(`\nserve #1: "${a.examName}" -> ${a.count} of ${a.requested} (available ${a.available})`);
console.log("  ids:", idsA.map((s) => s.slice(-4)).join(", "));

const b = await serve(userId);
const idsB = b.questions.map((q) => q.id);
console.log(`\nserve #2: ${b.count} of ${b.requested} (available ${b.available})`);
console.log("  ids:", idsB.map((s) => s.slice(-4)).join(", "));

const overlap = idsA.filter((id) => idsB.includes(id));
console.log(`\noverlap between serve #1 and #2: ${overlap.length} (expect 0 = never-repeat works)`);
console.log("questions_seen content-range:", await seenCount(userId));
console.log(overlap.length === 0 ? "\nPASS: no repeats" : "\nFAIL: repeats found");
