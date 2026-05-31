# Forward Plan — Board Exam Intelligence Platform (post-call)

Following the call with Dhananjay. This supersedes the Class X Silver framing. The product is now Std 12 PCMB, both boards, built as a year-long progression engine.

---

## What changed from the earlier thinking

The product got bigger and more specific at once.

1. Std 12 (not X), PCMB, CBSE + Maharashtra. Higher stakes, higher willingness to pay, harder content.
2. The unit of value moved from one timed paper to a sequenced progression: chapters over 5-7 months → chapter exams → unit tests → terminal exams, deliberately ordered, difficulty climbing toward year-end, ideally never repeating a question per student.
3. Two packages. Part A: content + practice (model content, chapter exams, model answers). Part B: adaptive engine (keep surfacing what the student doesn't know, no repeats).
4. Evaluation boundary made explicit: MCQ and short structured answers auto-score; long paragraph answers stay self-assessed or human-graded for a fee. Full OSM is a someday aspiration, not MVP.
5. Content strategy is IP-defensive: lean on government IP (NCERT, official board papers + marking schemes), generate fresh questions from it, avoid private publishers.

---

## Locked decisions for the MVP

| Decision | Call |
|---|---|
| Subject scope | Physics first. Prove the engine, then clone to Chemistry, Maths, Biology. |
| Boards | CBSE + Maharashtra, both from the start (pattern reference for both). |
| Package | Part A + one Part B mechanic baked in: never repeat a question per student, surface 2-3 weakest concepts after each attempt. Rest of Part B after MVP. |
| Difficulty | Three-band at authoring (foundational / board-level / advanced). Schema carries a `difficulty_score` that recalculates from real attempt data, switching to Dhananjay's historical-percentage model automatically once volume exists. |
| Sequencing | Fixed recommended path for MVP (chapter → unit test → terminal). Stored as data, so reorder becomes a flag later, not a rewrite. |
| Maharashtra model answers | Generate with Claude from official questions. Clean IP, no licensing. |
| Build order | Engine against mock Physics content first, then load real official content. Code-led sprint, not acquisition-blocked. |
| Question IP | Serve original AI-generated questions in board style. Real past papers are the pattern reference behind the scenes, not reproduced verbatim. |

---

## Why these give the most MVP value

Part A alone reads like free PDFs already floating around. Full Part B is unproven and heavy. Part A plus the never-repeat-and-weakness mechanic is what makes it feel like intelligence, and it is cheap: a per-student "questions seen" table plus concept tags already produced at extraction.

The difficulty call matters because the historical-percentage model needs attempt data that doesn't exist on day one. Tag simply now, recalculate continuously, and Dhananjay's model switches on by itself.

A guided fixed path is the product. A new student does not want to design a study plan; they want to be told what is next. Reorder is a power-user feature for later.

Generating Maharashtra answers keeps the entire corpus on government questions plus our own generated answers — the cleanest IP position and exactly the stated strategy. It also means the "buy everything" budget is largely not needed for raw papers (see content pipeline doc); redirect it to compute and any optional licensed reference.

---

## Roadmap

### Phase 0 — Engine on mock Physics (code-led)
- Curriculum model: subject → chapters → concepts (micro-concepts), ordered.
- Exam progression: chapter exam → unit test → terminal, as ordered data per subject.
- Question schema with concept tags, three-band difficulty, `difficulty_score` field.
- Per-student "questions seen" table (never-repeat).
- Attempt + self-score flow (carried over from the Silver prototype, adapted to Std 12).
- Auto-score for MCQ and short structured; self-assess for long answers.
- Post-attempt weakness surfacing (2-3 weakest concepts).

### Phase 1 — Load real official Physics content
- Ingest official CBSE + Maharashtra Physics questions (pattern reference).
- Ingest official CBSE marking schemes (model answers).
- Generate Maharashtra Physics model answers with Claude.
- Generate original board-style questions per concept and difficulty band.
- Human review in the studio before anything goes live (per-question approval, risky ones flagged).

### Phase 2 — Adaptive layer (rest of Part B)
- Turn on `difficulty_score` recalculation from attempt data.
- Weakness-driven question selection (serve more of what the student is weak on).
- Difficulty ramp toward year-end.

### Phase 3 — Clone to Chemistry, Maths, Biology
- Same engine, new content. Each subject is a content-loading exercise, not a rebuild.

### Later (explicitly post-MVP)
- Teacher (human) evaluation of long answers for a fee — the Gold tier.
- Reorderable sequence for power users.
- OSM / full online evaluation — Dhananjay's down-the-road aspiration.

---

## Open inputs needed from Dhananjay
- Confirm Physics-first clone order for the other three subjects.
- Pricing model: per-subject vs PCMB bundle (he floated economy-of-scale on a PCMB package).
- Who reviews and approves generated content for Physics at launch (him, a teacher, or you).
