// Registers official source LINKS (per paper_sourcing.md) into source_refs.
// We link, never host. URLs are official sites of record; exact deep paths
// change over time, so verify at pull time (see notes). Idempotent (fixed ids).
//
//   npm run seed:sources   (run after applying migration 006)
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
const admin = { apikey: SVC, Authorization: `Bearer ${SVC}`, "Content-Type": "application/json" };

const VERIFY = "Official source of record. Verify exact download path at pull time (gov URLs change). Link only; do not host. Use for pattern/metadata/keywords; questions + rubric are original.";

const rows = [
  // CBSE — questions + official marking schemes (model answers) + textbook
  { id: "70000000-0000-0000-0000-000000000001", board: "CBSE", kind: "question_paper", title: "CBSE Class XII Physics — Previous Years' Question Papers", official_url: "https://cbseacademic.nic.in/", year: "2015-2025", notes: VERIFY },
  { id: "70000000-0000-0000-0000-000000000002", board: "CBSE", kind: "marking_scheme", title: "CBSE Class XII Physics — Marking Schemes (official model answers)", official_url: "https://cbseacademic.nic.in/", year: "2015-2025", notes: VERIFY + " CBSE's marking scheme is the gold reference for full-mark answers." },
  { id: "70000000-0000-0000-0000-000000000003", board: "CBSE", kind: "question_bank", title: "CBSE Class XII Physics — Sample Papers + Additional Practice Questions (with MS)", official_url: "https://cbseacademic.nic.in/", year: "2015-2026", notes: VERIFY },
  { id: "70000000-0000-0000-0000-000000000004", board: "CBSE", kind: "textbook", title: "NCERT Class 12 Physics (Part I + II)", official_url: "https://ncert.nic.in/textbook.php", year: "current", notes: VERIFY + " NCERT textbook is the syllabus/concept source." },

  // Maharashtra — questions + banks + textbook; NO official marking scheme
  { id: "70000000-0000-0000-0000-000000000011", board: "Maharashtra", kind: "question_paper", title: "MSBSHSE HSC Class XII Physics — Question Papers (subject code 54)", official_url: "https://mahahsscboard.in/", year: "2015-2025", notes: VERIFY + " Public archive is thinner than CBSE; official site is source of record." },
  { id: "70000000-0000-0000-0000-000000000012", board: "Maharashtra", kind: "question_bank", title: "MSCERT / MAA Physics Question Banks (chapter- and type-wise)", official_url: "https://maa.ac.in/", year: "current", notes: VERIFY + " Structured by chapter/question-type; useful for the concept map." },
  { id: "70000000-0000-0000-0000-000000000013", board: "Maharashtra", kind: "textbook", title: "Balbharati / eBalbharati Class 12 Physics", official_url: "https://ebalbharati.in/", year: "current", notes: VERIFY + " Copyrighted (formal licensing policy); facts/keywords only." },
  // Note: Maharashtra has NO official marking scheme — model answers are generated
  // with Claude from official questions and reviewed (kind='model_answer' rows are
  // created by that generation step once official questions are supplied).
];

const res = await fetch(`${SB}/rest/v1/source_refs`, {
  method: "POST",
  headers: { ...admin, Prefer: "resolution=merge-duplicates,return=minimal" },
  body: JSON.stringify(rows),
});
if (!res.ok) {
  console.error(`seed source_refs failed: ${res.status} ${await res.text()}`);
  process.exit(1);
}
console.log(`ok  source_refs: ${rows.length} official source links registered (link-only, not hosted).`);
