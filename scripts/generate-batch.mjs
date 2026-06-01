// Pilot batch generation: ~PER_CONCEPT board-style questions for every concept,
// at one band/board, via the real Claude API. Mirrors lib/anthropic/generate.ts
// (fetch, Node-safe). Inserts drafts + rubric, logs cost, and STOPS if cumulative
// cost crosses CAP_INR so it cannot run away on the customer's bill.
//
//   npm run generate:batch
//
// Tune with env: GEN_BAND, GEN_BOARD, GEN_PER_CONCEPT, GEN_CAP_INR.
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
const KEY = process.env.ANTHROPIC_API_KEY;
const MODEL = process.env.ANTHROPIC_MODEL || "claude-opus-4-8";
const USD_TO_INR = Number(process.env.USD_TO_INR || "88");
const BAND = process.env.GEN_BAND || "board_level";
const BOARD = process.env.GEN_BOARD || "CBSE";
const PER_CONCEPT = Number(process.env.GEN_PER_CONCEPT || "2");
const CAP_INR = Number(process.env.GEN_CAP_INR || "30");
if (!KEY) { console.error("ANTHROPIC_API_KEY missing"); process.exit(1); }

const BAND_SCORE = { foundational: 0.3, board_level: 0.6, advanced: 0.85 };
const FREE_TEXT = ["short", "long", "compare_contrast"];
const PRICING = { "claude-opus-4-8": { input: 5, output: 25 }, "claude-sonnet-4-6": { input: 3, output: 15 }, "claude-haiku-4-5": { input: 1, output: 5 } };
const admin = { apikey: SVC, Authorization: `Bearer ${SVC}`, "Content-Type": "application/json" };
const rest = (p, o = {}) => fetch(`${SB}/rest/v1/${p}`, { headers: admin, ...o });

const cost = (u) => {
  const p = PRICING[MODEL] ?? PRICING["claude-opus-4-8"]; const i = p.input / 1e6, o = p.output / 1e6;
  return (u.input_tokens ?? 0) * i + (u.cache_creation_input_tokens ?? 0) * i * 1.25 + (u.cache_read_input_tokens ?? 0) * i * 0.1 + (u.output_tokens ?? 0) * o;
};
const flagOf = (q, marks) => {
  if (q.flag_reason?.trim()) return { level: "warn", reason: q.flag_reason.trim() };
  if (marks <= 0) return { level: "warn", reason: "Rubric marks sum to zero." };
  if (!FREE_TEXT.includes(q.question_format)) {
    const k = q.rubric[0]?.text?.trim();
    if (!k) return { level: "warn", reason: "Objective question has no answer key." };
    if (q.question_format === "mcq" && !q.options.some((o) => o.trim() === k)) return { level: "warn", reason: "MCQ answer key does not match any option." };
  }
  return null;
};

const SYSTEM = `You are an expert Std 12 Physics paper setter for Indian boards. Write ORIGINAL ${BOARD} board-style questions and marking schemes; never copy a real past-paper question. The question's marks equal the SUM of its rubric component marks. mcq: 4 options, single rubric component "text" equals the correct option string exactly (with its "A) " prefix). true_false: options ["True","False"], rubric text exactly "True"/"False". numerical: rubric text is the exact answer with unit. short/long: multiple weighted rubric components (criticality high/medium/low). keywords = must-use terms. flag_reason = why a human should review, else "". Plain text math (/ and ^), no LaTeX.`;
const SCHEMA = { type: "object", additionalProperties: false, properties: { questions: { type: "array", items: { type: "object", additionalProperties: false, properties: { question_format: { type: "string", enum: ["mcq", "true_false", "numerical", "short", "long"] }, prompt: { type: "string" }, options: { type: "array", items: { type: "string" } }, keywords: { type: "array", items: { type: "string" } }, rubric: { type: "array", items: { type: "object", additionalProperties: false, properties: { text: { type: "string" }, criticality: { type: "string", enum: ["high", "medium", "low"] }, marks: { type: "number" } }, required: ["text", "criticality", "marks"] } }, flag_reason: { type: "string" } }, required: ["question_format", "prompt", "options", "keywords", "rubric", "flag_reason"] } } }, required: ["questions"] };

