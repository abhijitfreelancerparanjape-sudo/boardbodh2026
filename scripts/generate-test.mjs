// Live end-to-end check of studio generation (mirrors lib/anthropic/generate.ts
// via fetch, Node-safe). Calls the real Claude API with the prompt template,
// parses the structured output, computes cost, logs ai_generation_usage, and
// inserts draft questions + rubric — so real drafts appear in /studio for review.
//
//   npm run generate:test
//
// Reads ANTHROPIC_API_KEY / MODEL and Supabase service key from .env.local.
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
if (!KEY) { console.error("ANTHROPIC_API_KEY missing in .env.local"); process.exit(1); }

const CONCEPT = "30000000-0000-0000-0000-000000000101"; // Coulomb's Law
const BOARD = "CBSE";
const BAND = "board_level";
const COUNT = 2;
const BAND_SCORE = { foundational: 0.3, board_level: 0.6, advanced: 0.85 };
const FREE_TEXT = ["short", "long", "compare_contrast"];
const PRICING = { "claude-opus-4-8": { input: 5, output: 25 }, "claude-sonnet-4-6": { input: 3, output: 15 }, "claude-haiku-4-5": { input: 1, output: 5 } };

const admin = { apikey: SVC, Authorization: `Bearer ${SVC}`, "Content-Type": "application/json" };
const rest = (path, opts = {}) => fetch(`${SB}/rest/v1/${path}`, { headers: admin, ...opts });

function cost(usage) {
  const p = PRICING[MODEL] ?? PRICING["claude-opus-4-8"];
  const i = p.input / 1e6, o = p.output / 1e6;
  return (usage.input_tokens ?? 0) * i + (usage.cache_creation_input_tokens ?? 0) * i * 1.25 +
    (usage.cache_read_input_tokens ?? 0) * i * 0.1 + (usage.output_tokens ?? 0) * o;
}
function flagOf(q, marks) {
  if (q.flag_reason?.trim()) return { level: "warn", reason: q.flag_reason.trim() };
  if (marks <= 0) return { level: "warn", reason: "Rubric marks sum to zero." };
  if (!FREE_TEXT.includes(q.question_format)) {
    const key = q.rubric[0]?.text?.trim();
    if (!key) return { level: "warn", reason: "Objective question has no answer key." };
    if (q.question_format === "mcq" && !q.options.some((o) => o.trim() === key))
      return { level: "warn", reason: "MCQ answer key does not match any option." };
  }
  return null;
}

const concept = (await rest(`concepts?id=eq.${CONCEPT}&select=name,chapter:chapters(name)`).then(r => r.json()))[0];
const chapterName = (Array.isArray(concept.chapter) ? concept.chapter[0] : concept.chapter)?.name ?? "";

const SYSTEM = `You are an expert Std 12 Physics paper setter for Indian boards. Write ORIGINAL board-style questions and marking schemes; never copy a real past-paper question. The question's marks equal the SUM of its rubric component marks. For mcq: 4 options, and the single rubric component "text" must equal the correct option string exactly (with its "A) " prefix). For true_false: options ["True","False"], rubric text exactly "True"/"False". For numerical: rubric text is the exact answer with unit. For short/long: multiple weighted rubric components (criticality high/medium/low). keywords = must-use terms. flag_reason = why a human should review, else "". Plain text math (/ and ^), no LaTeX.`;
const USER = `Generate ${COUNT} original ${BOARD} Std 12 Physics questions for concept "${concept.name}" (chapter "${chapterName}") at the ${BAND} band. Match CBSE paper structure/style. Return the required JSON.`;

