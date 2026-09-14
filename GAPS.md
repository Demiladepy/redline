# Redline — honest gap analysis

Written for repositioning and demo polish. Compare against full-platform entries
(e.g. Bhasha: Voice Studio, Team Relay, Invariant Audit, Overview). Redline is
intentionally narrower; these are real weaknesses, not a wishlist to copy
competitors.

---

## 1. First impression and product surface

**What we lack**

- Named modules or clear navigation beyond Home → workspace. Competitors show
  3–4 product areas; we show one instrument.
- Multilingual product story beyond a language picker + static code list. We do
  not publish drift counts per locale.
- "System overview" layer: session history, active audits, sync status.

**What we have**

- Audit workspace with corpus metrics on open, composer (Record / Sample / Paste),
  empty-state side-by-side preview, verdict-first results, known limits, and
  corpus table from disk.
- Landing with problem frame, FAQ (visibility before a cleanup dial), and
  language coverage with real flag images.

---

## 2. Scope and narrative breadth

**What we lack**

- Team or collaboration story (inboxes, relay, multi-user).
- Translation or cross-language invariant claims.
- Keyterms experiment results in the UI (documented in RESULTS.md only).

**What we have**

- A defensible narrow thesis: measure the Dictation API cleanup layer
  (`text` vs `llm_response`), not recognition and not translation.
- Evidence in RESULTS.md with honest misses and false positives.

---

## 3. Mascot and motion

**What we lack**

- Production sprite art; SVG placeholders are not game-quality.
- Motion that teaches alignment (animating spans between panes).

**What we have**

- Landing-only ninja patrol as optional brand flavor.
- GSAP scroll reveals on the landing page.
- Mascot kept off the audit workspace so the instrument stays clinical.

---

## 4. Checker and evidence depth

**What we lack**

- Dropped-entity detection beyond token/LCS alignment heuristics.
- Export findings as JSON.
- Dedicated mishearing-vs-rewrite cause panel (R9 exists on findings but is
  easy to miss).
- Side-by-side character-diff toggle.

**What we have**

- Deterministic LCS aligner in `ground.ts` / `public/ground.js`, 20 unit tests,
  contraction expansion, clip-21 truncation detection, S1 reporting labels,
  `annotateFindings` for word confidence.
- 15-clip corpus with category table and published limits / false positives.

---

## 5. Multilingual

**What we lack**

- Corpus clips in languages other than English.
- Drift rate or finding counts per `language_codes` config.
- UI that answers: "does cleanup drift more in Hindi than English?"

**What we have**

- Record path sends `language_codes` for the 19 documented API codes.
- Honest UI note that the checker word lists remain English-calibrated.
- Landing list of 19 codes with flag images; docs/announcement 18-vs-19 noted
  in FEEDBACK.md.

---

## 6. Polish vs competitors

**What we lack**

- Pixel-perfect design system parity with large product UIs.
- Inbox / tab metaphor for switching contexts beyond Record / Sample / Paste.
- Deployed public demo URL (local `npm start` is the default path).

**What we have**

- Shared navy / quiet paper look across landing CTAs and workspace chrome.
- Composer-style stage with language flag selector and green primary action.
- Proof path: verdict → findings → Rewrite | Verbatim panes.

---

## 7. Demo and submission

**What we lack**

- Nothing blocking: demo recorded and form submitted (T15).

**What we have**

- Sample case (no API), paste mode, live record path.
- Script in DEMO.md; corpus counts 15 / 3 high / 1 medium / 11 clean.

---

## 8. What not to build next

Do not chase competitor breadth:

- Team Relay, multilingual translation, or zero-drift invariant matrix across
  18 languages.
- Four separate product routes.
- Game engine or canvas ninja on the audit page.
- Cleanup intensity dial before publishing more measured evidence.

---

## One-line pitch

**Bhasha (as shown):** "Voice platform for teams with translation and invariant
audit across languages."

**Redline:** "Instrument that flags when Dictation cleanup diverges from
verbatim — with a deterministic checker and published corpus limits."
