# Redline

The cleanup can change what you said, and this shows you when it does.

Say: *“Patient is not allergic to penicillin…”*  
An app that pastes only the cleaned transcript can drop the **not** and still return HTTP 200 with `llm_error: null`. Redline puts the verbatim and the rewrite side by side and marks the drift.

![Redline screenshot placeholder](public/logo.png)

## What the Dictation API returns

`POST https://dictation.assemblyai.com/v1/transcribe/live` returns both:

| Field | Meaning |
| --- | --- |
| `text` | Verbatim transcript (API guarantees it is not altered by the rewrite) |
| `llm_response` | LLM cleanup of that transcript (or `null` if the rewrite timed out / failed) |

The gap matters because cleanup is not graded by the API. A dropped negation, a changed dose, or an invented name can ship silently.

## How the verifier works

`ground.js` aligns the two strings with deterministic rules — negations, numbers (including word↔digit), and inserted entities. No second model call. Verdict levels: `none`, `clean`, `medium`, `high`.

Known false positives (also listed at the bottom of `ground.js`): contraction normalisation, English “one” treated as a number, repeated negative predicates from stammers, discourse “no” inside self-corrections.

## Run it

Node 22.6+ (uses `--experimental-strip-types`). Zero npm dependencies.

```powershell
# from the project root
Get-Content .env | ForEach-Object {
  if ($_ -match '^AAI_API_KEY\s*=\s*(.*)$') {
    $env:AAI_API_KEY = $matches[1].Trim().Trim('"').Trim("'")
  }
}
npm start
```

Open http://localhost:8787 for the landing page, then **Start dictating** (or go to http://localhost:8787/app.html).

```bash
# spike the live endpoint
bash scripts/spike.sh

# verifier tests
npm test

# corpus (needs fixtures/clip-*.wav)
npm run corpus
```

## Corpus headline

25 clips, default config `{}`, run 2026-09-12.

| | High | Medium | Clean |
| --- | ---: | ---: | ---: |
| Total | 3 | 1 | 21 |

Negation on scripted medical/legal/code lines survived in this sample. The interesting losses were elsewhere: the checker missed a spoken command that collapsed to `CONFIRMED` (clip-21), and it false-positived on contractions and self-corrections.

Full write-up: [`RESULTS.md`](RESULTS.md)  
Product feedback for AssemblyAI: [`FEEDBACK.md`](FEEDBACK.md)

## Constraint reminder

Auth header is `Authorization: <RAW_KEY>` (no `Bearer`). Invalid keys are documented as **404**; this build also observed **401**. Audio must be WAV or raw PCM — not MP3/WebM.