const concepts = await rest(`concepts?select=id,name,chapter:chapters(name,sequence_index)&order=created_at`).then((r) => r.json());
console.log(`Pilot: ${PER_CONCEPT} ${BAND} ${BOARD} question(s) for each of ${concepts.length} concepts. Cap ₹${CAP_INR}.\n`);

let totalCost = 0, totalGen = 0, calls = 0, flagged = 0;
for (const c of concepts) {
  if (totalCost * USD_TO_INR >= CAP_INR) { console.log(`\nCost cap ₹${CAP_INR} reached — stopping (remaining concepts skipped).`); break; }
  const chapterName = (Array.isArray(c.chapter) ? c.chapter[0] : c.chapter)?.name ?? "";
  const USER = `Generate ${PER_CONCEPT} original ${BOARD} Std 12 Physics questions for concept "${c.name}" (chapter "${chapterName}") at the ${BAND} band. Match ${BOARD} paper structure/style. Return the required JSON.`;
  let json;
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({ model: MODEL, max_tokens: 16000, thinking: { type: "adaptive" }, system: [{ type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } }], output_config: { format: { type: "json_schema", schema: SCHEMA } }, messages: [{ role: "user", content: USER }] }),
    });
    json = await res.json();
    if (!res.ok) throw new Error(JSON.stringify(json.error ?? json));
  } catch (e) {
    console.log(`  ${c.name}: ERROR ${e.message}`);
    await rest("ai_generation_usage", { method: "POST", headers: { ...admin, Prefer: "return=minimal" }, body: JSON.stringify({ model: MODEL, concept_id: c.id, difficulty_band: BAND, board: BOARD, requested: PER_CONCEPT, generated: 0, status: "error", error: e.message.slice(0, 500) }) });
    calls++; continue;
  }
  const u = json.usage; const parsed = JSON.parse(json.content.find((b) => b.type === "text").text);
  const callCost = cost(u); totalCost += callCost; calls++;
  await rest("ai_generation_usage", { method: "POST", headers: { ...admin, Prefer: "return=minimal" }, body: JSON.stringify({ model: MODEL, concept_id: c.id, difficulty_band: BAND, board: BOARD, requested: PER_CONCEPT, generated: parsed.questions.length, input_tokens: u.input_tokens ?? 0, output_tokens: u.output_tokens ?? 0, cache_creation_tokens: u.cache_creation_input_tokens ?? 0, cache_read_tokens: u.cache_read_input_tokens ?? 0, cost_usd: Number(callCost.toFixed(6)), cost_inr: Number((callCost * USD_TO_INR).toFixed(2)), status: "success" }) });
  for (const q of parsed.questions) {
    const marks = q.rubric.reduce((s, x) => s + Number(x.marks || 0), 0);
    const flag = flagOf(q, marks); if (flag) flagged++;
    const qrow = (await rest("questions", { method: "POST", headers: { ...admin, Prefer: "return=representation" }, body: JSON.stringify({ concept_id: c.id, board_style: BOARD, question_format: q.question_format, prompt: q.prompt, options: q.options?.length ? q.options : null, marks, keywords: q.keywords ?? [], difficulty_band: BAND, difficulty_score: BAND_SCORE[BAND], source: "generated", status: "draft", review_flag: flag }) }).then((r) => r.json()))[0];
    await rest("rubric_components", { method: "POST", headers: { ...admin, Prefer: "return=minimal" }, body: JSON.stringify(q.rubric.map((x, i) => ({ question_id: qrow.id, text: x.text, criticality: x.criticality, marks: x.marks, sort_order: i }))) });
    totalGen++;
  }
  console.log(`  ${c.name}: +${parsed.questions.length} (₹${(callCost * USD_TO_INR).toFixed(2)})  [running ₹${(totalCost * USD_TO_INR).toFixed(2)}]`);
}
console.log(`\nDONE — ${totalGen} drafts from ${calls} calls. ${flagged} flagged. Cost: $${totalCost.toFixed(4)} (~₹${(totalCost * USD_TO_INR).toFixed(2)}).`);
