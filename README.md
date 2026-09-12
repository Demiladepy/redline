# Redline

> The cleanup can change what you said. Redline compares the Dictation API's verbatim transcript to its rewrite and shows you where they diverge.

Say *"Patient is not allergic to penicillin."* An app that pastes only the cleaned text can drop **not** and still receive HTTP `200` with `llm_error: null`. Redline surfaces both strings, runs a deterministic check, and marks drift before you copy.

Built for [AssemblyAI Hack into Dictation](https://www.assemblyai.com/) (September 2026).

Redline is a measurement instrument for dictation pipelines, not a competing dictation app. It extends an argument AssemblyAI has made in public — that aggregate word error rate is a poor predictor of whether speech input actually works, that the tokens that carry the transaction (names, amounts, dates, dosages) matter most, and that the honest way to evaluate a system is to run your own audio and count misses by hand rather than accept a vendor average. Every published figure on that argument measures the recognition layer. The Dictation API adds a second layer: an LLM rewrite of the transcript. Redline runs the same method on that layer. Design references and paraphrased sources: [`SOURCES.md`](SOURCES.md).

---

## Overview

The [Dictation API](https://dictation.assemblyai.com/) returns two strings from one recording:

| Field | Description |
| --- | --- |
| `text` | Verbatim transcript. The API guarantees this field is not altered by the rewrite. |
| `llm_response` | LLM cleanup of that transcript, or `null` if the rewrite timed out or failed. |

Most dictation UIs show only `llm_response`. Redline is a measurement layer on top: it aligns the two fields, classifies mismatches, and assigns a verdict. The web UI is a demo shell; the submission is the checker, corpus evidence, and documented limits.

AssemblyAI's push-to-talk guidance draws a line between speech recognition and a cleanup pass: the verbatim transcript is what was said; the rewrite is often what you wanted on screen — and whether to show the second is a product decision worth making deliberately, not by default. Redline is the check for that decision: it compares the two strings the API already returns and flags tokens that do not trace back.

| Component | Role |
| --- | --- |
| Checker | Deterministic aligner (`ground.ts`). No second model call. Small on purpose — under a few hundred lines, no dependencies, no build step — so a verdict can be checked rather than trusted. |
| Demo app | Record, paste, or load a sample case. Verdict-first UI with copy guard. |
| Corpus | 15 clips across six categories, default API config, run 2026-09-12. |
| Results writeup | Method, quoted drift cases, false positives, and one miss. See [`RESULTS.md`](RESULTS.md). |
| API feedback | Docs and SDK mismatches found while building. See [`FEEDBACK.md`](FEEDBACK.md). |
| Sources | Why each design choice traces to AssemblyAI's own posts. See [`SOURCES.md`](SOURCES.md). |

---

## Quickstart

**Requirements:** Node.js 22.6 or later. No `npm install` (zero runtime dependencies).

1. Set your Dictation API key:

```bash
export AAI_API_KEY=your_key_here
```

You can also place `AAI_API_KEY=...` in a `.env` file at the project root. The server reads it on startup. Do not commit the key.

2. Start the server:

```bash
npm start
```

3. Open the app:

| URL | Purpose |
| --- | --- |
| http://localhost:8787 | Landing page |
| http://localhost:8787/app.html | Dictation workspace |
| http://localhost:8787/app.html?sample=1 | Offline sample (no API call) |

**Other commands:**

```bash
npm test                 # checker unit tests (16 cases)
npm run corpus           # batch-run fixtures against the live API
npm run measure-warm     # R11 cold vs warmed latency (needs AAI_API_KEY)
npm run keyterms-experiment  # S2 keyterms overcorrection probe (needs AAI_API_KEY)
bash scripts/spike.sh    # single-clip curl spike (needs AAI_API_KEY)
```

---

## How the checker works

`ground()` tokenizes the verbatim and rewrite, aligns them, and emits findings when a span in the rewrite does not trace back to the verbatim (or vice versa).

| Internal kind | S1 reporting category | Examples |
| --- | --- | --- |
| Negation | negation | Dropped or inserted `not`, `never`, polarity flips |
| Number | alphanumeric string | `twenty` vs `20`, changed amounts or dosages |
| Entity | proper noun or name / domain terminology | Names invented in the rewrite; tech jargon via suffix/heuristic |

Detection still uses the three internal kinds for severity. `findingCategory()` maps findings to AssemblyAI's entity taxonomy for display (see S1 in [`SOURCES.md`](SOURCES.md)).

Verdict levels: `none` (no rewrite), `clean`, `medium`, `high`.

Dropped tokens can be annotated as likely **mishearing** or **rewrite** using per-word STT confidence from the API `words` array (threshold `0.5`). This is display-only; it does not change severity.

**Known false positives** (full list at the bottom of `ground.ts`):

- Contraction normalisation (`Im` → `I'm`)
- English *one* treated as the number `1` (e.g. "the green one")
- Discourse `no` inside a self-correction where final intent is preserved
- Repeated negative predicates from stammers inflating polarity count

---

## Corpus headline

15 clips published for submission (selected from a 25-clip recording set). Default config `{}`, no `llm_instruction`. Raw counts only; the sample is too small for percentages.

| Verdict | Count |
| --- | ---: |
| High | 2 |
| Medium | 1 |
| Clean | 12 |

Notable outcomes:

- **Miss:** one spoken-command clip collapsed to `CONFIRMED` while the checker returned clean.
- **False positives:** contractions and self-correction discourse on otherwise correct rewrites.

Category breakdown and quoted cases: [`RESULTS.md`](RESULTS.md).

---

## Dictation API reference

Endpoint used by this project:

```
POST https://dictation.assemblyai.com/v1/transcribe/live
```

| Topic | Detail |
| --- | --- |
| Auth | `Authorization: <RAW_KEY>` (no `Bearer` prefix) |
| Body | `multipart/form-data`: `config` (JSON) before `audio` |
| Audio | 16-bit PCM WAV or raw PCM. MP3, WebM, and other compressed formats return `415`. |
| Clip length | Up to 120 seconds |
| Invalid key | Documented as `404`; this build also observed `401` on a bad key |

Browser capture uses `AudioWorklet` → `Int16Array` PCM, not `MediaRecorder` (WebM is rejected upstream).

---

## Limitations

- **Alignment algorithm.** The PRD describes longest-common-subsequence alignment. The shipped checker uses token-bag diff after normalisation. It catches negation, number, and inserted-entity drift on the demo path but does not flag large deletions (see clip-21 in [`RESULTS.md`](RESULTS.md)). A full LCS aligner would need new tests and corpus re-validation; it was deferred to protect submission stability.
- **Entity taxonomy.** S1 categories are applied via a reporting layer (`findingCategory`), not separate detectors. Domain vs name split is heuristic; corpus counts in RESULTS still use internal kinds.

---

## References

Full paraphrased traceability: [`SOURCES.md`](SOURCES.md). Internal deliverables: [`RESULTS.md`](RESULTS.md) (corpus), [`FEEDBACK.md`](FEEDBACK.md) (API notes), [`IMPLEMENTATION_PLAN.md`](IMPLEMENTATION_PLAN.md) (build status).

### AssemblyAI published sources

| ID | Title | Author | Date | URL | What Redline takes |
| --- | --- | --- | --- | --- | --- |
| S1 | The voice agent accuracy problem nobody benchmarks | Devon Malloy | 8 Sep 2026 | [assemblyai.com/blog/entity-accuracy-in-speech-to-text](https://www.assemblyai.com/blog/entity-accuracy-in-speech-to-text) | Entity-over-WER argument; run-your-own-audio method; S1 reporting categories for findings |
| S2 | How to build push-to-talk dictation with the Sync API | Kelsey Foster | 26 Aug 2026 | [assemblyai.com/blog/build-push-to-talk-dictation-sync-api](https://www.assemblyai.com/blog/build-push-to-talk-dictation-sync-api) | Cleanup vs recognition framing; AudioWorklet PCM; connection pre-warming; error handling |
| S3 | How to add voice-note transcription to your app | Kelsey Foster | 26 Aug 2026 | [assemblyai.com/blog/add-voice-memo-transcription-to-your-app](https://www.assemblyai.com/blog/add-voice-memo-transcription-to-your-app) | Response shape with per-word confidence; WAV/PCM and duration limits |
| S4 | Why AssemblyAI's Voice Agent API is designed for coding agents | Devon Malloy | 25 Aug 2026 | [assemblyai.com/blog/why-assemblyais-voice-agent-api-is-designed-for-coding-agents](https://www.assemblyai.com/blog/why-assemblyais-voice-agent-api-is-designed-for-coding-agents) | Small deterministic verifier as trust instrument |
| S5 | Using the Voice Agent API alongside an existing voice stack | Devon Malloy | 8 Sep 2026 | [assemblyai.com/blog/using-the-voice-agent-api-alongside-an-existing-voice-stack](https://www.assemblyai.com/blog/using-the-voice-agent-api-alongside-an-existing-voice-stack) | Transcript errors inherit silently one layer up — same for cleanup LLM |
| S6 | Inside dictation cleanup: How raw speech becomes finished text | Kelsey Foster | 2 Sep 2026 | [assemblyai.com/blog/dictation-cleanup](https://www.assemblyai.com/blog/dictation-cleanup) | Two-stage pipeline; measurement target is rewrite drift, not recognition WER |

---

## License and attribution

Redline by Demilade Ayeku. AssemblyAI Hack into Dictation, 2026.
