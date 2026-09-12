# AGENTS.md

Read this file fully before touching anything. It is the contract for this
repository. `TASKS.md` is the work queue. Nothing outside `TASKS.md` gets built.

---

## 1. What this project is

Redline is a dictation app that checks whether the API's cleanup changed the
meaning of what the user said.

The AssemblyAI Dictation API returns two strings: `text`, the verbatim
transcript, which the API guarantees is never altered, and `llm_response`, an
LLM rewrite of it. The rewrite can silently drop a negation, change a figure, or
insert a name, and the response still comes back `200` with `llm_error: null`.
Apps that display only `llm_response` paste that change without knowing.

Redline aligns the two strings and marks every span in the rewrite that does not
trace back to the verbatim.

**The single sentence that governs every design decision:** *the cleanup can
change what you said, and this shows you when it does.*

If a proposed change does not serve that sentence, it does not belong in this
repository.

## 2. The deadline

Submission is **September 13, 2026**. This is a hackathon build with roughly two
days of runway. Correctness on the demo path beats completeness everywhere else.
Prefer a working narrow thing over a broad half-thing.

---

## 3. Pinned API facts — do not infer these, do not "correct" them

**This is critical.** The Dictation API is a *separate service* from
AssemblyAI's main transcription API. You have almost certainly seen the main API
in training data. It has a different hostname, a different request shape, a
different auth header, and a polling flow. **None of that applies here.** If you
find yourself writing `api.assemblyai.com`, `/v2/transcript`, a `transcript_id`,
or a polling loop, you have drifted to the wrong product. Stop and re-read this
section.

| Fact | Value |
| --- | --- |
| Endpoint | `POST https://dictation.assemblyai.com/v1/transcribe/live` |
| Auth header | `Authorization: <RAW_KEY>` — **no `Bearer` prefix** |
| Invalid key response | `404`, not `401`. Body: `{"detail": "Invalid API key"}` |
| Body | `multipart/form-data`, exactly two parts |
| Part order | `config` **must** precede `audio`. Reversed or missing config → `400` |
| `config` part | `Content-Type: application/json`. `{}` is valid |
| `audio` part | `Content-Type: audio/wav` or `audio/pcm`. Anything else → `415` |
| Audio cap | 120 seconds |
| Compressed audio | MP3, M4A, FLAC, OGG, WebM are all rejected with `415` |
| Client timeout | 90 seconds |

Config fields that exist: `sample_rate` (required for raw PCM), `channels`
(required for raw PCM), `language_codes`, `stt_prompt` (max 6000 chars, also
accepted as `prompt` — send one or the other, not both), `keyterms_prompt` (max
100 terms / 8000 chars, legacy aliases `keyterms` and `word_boost` — send only
one of the three), `llm_instruction` (max 2048 chars).

Response fields that exist: `text`, `words` (array of `{text, confidence}`),
`confidence`, `llm_response` (string or null), `llm_error` (`"timeout"`,
`"error"`, or null), `audio_duration_ms`, `session_id`, `request_time_ms`,
`sync_time_ms`.

**Do not invent fields outside those two lists.** If you need something that is
not there, say so in your report rather than guessing a field name.

Two behaviours that will otherwise cause bugs:

- A failed rewrite still returns `200`. If `llm_response` is null and `text` is
  present, render `text`. A non-null `llm_error` is **not** a failed request.
- The rewrite has a 5-second internal deadline, separate from the 90-second
  request timeout.

---

## 4. Hard constraints on the code

- **Zero runtime dependencies.** No npm install. No React, no Vue, no Tailwind,
  no Express, no build step, no bundler. Plain ES modules, plain CSS, Node's
  standard library. If a task seems to need a package, it doesn't — report
  instead.
- **Node 18+ only**, for global `fetch`.
- The API key lives in `process.env.AAI_API_KEY` and is read only in
  `server.js`. It must never appear in anything under `public/`, in a log line,
  in a commit, or in a test fixture.
- Browser audio capture goes through `AudioWorklet` → `Int16Array`. Do not
  reach for `MediaRecorder`; its WebM/Opus output gets a `415`.
- ES module syntax throughout (`import`/`export`). No CommonJS.

---

## 5. Things you must not do

These exist because each one has a specific cost.

1. **Do not build anything not listed in `TASKS.md`.** If you think of a good
   idea while working, append one line to `BACKLOG.md` and carry on with the
   current task. Do not implement it. Do not "just quickly add" it.
2. **Do not refactor code that passes its tests.** Reorganising working code
   burns runway and introduces regressions. Restructure only when a task
   explicitly says to.
3. **Do not change the classifier thresholds, severity levels, or word lists in
   `ground.js` without a test case that fails before and passes after.** Those
   lists are the product. Tuning them by feel makes the verifier unfalsifiable.
4. **Do not delete the "Known false positives" comment block at the bottom of
   `ground.js`.** Add to it when you find a new one. It is the honesty of the
   project and it goes in the submission.
5. **Do not add an LLM call to the verifier.** The entire argument is that the
   checker is deterministic and cannot hallucinate its own verdict. A second
   model grading the first one destroys the thesis. This is not negotiable and
   there is no clever exception.
6. **Do not fabricate test results.** If you cannot run something, say you could
   not run it. Paste real terminal output, never a plausible reconstruction of
   what it would have printed. A made-up passing test is the worst possible
   failure mode here, because everything downstream is built on it.
7. **Do not rewrite the UI copy into marketing voice.** No "Powered by AI", no
   "Revolutionary", no exclamation marks, no emoji in the interface. Plain
   sentences, sentence case, active voice.
8. **Do not silently widen scope by generalising.** "While I was there I also
   made it support multiple languages" is a scope violation even if the code is
   good.
9. **Do not commit anything to git unless a task says to.**
10. **Do not touch `README.md` except in the task that says to.**

## 6. When you are stuck

Two failed attempts at the same thing is the limit. Then stop, write what you
tried and what the actual error was, and hand back to the human. Do not invent a
workaround, do not stub the failing piece out and proceed, and do not mark the
task complete.

If a task's instructions contradict something you observe in the code, trust the
code and report the contradiction. Do not quietly follow one or the other.

## 7. Definition of done for any task

A task is done when all four hold:

1. The stated deliverable exists.
2. Its verification command has been run, and the real output is pasted in your
   report.
3. Nothing outside the task's listed files changed.
4. The checkbox in `TASKS.md` is flipped to `[x]` and a one-line entry is added
   to the Log at the bottom of that file.

## 8. Out of scope for this build

Named so you do not drift into them: user accounts, sync, persistence of any
kind, a history view, mobile layout beyond not breaking, languages other than
English, chunked upload-while-recording, streaming partial results, a plugin
system, a memory graph, Docker, CI, a landing page.