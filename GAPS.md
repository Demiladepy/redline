# Redline — honest gap analysis

Written for repositioning and demo polish. Compare against full-platform entries (e.g. Bhasha: Voice Studio, Team Relay, Invariant Audit, Overview). Redline is intentionally narrower; these are real weaknesses, not a wishlist to copy competitors.

---

## 1. First impression and product surface

**What we lack**

- A single screen that immediately reads as a finished product. The audit workspace still feels like a utility: three input cards, empty space, then results.
- Named modules or clear navigation beyond Home → workspace. Competitors show 3–4 product areas; we show one instrument with no sub-views.
- Dashboard metrics on open. We have corpus numbers on the landing page but not at the top of the workspace where judges land after "Open app."
- Empty-state design. Before the first run there is no preview of verbatim vs rewrite side by side, no guided "start here" path.
- Visual hierarchy on result. Verdict exists but the comparison (the actual proof) is buried below the fold in stacked panes.

**What we have**

- Verdict-first logic (R3), three input paths, copy guard, paste mode without network.

---

## 2. Scope and narrative breadth

**What we lack**

- Team or collaboration story (inboxes, relay, multi-user).
- Multilingual product story beyond a static list of language codes. We do not run the checker per language or show drift by locale.
- Translation or cross-language invariant claims. Our checker compares one verbatim string to one rewrite in one language.
- "System overview" layer: session history, active audits, sync status.
- Keyterms experiment results in the UI (PRD optional; not surfaced).

**What we have**

- A defensible narrow thesis: measure the Dictation API cleanup layer (`text` vs `llm_response`), not recognition and not translation.
- Evidence in RESULTS.md with honest misses and false positives.

---

## 3. Mascot and motion

**What we lack**

- Production sprite art. Attached PNGs were blank; SVG placeholders are not game-quality.
- Purposeful motion in the workspace. Ninja on the audit page was decorative and distracted from the instrument; removed from workspace.
- Motion that teaches the product (e.g. animating alignment between two strings, not a character running over language chips).

**What we have**

- Landing-only ninja patrol (hero) as brand flavor, optional.
- GSAP on landing for scroll reveals.

---

## 4. Checker and evidence depth

**What we lack**

- LCS alignment (PRD §7). Implementation uses token-bag diff; can over- or under-flag vs human judgment.
- Detection of large deletions (spoken-command → `CONFIRMED` miss documented in corpus).
- Dropped-entity detection for content removed without a token-level match.
- Per-finding jump-to-source in both panes.
- Export findings as JSON (P2).
- Live display of mishearing vs rewrite cause in a dedicated panel (R9 exists but easy to miss).
- Side-by-side diff view toggle.

**What we have**

- Deterministic checker, 16 unit tests, S1 reporting labels, annotateFindings for word confidence.
- 15-clip corpus with category table and published limits.

---

## 5. Multilingual

**What we lack**

- Corpus clips in languages other than English.
- Drift rate or finding counts per `language_codes` config.
- UI that answers: "does cleanup drift more in Hindi than English?" We cannot answer that yet.
- Clarification in UI that the checker is English-calibrated (negation lists, number words).

**What we have**

- List of 19 API language codes with docs/announcement discrepancy noted.
- English-only test suite and manifest.

---

## 6. Polish vs competitors

**What we lack**

- Consistent design system across landing and app (still converging).
- Metric cards with icons and footnotes (competitor pattern).
- Record flow UX: mic hero, status pill ("Ready to record"), sample voice note one-click with preview text.
- Inbox / tab metaphor for switching contexts.
- Proof matrix or audit table UI for corpus rows (evidence lives in markdown, not in app).

**What we have**

- Landing redesign (cream grid, FAQ, footer, references).
- README + SOURCES.md aligned with AssemblyAI DevRel tone.
- FEEDBACK.md for hackathon feedback lane.

---

## 7. Demo and submission

**What we lack**

- Recorded 90-second demo video (T15, human).
- Submission form completed.
- One-glance "why Redline wins" on workspace without reading README.

**What we have**

- Sample case (no API), paste mode, live record path.
- Script-ready evidence in RESULTS.md.

---

## 8. What not to build to catch up

Do not chase competitor breadth before submission:

- Team Relay, multilingual translation, or zero-drift invariant matrix across 18 languages.
- Four separate product routes.
- Game engine or canvas ninja MMO on the audit page.

**Do build** to close the gap without losing thesis:

1. Workspace metrics row (corpus headline on open).
2. Side-by-side verbatim | rewrite with empty-state preview.
3. "How to read the verdict" and "Known limits" on workspace.
4. Remove mascot from workspace; keep instrument clinical.
5. Demo video that shows sample → flag → checker → RESULTS honesty in 90 seconds.

---

## One-line pitch gap

**Bhasha (as shown):** "Voice platform for teams with translation and invariant audit across languages."

**Redline today:** "Instrument that flags when Dictation cleanup diverges from verbatim — with published corpus limits."

**Redline needs to communicate on open:** "You are looking at the audit layer, not another dictation app. Here is the verdict, here is the proof, here is what we missed."
