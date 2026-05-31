// Seed mock Physics content for Phase 0.
//
// Idempotent: uses fixed UUIDs and upserts on the primary key, so re-running
// it does not duplicate rows. Writes with the service-role key (bypasses RLS).
// Run with:  npm run seed
//
// Seeds one subject (Physics, CBSE), 3 chapters, a few concepts each, a fixed
// exam sequence (chapter exams -> unit test -> terminal), and a pool of mock
// questions (4 per concept across bands/formats) each with a criticality
// rubric. Questions are clearly templated mock content.
//
// Uses plain fetch against PostgREST (not supabase-js) so it runs on Node 20,
// whose lack of native WebSocket trips supabase-js's realtime client.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

// Load .env.local (no dotenv dependency).
try {
  const txt = readFileSync(join(root, ".env.local"), "utf8");
  for (const line of txt.split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
} catch {
  // fall back to ambient env
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

// Fixed UUIDs so the seed is stable and idempotent.
const SUBJECT = "10000000-0000-0000-0000-000000000001";
const CH1 = "20000000-0000-0000-0000-000000000001";
const CH2 = "20000000-0000-0000-0000-000000000002";
const CH3 = "20000000-0000-0000-0000-000000000003";

const subject = { id: SUBJECT, name: "Physics", board: "CBSE", grade: "XII" };

const chapters = [
  { id: CH1, subject_id: SUBJECT, name: "Electric Charges and Fields", sequence_index: 1 },
  { id: CH2, subject_id: SUBJECT, name: "Electrostatic Potential and Capacitance", sequence_index: 2 },
  { id: CH3, subject_id: SUBJECT, name: "Current Electricity", sequence_index: 3 },
];

const concepts = [
  // Chapter 1
  { id: "30000000-0000-0000-0000-000000000101", chapter_id: CH1, name: "Coulomb's Law" },
  { id: "30000000-0000-0000-0000-000000000102", chapter_id: CH1, name: "Electric Field and Field Lines" },
  { id: "30000000-0000-0000-0000-000000000103", chapter_id: CH1, name: "Gauss's Law" },
  { id: "30000000-0000-0000-0000-000000000104", chapter_id: CH1, name: "Electric Dipole" },
  // Chapter 2
  { id: "30000000-0000-0000-0000-000000000201", chapter_id: CH2, name: "Electric Potential" },
  { id: "30000000-0000-0000-0000-000000000202", chapter_id: CH2, name: "Equipotential Surfaces" },
  { id: "30000000-0000-0000-0000-000000000203", chapter_id: CH2, name: "Capacitance" },
  { id: "30000000-0000-0000-0000-000000000204", chapter_id: CH2, name: "Capacitors and Dielectrics" },
  // Chapter 3
  { id: "30000000-0000-0000-0000-000000000301", chapter_id: CH3, name: "Ohm's Law" },
  { id: "30000000-0000-0000-0000-000000000302", chapter_id: CH3, name: "Drift Velocity and Resistivity" },
  { id: "30000000-0000-0000-0000-000000000303", chapter_id: CH3, name: "Kirchhoff's Laws" },
  { id: "30000000-0000-0000-0000-000000000304", chapter_id: CH3, name: "Wheatstone Bridge" },
];

// Fixed progression. scope carries the chapter ids plus, for serving, the
// difficulty bands and how many questions the instance should contain.
const exams = [
  { id: "40000000-0000-0000-0000-000000000001", subject_id: SUBJECT, kind: "chapter",   name: "Chapter 1 Exam: Electric Charges and Fields",            scope: { chapter_ids: [CH1],            difficulty_bands: ["foundational", "board_level"],  question_count: 5 }, sequence_index: 1, duration_minutes: 30 },
  { id: "40000000-0000-0000-0000-000000000002", subject_id: SUBJECT, kind: "chapter",   name: "Chapter 2 Exam: Electrostatic Potential and Capacitance", scope: { chapter_ids: [CH2],            difficulty_bands: ["foundational", "board_level"],  question_count: 5 }, sequence_index: 2, duration_minutes: 30 },
  { id: "40000000-0000-0000-0000-000000000003", subject_id: SUBJECT, kind: "chapter",   name: "Chapter 3 Exam: Current Electricity",                    scope: { chapter_ids: [CH3],            difficulty_bands: ["foundational", "board_level"],  question_count: 5 }, sequence_index: 3, duration_minutes: 30 },
  { id: "40000000-0000-0000-0000-000000000004", subject_id: SUBJECT, kind: "unit_test", name: "Unit Test 1: Electrostatics and Current",               scope: { chapter_ids: [CH1, CH2, CH3], difficulty_bands: ["board_level"],                  question_count: 6 }, sequence_index: 4, duration_minutes: 60 },
  { id: "40000000-0000-0000-0000-000000000005", subject_id: SUBJECT, kind: "terminal",  name: "Terminal Exam: Chapters 1 to 3",                        scope: { chapter_ids: [CH1, CH2, CH3], difficulty_bands: ["board_level", "advanced"],      question_count: 8 }, sequence_index: 5, duration_minutes: 120 },
];

// Mock questions: 4 per concept across formats/bands, each with a rubric.
const BAND_SCORE = { foundational: 0.3, board_level: 0.6, advanced: 0.85 };

function buildQuestions() {
  const questions = [];
  const rubric = [];
  let qn = 0;
  let rn = 0;
  const qid = () => `50000000-0000-0000-0000-${(++qn).toString(16).padStart(12, "0")}`;
  const rid = () => `60000000-0000-0000-0000-${(++rn).toString(16).padStart(12, "0")}`;

  for (const c of concepts) {
    const templates = [
      {
        question_format: "true_false",
        difficulty_band: "foundational",
        prompt: `State whether the following is true or false, with a one-line justification: "${c.name} applies only in a vacuum."`,
        options: ["True", "False"],
        components: [
          { text: `Correct answer: False, with a sound one-line justification referencing ${c.name}.`, criticality: "high", marks: 1 },
        ],
      },
      {
        question_format: "mcq",
        difficulty_band: "board_level",
        prompt: `Which option best states ${c.name}?`,
        options: ["A) An unrelated definition", "B) The correct standard statement", "C) A common misconception", "D) None of the above"],
        components: [{ text: "Correct option: B", criticality: "high", marks: 1 }],
      },
      {
        question_format: "short",
        difficulty_band: "board_level",
        prompt: `Briefly explain ${c.name} and give one example where it is applied.`,
        options: null,
        components: [
          { text: `States the core idea of ${c.name} correctly.`, criticality: "high", marks: 2 },
          { text: "Gives a valid, relevant example.", criticality: "medium", marks: 1 },
        ],
      },
      {
        question_format: "long",
        difficulty_band: "advanced",
        prompt: `Explain ${c.name} in detail: state the assumptions, derive or justify the key result, and discuss one limitation.`,
        options: null,
        components: [
          { text: `Correct, complete statement of ${c.name} with assumptions.`, criticality: "high", marks: 3 },
          { text: "Correct derivation or justification of the key result.", criticality: "medium", marks: 1 },
          { text: "Discusses a valid limitation or edge case.", criticality: "low", marks: 1 },
        ],
      },
    ];

    for (const t of templates) {
      const id = qid();
      const marks = t.components.reduce((s, x) => s + x.marks, 0);
      questions.push({
        id,
        concept_id: c.id,
        board_style: "CBSE",
        question_format: t.question_format,
        prompt: t.prompt,
        options: t.options,
        marks,
        keywords: [c.name],
        difficulty_band: t.difficulty_band,
        difficulty_score: BAND_SCORE[t.difficulty_band],
        source: "mock",
        status: "live",
      });
      t.components.forEach((comp, i) => {
        rubric.push({ id: rid(), question_id: id, text: comp.text, criticality: comp.criticality, marks: comp.marks, sort_order: i });
      });
    }
  }
  return { questions, rubric };
}

async function up(table, rows) {
  const res = await fetch(`${url}/rest/v1/${table}`, {
    method: "POST",
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      // Upsert on the primary key (rows carry fixed ids), no body echoed back.
      Prefer: "resolution=merge-duplicates,return=minimal",
    },
    body: JSON.stringify(rows),
  });
  if (!res.ok) {
    console.error(`upsert ${table} failed: ${res.status} ${await res.text()}`);
    process.exit(1);
  }
  console.log(`ok  ${table}: ${rows.length} row(s)`);
}

async function main() {
  await up("subjects", [subject]);
  await up("chapters", chapters);
  await up("concepts", concepts);
  await up("exams", exams);
  const { questions, rubric } = buildQuestions();
  await up("questions", questions);
  await up("rubric_components", rubric);
  console.log("seed complete");
}

main();