const SCHEMA = { type: "object", additionalProperties: false, properties: { questions: { type: "array", items: { type: "object", additionalProperties: false, properties: { question_format: { type: "string", enum: ["mcq", "true_false", "numerical", "short", "long"] }, prompt: { type: "string" }, options: { type: "array", items: { type: "string" } }, keywords: { type: "array", items: { type: "string" } }, rubric: { type: "array", items: { type: "object", additionalProperties: false, properties: { text: { type: "string" }, criticality: { type: "string", enum: ["high", "medium", "low"] }, marks: { type: "number" } }, required: ["text", "criticality", "marks"] } }, flag_reason: { type: "string" } }, required: ["question_format", "prompt", "options", "keywords", "rubric", "flag_reason"] } } }, required: ["questions"] };

console.log(`Calling ${MODEL} for ${COUNT} questions on "${concept.name}"…`);
const res = await fetch("https://api.anthropic.com/v1/messages", {
  method: "POST",
  headers: { "x-api-key": KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" },
  body: JSON.stringify({
    model: MODEL,
    max_tokens: 16000,
    thinking: { type: "adaptive" },
    system: [{ type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } }],
    output_config: { format: { type: "json_schema", schema: SCHEMA } },
    messages: [{ role: "user", content: USER }],
  }),
});
const json = await res.json();
if (!res.ok) { console.error("Anthropic error:", JSON.stringify(json, null, 2)); process.exit(1); }
const textBlock = json.content.find((b) => b.type === "text");
const parsed = JSON.parse(textBlock.text);
const usage = json.usage;
const costUsd = cost(usage);
console.log(`\nusage: in=${usage.input_tokens} out=${usage.output_tokens} cacheW=${usage.cache_creation_input_tokens ?? 0} cacheR=${usage.cache_read_input_tokens ?? 0}`);
console.log(`cost: $${costUsd.toFixed(4)} (~₹${(costUsd * USD_TO_INR).toFixed(2)})`);
console.log(`generated: ${parsed.questions.length}\n`);

// Log usage
await rest("ai_generation_usage", { method: "POST", headers: { ...admin, Prefer: "return=minimal" }, body: JSON.stringify({
  model: MODEL, concept_id: CONCEPT, difficulty_band: BAND, board: BOARD, requested: COUNT, generated: parsed.questions.length,
  input_tokens: usage.input_tokens ?? 0, output_tokens: usage.output_tokens ?? 0,
  cache_creation_tokens: usage.cache_creation_input_tokens ?? 0, cache_read_tokens: usage.cache_read_input_tokens ?? 0,
  cost_usd: Number(costUsd.toFixed(6)), cost_inr: Number((costUsd * USD_TO_INR).toFixed(2)), status: "success",
}) });

// Insert drafts + rubric
for (const q of parsed.questions) {
  const marks = q.rubric.reduce((s, c) => s + Number(c.marks || 0), 0);
  const flag = flagOf(q, marks);
  console.log(`[${q.question_format} · ${marks} marks]${flag ? " ⚠ " + flag.reason : " ✓"}`);
  console.log(`  ${q.prompt}`);
  if (q.options?.length) q.options.forEach((o) => console.log(`    ${o}`));
  q.rubric.forEach((c) => console.log(`    rubric(${c.criticality},${c.marks}): ${c.text}`));
  const qrow = (await rest("questions", { method: "POST", headers: { ...admin, Prefer: "return=representation" }, body: JSON.stringify({
    concept_id: CONCEPT, board_style: BOARD, question_format: q.question_format, prompt: q.prompt,
    options: q.options?.length ? q.options : null, marks, keywords: q.keywords ?? [], difficulty_band: BAND,
    difficulty_score: BAND_SCORE[BAND], source: "generated", status: "draft", review_flag: flag,
  }) }).then((r) => r.json()))[0];
  const rubricRows = q.rubric.map((c, i) => ({ question_id: qrow.id, text: c.text, criticality: c.criticality, marks: c.marks, sort_order: i }));
  await rest("rubric_components", { method: "POST", headers: { ...admin, Prefer: "return=minimal" }, body: JSON.stringify(rubricRows) });
}
console.log("\ndone — drafts inserted (visible in /studio review queue)");
