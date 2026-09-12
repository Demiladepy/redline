# BACKLOG

Ideas that surfaced during the build and were deliberately not built.
Append one line each. Do not implement anything from this file during the
hackathon — it exists so good ideas can be recorded without derailing the run.

- FORM-style UI direction (clean whitespace, bold wordmark, strong blue primary CTA) for the Redline app chrome when UI tasks land — not a separate marketing landing page.
- Observed live: invalid API key returned HTTP 401 from dictation.assemblyai.com, while AGENTS.md / docs pin 404. Mapped both in server.js; confirm before writing FEEDBACK.md.
- User requested landing + app split (2026-09-12): built public/index.html landing and public/app.html workspace despite original out-of-scope note.
- Converted Node JS to TypeScript via Node --experimental-strip-types (no tsc/bundler). Browser + AudioWorklet remain JS.
- P0 plan: ship full P0 + P1 before submission; P2 only if chosen later (would trigger full app redesign).
- P0 first half (2026-09-12): R3 verdict-first layout + R4 offline sample (no network) on app.html.
- P0 second half: R5 paste mode (browser ground.js, no network); R8 RESULTS sliced to 15-clip PRD quotas.
- Dual ground: `ground.ts` (Node) and `public/ground.js` (browser). Keep behaviour in parity; prefer editing .ts then re-exporting JS.
- P1 done (2026-09-12): R9 annotateFindings cause from words[].confidence (threshold 0.5, display-only); R10 Space ignores paste textareas / paste button.
