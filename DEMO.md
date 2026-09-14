# 90-second demo — win script

Hackathon judges see dozens of “AI cleaned my transcript” demos. Redline wins if
they remember **one sentence** and **one proof**:

> The cleanup can change what you said — and this shows you when it does,
> without asking a second model to grade the first.

No slides. One take. Screen recording only. Cap at **90 seconds**.

Submit: https://forms.gle/THwUT2tQ5XvABQqT7

---

## Before you hit record (2 minutes)

1. Server running: `npm start` → http://localhost:8787
2. Browser zoom **110–125%** so marks and verdict read on a phone screen.
3. Open two tabs ready:
   - Tab A: http://localhost:8787/app.html?sample=1  
     (loads the penicillin HIGH sample immediately — **no API call**)
   - Tab B: `RESULTS.md` scrolled to **What the rewrite changed** (15 / 3 / 1 / 11)
4. Optional third tab: `ground.ts` open at the top of `ground()` / LCS comment,
   or `public/ground.js` — prove there is no LLM in the verifier.
5. Mute Discord / Slack. Close other windows. Cursor large if your OS allows.
6. Do **not** start with a live mic take. Sample is deterministic and always
   HIGH. Live audio can come back CLEAN and kill the open.

If `?sample=1` does not auto-load, click **Sample** → **Load sample** in the
first two seconds of the take.

---

## The script (say this almost verbatim)

| Time | On screen | Say (out loud) |
| --- | --- | --- |
| **0:00–0:08** | Tab A already showing **HIGH** verdict + rewrite with **not** marked | “Patient is *not* allergic to penicillin. The cleanup dropped the *not*. Still HTTP 200. No error.” |
| **0:08–0:18** | Hold the marked rewrite. Point once at the dropped token | “An app that pastes only the cleanup pastes the opposite of what was said. Redline is the check that catches that.” |
| **0:18–0:32** | Scroll findings list, then verbatim confidence bars | “This is not a second LLM grading the first. It is a deterministic aligner on the two strings the Dictation API already returns: verbatim `text` and `llm_response`.” |
| **0:32–0:48** | Click **Corpus evidence**. Show table. Point at metrics strip: **15 / 3 high / 1 medium / 11 clean** | “Fifteen clips, six categories, default config. Three high, one medium, eleven clean. Counts from disk — not hand-typed.” |
| **0:48–1:02** | Tab B: RESULTS — “Where the checker was wrong” (false positives) | “We also publish where *we* were wrong: contractions, discourse *no*, English *one* as a number. The known limits live in the UI and in the code.” |
| **1:02–1:15** | Back to app → **Paste** tab. Optionally flash one paste pair, or open `ground.js` for 3 seconds | “Paste mode runs the checker in the browser only. Zero npm deps. No model in the loop. Visibility first — before anyone adds a cleanup dial.” |
| **1:15–1:30** | Repo root or landing hero: logo + one-line thesis | “Redline. See when Dictation cleanup changes meaning. Code and full results are in the repo.” |

Stop talking at **1:28**. Freeze on the thesis or the HIGH sample. End.

---

## Why this beats a prettier competitor

| They show | You show |
| --- | --- |
| Cleanup dial / translation / team features | The prior question: **did meaning change?** |
| “Powered by AI” verifier | **Deterministic** LCS checker — cannot hallucinate a verdict |
| Happy-path only | **False positives listed out loud** (trust) |
| Vague claims | **15 / 3 / 1 / 11** from corpus on disk |
| Mic lottery in the first seconds | Offline sample that **always** opens HIGH |

If a judge asks “why not just use another model?” — your line is already in the
script: *a second model grading the first destroys the thesis.*

---

## Backup beats (only if a segment fails)

- **Sample did not load:** say the penicillin line yourself, then click Load sample.
- **Need a second wow in &lt;10s:** open RESULTS clip-21 — rewrite became only
  `CONFIRMED` while the spoken command asked for that. One sentence:
  “Cleanup can *execute* a spoken command, not just tidy fillers.”
- **No time for Paste:** skip Paste; spend the seconds on false positives.
  Honesty beats another click.

Do **not** improvise a live recording in the first 30 seconds.

---

## Delivery notes

- Speak slower than you think. Judges watch on mute sometimes — **big cursor**,
  pause on the marked **not**.
- One idea per cut of the script. Do not explain AudioWorklet, warm endpoints,
  or flag pickers. Out of scope for 90 seconds.
- Tone: calm engineer, not pitch deck. No “revolutionary,” no emoji, no hype.
- If you stumble: stop, re-record. One clean take beats a patched voiceover.

---

## After the take (T15)

1. Watch once at 1× on your phone. If the HIGH mark is unreadable, re-record.
2. Upload / link the video in the submission form.
3. Submit: https://forms.gle/THwUT2tQ5XvABQqT7
4. Post Discord feedback separately from `FEEDBACK.md` (separate lane).
5. Repo link in the form should open README with working screenshots.

---

## One-line cheat sheet (print this)

**Open HIGH → “dropped not, still 200” → deterministic checker → 15 clips,
3 high, we publish our false positives → Redline.**
