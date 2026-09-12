# Implementation plan

Status as of 2026-09-12. References: PRD (12 Sep 2026), [`SOURCES.md`](SOURCES.md), [`TASKS.md`](TASKS.md), [`AGENTS.md`](AGENTS.md).

---

## Current build status vs PRD

### P0 — submission blockers

| Req | PRD | Status | Notes |
| --- | --- | --- | --- |
| R1 | Capture and transcribe | **Done** | AudioWorklet → 16 kHz PCM WAV; proxy to Dictation API |
| R2 | Ground rewrite vs verbatim | **Done** | `ground.ts` + 12 unit tests; bag diff, not full LCS |
| R3 | Verdict before detail | **Done** | `app.html`: verdict → rewrite → findings → verbatim |
| R4 | Sample case, no API | **Done** | Static payload, labelled "no API call" |
| R5 | Paste mode, no network | **Done** | Browser `ground.js`; two text areas |
| R6 | Copy with guard | **Done** | Two-click on high severity |
| R7 | Documented failure paths | **Done** | Server maps 400/404/413/415/429/503/502/504; null rewrite UI |
| R8 | 15-clip corpus | **Done** | `RESULTS.md`, `corpus-results-15.json`, `manifest-15.csv` |

### P1 — after P0

| Req | PRD | Status | Notes |
| --- | --- | --- | --- |
| R9 | Mishearing vs rewrite | **Done** | `annotateFindings`; threshold 0.5; display only |
| R10 | Space to record | **Done** | Ignores text inputs and copy/paste focus |
| R11 | Connection pre-warming + latency table | **Done** | `POST /api/warm` on record start; table in RESULTS |
| R12 | Too-short swallow, retry header, session logging | **Done** | Client 80 ms floor; `retry_after` on 429/503; session_id logged |

### P2 — deferred

Export findings JSON, diff toggle, per-finding jump-to-source. Items in [`BACKLOG.md`](BACKLOG.md) only.

---

## PRD vs code gaps (honest)

| Topic | PRD says | Code does | Action |
| --- | --- | --- | --- |
| Verifier alignment | Longest-common-subsequence | Token-bag diff after normalisation | Document as known limit; LCS is a future stage with tests |
| Entity taxonomy | S1 categories (names, alphanumeric, domain terms) | Reporting layer via `findingCategory()` | **Done** — detection unchanged; S1 labels in UI |
| Dropped entities | Flag large deletions | Only inserted entities flagged | Known miss (clip-21); documented in RESULTS |
| Invalid key HTTP code | 404 | Server also maps 401 (observed live) | Documented in FEEDBACK + README |
| Keyterms overcorrection experiment | Two clips × two configs | See Stage 6 / RESULTS | `scripts/keyterms-experiment.ts` |
| Spoken-command clip count | PRD §8 lists 2; RESULTS has 3 | 3 clips in 15-clip slice | Acceptable; RESULTS notes sample size |
| AGENTS.md file names | `ground.js`, `server.js` | `ground.ts`, `server.ts` | TypeScript via `--experimental-strip-types`; behaviour unchanged |

---

## AGENTS.md constraints (non-negotiable)

These govern every stage below:

- **No npm install.** Node standard library only (`fetch`, `node:test`, `undici` built-in). No bundler, no React, no Express.
- **No second LLM in the verifier.** `ground()` is deterministic token rules only.
- **Classifier changes need a failing test first.** Do not tune thresholds, severity levels, or word lists in `ground.ts` without a test that fails before and passes after.
- **Do not delete** the "Known false positives" block at the bottom of `ground.ts`; add to it.
- **API key** only in `server.ts` via `process.env.AAI_API_KEY`; never in `public/`, logs, or fixtures.
- **Dictation API only:** `POST https://dictation.assemblyai.com/v1/transcribe/live`; not the main transcription API.
- **TASKS.md is the task queue** for hackathon deliverables; this plan covers PRD extras (SOURCES, README alignment, R11, R12) that sit beside T15 (demo video, human-only).

---

## Ordered stages for remaining work

### Stage 0 — Digest and document ✅

**Files:** `SOURCES.md`, `IMPLEMENTATION_PLAN.md`

Deliverables: source traceability, status table, constraint reminder.

---

### Stage 1 — README alignment ✅

**Files:** `README.md`

Per S2, S4, PRD §3:

- Reference AssemblyAI's entity-accuracy / run-your-own-audio argument without marketing tone.
- Framing: cleanup pass vs recognition; decide deliberately.
- Verifier is small and deterministic on purpose — verdicts can be checked, not trusted.
- Link to `SOURCES.md`, `RESULTS.md`, `FEEDBACK.md`.

---

### Stage 2 — S6 blog read ✅

**Files:** `SOURCES.md` (S6 section)

Fetched [dictation cleanup blog](https://www.assemblyai.com/blog/dictation-cleanup). No RESULTS rewrite needed — S6 confirms the measurement target; see S6 section in SOURCES.

---

### Stage 3 — R11 Connection pre-warming ✅

**Files:** `server.ts`, `public/app.html`, `scripts/measure-warm.ts`, `scripts/transcribe-once.ts`, `RESULTS.md`, `package.json`

---

### Stage 4 — R12 Error handling ✅

**Files:** `server.ts`, `public/app.html`

---

### Stage 5 — S1 entity taxonomy ✅

**Files:** `ground.ts`, `public/ground.js`, `test/ground.test.ts`, `public/app.html`, `README.md`

**Approach taken:** Reporting layer only. Internal `kind` (negation / number / entity) and severity logic unchanged. Added `FindingCategory` type and `findingCategory()` mapping to S1 vocabulary; UI shows S1 labels. Four new unit tests. Full detector rewrite deferred — would need corpus re-validation.

---

### Stage 6 — Keyterms overcorrection experiment ✅

**Files:** `scripts/keyterms-experiment.ts`, `RESULTS.md`, `package.json`

Ran 2026-09-12: `clip-01` and `clip-12`, default `{}` vs 100-word `keyterms_prompt`. No inserted-entity overcorrection observed; clip-12 STT path differed between configs. Documented in RESULTS.

---

### Stage 7 — LCS aligner (deferred)

**Files:** `README.md` (Limitations)

PRD specifies LCS; shipped code uses token-bag diff. Not implemented — risk to corpus and tests. Gap documented in README Limitations.

---

### Stage 8 — Submission (human)

**Files:** none (T15 [YOU] in TASKS.md)

90-second demo video + form submission. Agent stops here.

---

## RESULTS.md reframing note (Stage 2)

S6 does **not** contain a cleanup drift benchmark. Our RESULTS sections (method, category counts, false positives, clip-21 miss) remain valid. Optional future addition: one sentence in Method citing S6's two-stage pipeline as context — not required for submission.

---

## Verification checklist before handoff

```bash
npm test
node --experimental-strip-types scripts/measure-warm.ts   # if AAI_API_KEY set
npm start   # smoke /app.html record + warm
```

Paste real terminal output in the session report; do not fabricate.
