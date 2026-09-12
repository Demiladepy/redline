# Sources

Every design decision in Redline that came from AssemblyAI's own published material, with the reference attached. Paraphrased throughout; nothing here is quoted at length.

The point of this file is that Redline is not a guess about what AssemblyAI cares about. It extends an argument they have already made in public, into the one layer they have not yet measured.

---

## S1 — The voice agent accuracy problem nobody benchmarks

Devon Malloy, Staff Growth Manager · 8 September 2026 · [assemblyai.com/blog](https://www.assemblyai.com/blog/entity-accuracy-in-speech-to-text)

**What it argues.** Word error rate weights every token equally, which makes it cheap to compute and a poor predictor of whether a system actually works. The tokens that carry the transaction — names, account numbers, alphanumeric IDs, dates, dosages, addresses — are a small minority of any utterance and close to all of its value. They are also the hardest to recover, because a model can reconstruct a function word from context and cannot reconstruct a digit it never heard. The metric that predicts task completion is missed entity rate. The post also breaks out entity errors by type (names hardest, then places, then phone numbers), and argues that errors compound across turns because the LLM reads the transcript rather than hearing the audio.

Its closing advice is to stop asking vendors for an accuracy figure and instead pull your own audio, run it, and count entity misses by hand.

**What Redline takes from it — four things.**

1. **The entity taxonomy becomes the classifier taxonomy.** `ground.ts` currently classifies findings as negation / number / entity. That is our invention. Replace it with theirs: proper nouns and names, alphanumeric strings, domain terminology, plus negation as the one category dictation adds that voice agents do not emphasise. Reporting in their vocabulary means the results table can be read against their benchmark without translation.
2. **The corpus method is their method.** Record your own audio, run it, count misses by hand. We are doing exactly the procedure this post recommends, applied to the cleanup pass instead of the recognition pass.
3. **The compounding argument transfers one layer up.** Their point is that the reasoning model never hears the audio, so a transcription error enters the context as fact. The same is true of the cleanup LLM: it reads `text` and never hears the recording. A drift it introduces is indistinguishable from something the speaker said, to everything downstream.
4. **Report counts, not percentages.** The post is pointed about vendors who give one averaged number with no dataset list. Fifteen clips does not support a percentage, and publishing one would make us the thing this post criticises.

**The gap this leaves, which is Redline's whole reason to exist.** Every number in that post measures the recognition layer — what the model heard. The Dictation API adds a second layer on top: an LLM that rewrites what was heard. No published metric covers it.

---

## S2 — How to build push-to-talk dictation with the Sync API

Kelsey Foster, Growth · 26 August 2026 · [assemblyai.com/blog/build-push-to-talk-dictation-sync-api](https://www.assemblyai.com/blog/build-push-to-talk-dictation-sync-api)

**What it argues.** Dictation is unusual because the user stares at the spot where the text will appear for the entire wait, so there is no loading state that makes latency acceptable. It walks through capture, transcription, latency, and failure handling.

**What Redline takes from it — four things.**

1. **Its closing section names our problem.** The post ends by observing that the transcript returns exactly what was said, disfluencies included — correct, but often not what you want on screen. It calls the gap between the verbatim and the text the user actually wanted a cleanup pass, distinct from speech recognition, and says the right answer depends on the product and is worth deciding deliberately. It closes by saying to start with the transcript being right, because everything downstream depends on it. Redline is the instrument for deciding that deliberately.
2. **Browser capture confirmed.** MediaRecorder gives WebM; the correct path is raw PCM via AudioWorklet or capture at 16 kHz mono and convert. This is what `pcm-processor.js` already does, and it is now a documented choice rather than a guess.
3. **Connection pre-warming.** An unauthenticated no-op endpoint exists purely to force the DNS, TCP and TLS handshake out of the critical path — you call it when recording starts, so the handshake happens while the user is still talking. Three caveats: same client object so the connection pool is shared, same base URL, and correct timing because idle pooled connections expire. For a user in Lagos hitting a US-region endpoint, this is not a micro-optimisation. On the Dictation API the endpoint is `GET https://dictation.assemblyai.com/v1/warm` (returns `{"warm":"toasty"}`).
4. **Error handling and logging.** Clips under the floor return a too-short error and should be swallowed silently rather than shown as a red toast, because users tap instead of holding constantly. Rate-limit and capacity responses carry a retry header that should be honoured rather than replaced with blind backoff. And log the session ID on every request, not only on failures.

---

## S3 — How to add voice-note transcription to your app

Kelsey Foster, Growth · 26 August 2026 · [assemblyai.com/blog](https://www.assemblyai.com/blog)

**What it argues.** A voice note is fast to send and slow to receive, and that asymmetry is where the feature dies. It covers the Sync API's constraints and a backfill strategy.

**What Redline takes from it — two things.**

1. **The response shape is confirmed and includes per-word confidence.** Text, per-word confidence, overall confidence, audio duration, session ID, and server processing time. Per-word confidence is the field behind R9 — separating a word the model misheard from a word the rewrite changed — and this post is the reference that it is reliably present.
2. **Format and duration constraints.** WAV or raw signed 16-bit PCM, with a floor in the tens of milliseconds and a two-minute ceiling. Matches what the Dictation API enforces.

---

## S4 — Why AssemblyAI's Voice Agent API is designed for coding agents

Devon Malloy · 25 August 2026 · [assemblyai.com/blog](https://www.assemblyai.com/blog)

**What it argues.** The API surface was deliberately kept small — around six event types against thirty-plus for a competitor — on the bet that the reader of the docs is increasingly a coding agent rather than a person clicking through a form. It argues the scarce resource is no longer implementation effort but how much of a system a builder must understand before trusting it.

**What Redline takes from it — one thing, and it is about the README.**

They believe trust comes from a system being small enough to hold in your head, and they explicitly invite people to test that claim rather than take it. A submission whose verifier is under 300 lines, has no dependencies, no build step, and no model call is arguing in their own idiom. Say so in the README: the verifier is deterministic and small on purpose, so its verdict can be checked rather than trusted.

---

## S5 — Using the Voice Agent API alongside an existing voice stack

Devon Malloy · 8 September 2026 · [assemblyai.com/blog](https://www.assemblyai.com/blog)

**What it argues.** Mostly a migration guide, but it repeats the entity-over-WER argument and adds the sharpest version of the framing: your speech model determines what the reasoning layer gets to reason about, and if the transcript is wrong everything downstream inherits the error silently, because the reasoning layer never sees the audio and has no way to know.

**What Redline takes from it.** That sentence, one layer up, is the entire pitch. The cleanup LLM never hears the audio either. Whatever it changes is inherited silently by the human reading the output, who also has no way to know.

---

## S6 — Inside dictation cleanup: How raw speech becomes finished text

Kelsey Foster, Growth · 2 September 2026 · [assemblyai.com/blog/dictation-cleanup](https://www.assemblyai.com/blog/dictation-cleanup)

**What it argues.** Dictation is two jobs in fixed order: recognition (Stage 1) then rewrite (Stage 2). They fail differently. Recognition errors cannot be fixed downstream — the rewrite only reformats the transcript it receives. The post's central failure mode is a fluent wrong answer: a misheard package name polished into a confident proper noun looks finished and gives the reader no signal that something went sideways.

The rewrite pass should start with the smallest useful transformation (remove fillers and stammers, change nothing else) and widen only when someone asks. Self-corrections and trailing abandonment are judgment calls; filled pauses and stammered repeats are mechanical. When verbatim is the deliverable (medical, legal), skip the rewrite entirely.

The post does not publish a drift benchmark on the cleanup layer. It explains why aggregate WER is the wrong instrument and points to entity accuracy and running your own audio — the same method Redline applies one stage later.

**What Redline takes from it.**

1. **Our measurement target is confirmed.** AssemblyAI describes the rewrite as a separate inference hop that never re-listens to audio. Redline's verbatim↔rewrite check is exactly that gap, not a duplicate of their recognition guidance.
2. **The fluent-wrong-answer case is upstream of our checker.** Mishearing polished into a wrong entity is a recognition failure; R9's confidence annotation helps surface it, but the rewrite did not introduce the error.
3. **Self-correction collapse is a known hard case.** The post names self-corrections as judgment calls. Our corpus clip-16 (Tuesday — no, Wednesday) flags discourse `no` as a false positive — consistent with their taxonomy, not a contradiction.
4. **RESULTS.md does not need reframing.** S6 explains the pipeline; Redline measures whether the rewrite changed meaning relative to the verbatim STT output. Those are complementary, not overlapping claims.

---

## The synthesis, in one paragraph

AssemblyAI has argued in public that aggregate accuracy metrics do not predict whether a speech system works, that the number which does is how often it gets the entities right, and that the honest way to find out is to run your own audio and count by hand. Every figure they have published on that measures the recognition layer. The Dictation API introduces a second layer above it — an LLM that rewrites the transcript — and applies their own argument in full: it never hears the audio, it can change an entity, and nothing downstream can tell. Redline runs their method on that layer and publishes the result, including the cases where the checker itself was wrong.

---

## What we are deliberately not taking

The blogs describe a large surface: streaming, voice agents, diarization, keyterms, agent context, medical mode, multilingual code-switching. All of it is interesting and none of it is in scope. The hackathon brief is to build a dictation app on the Dictation API. Redline stays inside that brief. Reading their roadmap is for sharpening the argument, not for widening the build.

One exception, because it costs almost nothing and tests a claim they made themselves: S2 warns that stuffing a keyterms list with common words causes overcorrection — the model begins hearing the boosted terms where they were not spoken. That is a falsifiable claim and Redline is the right instrument for it. Two clips, run twice, with and without an over-stuffed keyterms list. If overcorrection appears, it appears as inserted entities, which is exactly what the checker flags. See the corpus section of the PRD.
