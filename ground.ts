/**
 * Deterministic meaning checker: align verbatim transcript vs LLM rewrite.
 * No model calls. Findings are the product.
 * Erasable TypeScript only (Node --experimental-strip-types).
 */

export type VerdictLevel = 'none' | 'clean' | 'medium' | 'high';
export type FindingDirection = 'dropped' | 'inserted';
export type FindingKind = 'negation' | 'number' | 'entity';

/** S1 reporting vocabulary (display only; severity still uses FindingKind). */
export type FindingCategory =
  | 'negation'
  | 'proper noun or name'
  | 'alphanumeric string'
  | 'domain terminology';

export type Finding = {
  direction: FindingDirection;
  kind: FindingKind;
  token: string;
  verbatimIndex?: number;
  rewriteIndex?: number;
  rewriteCharStart?: number;
  rewriteCharEnd?: number;
};

export type GroundResult = {
  verdict: { level: VerdictLevel };
  findings: Finding[];
};

export type WordConfidence = {
  text: string;
  confidence: number;
};

/** R9: display-only cause. Does not change severity. Threshold 0.5 is provisional. */
export type DropCause = 'mishearing' | 'rewrite' | 'unknown';

export type AnnotatedFinding = Finding & {
  cause?: DropCause;
  word_confidence?: number | null;
};

type NormToken = string | string[];

/** STT confidence below this → treat dropped token as likely mishearing. */
export const WORD_CONFIDENCE_THRESHOLD = 0.5;

/** Rendered in UI; keep in sync with comment block below. */
export const KNOWN_LIMITS: string[] = [
  'Unit abbreviation swaps not in UNIT_ALIASES may flag as entities (e.g. tbsp vs tablespoon).',
  'Domain jargon spelled differently between STT and rewrite can flag as an inserted entity.',
  'Contraction normalisation (Im → I am) can flag an inserted entity on the expanded token (corpus clip-12).',
  'The English word one (as in the green one) is treated as number 1 and can false-positive when a rewrite drops the filler noun (corpus clip-18).',
  'A stammer or repeated clause that repeats a NEGATIVE_PREDICATES word (e.g. failed) can inflate polarity vs a cleaned single pass (corpus clip-19).',
  'Discourse no inside a self-correction (Tuesday - no, Wednesday) can flag a dropped negation when the final intent is unchanged (corpus clip-16).',
  'Large rewrite truncation is summarised as [content-truncated]; individual dropped instruction words are not listed separately.',
];

const FILLERS = new Set([
  'uh',
  'um',
  'uhm',
  'ah',
  'er',
  'like',
  'basically',
  'actually',
  'literally',
  'so',
  'well',
  'okay',
  'ok',
  'right',
  'yeah',
  'yep',
  'hmm',
  'huh',
]);

const FILLER_PHRASES: string[][] = [['you', 'know']];

const CONTRACTION_EXPANSIONS = new Map<string, string[]>([
  ["don't", ['do', 'not']],
  ["doesn't", ['does', 'not']],
  ["didn't", ['did', 'not']],
  ["isn't", ['is', 'not']],
  ["aren't", ['are', 'not']],
  ["wasn't", ['was', 'not']],
  ["weren't", ['were', 'not']],
  ["won't", ['will', 'not']],
  ["shouldn't", ['should', 'not']],
  ["couldn't", ['could', 'not']],
  ["wouldn't", ['would', 'not']],
  ["hasn't", ['has', 'not']],
  ["haven't", ['have', 'not']],
  ["can't", ['cannot']],
]);

const NEGATIONS = new Set([
  'not',
  'no',
  'never',
  'without',
  'neither',
  'nor',
  "n't",
  'dont',
  "don't",
  'doesnt',
  "doesn't",
  'didnt',
  "didn't",
  'isnt',
  "isn't",
  'arent',
  "aren't",
  'wasnt',
  "wasn't",
  'werent',
  "weren't",
  'wont',
  "won't",
  'cant',
  "can't",
  'cannot',
  'nothing',
  'nobody',
  'nowhere',
  'none',
]);

/** Words that carry negative polarity without the token "not". */
const NEGATIVE_PREDICATES = new Set([
  'absent',
  'missing',
  'lacking',
  'unavailable',
  'unable',
  'fail',
  'fails',
  'failed',
  'failure',
  'deny',
  'denies',
  'denied',
  'refuse',
  'refuses',
  'refused',
]);

const UNIT_ALIASES = new Map<string, string>([
  ['mg', 'milligram'],
  ['milligrams', 'milligram'],
  ['milligram', 'milligram'],
  ['g', 'gram'],
  ['grams', 'gram'],
  ['gram', 'gram'],
  ['kg', 'kilogram'],
  ['kilograms', 'kilogram'],
  ['ml', 'milliliter'],
  ['milliliters', 'milliliter'],
  ['millilitres', 'milliliter'],
  ['mcg', 'microgram'],
  ['µg', 'microgram'],
]);

const NUMBER_WORDS = new Map<string, number>([
  ['zero', 0],
  ['oh', 0],
  ['one', 1],
  ['two', 2],
  ['three', 3],
  ['four', 4],
  ['five', 5],
  ['six', 6],
  ['seven', 7],
  ['eight', 8],
  ['nine', 9],
  ['ten', 10],
  ['eleven', 11],
  ['twelve', 12],
  ['thirteen', 13],
  ['fourteen', 14],
  ['fifteen', 15],
  ['sixteen', 16],
  ['seventeen', 17],
  ['eighteen', 18],
  ['nineteen', 19],
  ['twenty', 20],
  ['thirty', 30],
  ['forty', 40],
  ['fifty', 50],
  ['sixty', 60],
  ['seventy', 70],
  ['eighty', 80],
  ['ninety', 90],
  ['hundred', 100],
  ['thousand', 1000],
  ['million', 1_000_000],
  ['billion', 1_000_000_000],
]);

const STOPWORDS = new Set([
  'a',
  'an',
  'the',
  'and',
  'or',
  'but',
  'if',
  'then',
  'to',
  'of',
  'in',
  'on',
  'at',
  'for',
  'from',
  'with',
  'by',
  'as',
  'is',
  'are',
  'was',
  'were',
  'be',
  'been',
  'being',
  'am',
  'i',
  'we',
  'you',
  'he',
  'she',
  'it',
  'they',
  'me',
  'him',
  'her',
  'us',
  'them',
  'my',
  'our',
  'your',
  'his',
  'their',
  'this',
  'that',
  'these',
  'those',
  'there',
  'here',
  'have',
  'has',
  'had',
  'do',
  'does',
  'did',
  'will',
  'would',
  'could',
  'should',
  'may',
  'might',
  'must',
  'can',
  'need',
  'needs',
  'think',
  'confirm',
  'booking',
  'ship',
  'friday',
  'book',
  'flight',
  'tuesday',
  'morning',
  'patient',
  'allergic',
  'penicillin',
  'give',
  'transfer',
  'naira',
  'build',
  'passing',
  'mass',
  'present',
  'scan',
]);

export function ground(
  verbatim: string,
  rewrite: string | null | undefined,
): GroundResult {
  if (rewrite == null || rewrite === '') {
    return { verdict: { level: 'none' }, findings: [] };
  }

  const rewriteStr = String(rewrite);
  const left = prepareFlat(String(verbatim ?? ''));
  const right = prepareFlat(rewriteStr);

  const { leftMatched, rightMatched } = lcsAlign(left, right);
  let findings = diffFromAlignment(left, right, leftMatched, rightMatched);

  const largeDeletion = detectLargeDeletion(left, right, leftMatched);
  if (largeDeletion) {
    findings = findings.filter(
      (f) => f.direction !== 'dropped' || f.kind === 'negation' || f.kind === 'number',
    );
    findings.push(largeDeletion);
  }

  if (
    !findings.some((f) => f.kind === 'negation') &&
    polarityCount(left) !== polarityCount(right)
  ) {
    findings.push({
      direction: polarityCount(left) > polarityCount(right) ? 'dropped' : 'inserted',
      kind: 'negation',
      token: '[polarity]',
    });
  }

  attachRewriteCharSpans(findings, rewriteStr);

  const level = verdictLevel(findings);
  return { verdict: { level }, findings };
}

/** Map internal finding kind to AssemblyAI S1 reporting category. */
export function findingCategory(f: Finding): FindingCategory {
  if (f.kind === 'negation') return 'negation';
  if (f.kind === 'number') return 'alphanumeric string';
  const t = f.token.toLowerCase();
  if (t.startsWith('[')) return 'domain terminology';
  if (/\d/.test(t)) return 'alphanumeric string';
  if (/-/.test(t) || /(?:osis|itis|ectomy|ology|emia|pathy|ware|base|sql)$/i.test(t)) {
    return 'domain terminology';
  }
  return 'proper noun or name';
}

export function annotateFindings(
  findings: Finding[],
  words?: WordConfidence[] | null,
): AnnotatedFinding[] {
  if (!findings.length) return [];
  if (!words || !words.length) {
    return findings.map((f) =>
      f.direction === 'dropped'
        ? { ...f, cause: 'unknown' as DropCause, word_confidence: null }
        : { ...f },
    );
  }

  const pool = words.map((w) => ({
    key: normalizeWordKey(w.text),
    confidence: Number(w.confidence),
    used: false,
  }));

  return findings.map((f) => {
    if (f.direction !== 'dropped' || !f.token || f.token.startsWith('[')) {
      return { ...f };
    }
    const key = normalizeWordKey(f.token);
    const hit = pool.find((p) => !p.used && p.key === key);
    if (!hit || Number.isNaN(hit.confidence)) {
      return { ...f, cause: 'unknown' as DropCause, word_confidence: null };
    }
    hit.used = true;
    const cause: DropCause =
      hit.confidence < WORD_CONFIDENCE_THRESHOLD ? 'mishearing' : 'rewrite';
    return { ...f, cause, word_confidence: hit.confidence };
  });
}

function normalizeWordKey(text: string): string {
  return String(text)
    .toLowerCase()
    .replace(/[^\w']/g, '')
    .replace(/^'+|'+$/g, '');
}

function prepareFlat(text: string): string[] {
  const raw = tokenize(text);
  const collapsed = collapseStammers(raw);
  const withoutFillers = stripFillers(collapsed);
  const normed = withoutFillers.flatMap((t) => {
    const n = normalizeToken(t);
    return flattenNorm(n);
  });
  return collapseCompoundNumbers(normed);
}

function collapseCompoundNumbers(tokens: string[]): string[] {
  const out: string[] = [];
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (!String(t).startsWith('num:')) {
      out.push(t);
      continue;
    }
    let v = Number(String(t).slice(4));
    if (i + 1 < tokens.length && String(tokens[i + 1]).startsWith('num:')) {
      const next = Number(String(tokens[i + 1]).slice(4));
      if (next === 1000 || next === 1_000_000 || next === 1_000_000_000) {
        v = v * next;
        i += 1;
      }
    }
    out.push(`num:${v}`);
  }
  return out;
}

function flattenNorm(token: NormToken): string[] {
  if (Array.isArray(token)) return token.flatMap((t) => flattenNorm(t));
  return [token];
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/(\d),(\d)/g, '$1$2')
    .replace(/[^\w\s'.-]/g, ' ')
    .split(/\s+/)
    .map((t) => t.replace(/^['.]+|['.]+$/g, ''))
    .filter(Boolean);
}

function collapseStammers(tokens: string[]): string[] {
  const out: string[] = [];
  for (const t of tokens) {
    if (out.length && out[out.length - 1] === t) continue;
    out.push(t);
  }
  return out;
}

function stripFillers(tokens: string[]): string[] {
  const out: string[] = [];
  for (let i = 0; i < tokens.length; i++) {
    let skippedPhrase = false;
    for (const phrase of FILLER_PHRASES) {
      if (
        i + phrase.length <= tokens.length &&
        phrase.every((p, j) => tokens[i + j] === p)
      ) {
        i += phrase.length - 1;
        skippedPhrase = true;
        break;
      }
    }
    if (skippedPhrase) continue;
    if (FILLERS.has(tokens[i])) continue;
    out.push(tokens[i]);
  }
  return out;
}

function normalizeToken(token: string): NormToken {
  const t = token.toLowerCase();
  const expanded = CONTRACTION_EXPANSIONS.get(t);
  if (expanded) {
    return expanded.map((part) => normalizeSingleToken(part));
  }
  return normalizeSingleToken(t);
}

function normalizeSingleToken(t: string): NormToken {
  if (UNIT_ALIASES.has(t)) return UNIT_ALIASES.get(t)!;
  if (NUMBER_WORDS.has(t)) return `num:${NUMBER_WORDS.get(t)}`;
  const compact = t.replace(/,/g, '');
  if (/^\d+(\.\d+)?$/.test(compact)) return `num:${Number(compact)}`;
  const glued = compact.match(/^(\d+(?:\.\d+)?)([a-zµ]+)$/);
  if (glued) {
    const unit = UNIT_ALIASES.get(glued[2]) ?? glued[2];
    return [`num:${Number(glued[1])}`, unit];
  }
  return t;
}

function lcsAlign(
  left: string[],
  right: string[],
): { leftMatched: boolean[]; rightMatched: boolean[] } {
  const m = left.length;
  const n = right.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (left[i - 1] === right[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  const leftMatched = Array(m).fill(false);
  const rightMatched = Array(n).fill(false);
  let i = m;
  let j = n;
  while (i > 0 && j > 0) {
    if (left[i - 1] === right[j - 1]) {
      leftMatched[i - 1] = true;
      rightMatched[j - 1] = true;
      i -= 1;
      j -= 1;
    } else if (dp[i - 1][j] >= dp[i][j - 1]) {
      i -= 1;
    } else {
      j -= 1;
    }
  }

  return { leftMatched, rightMatched };
}

function diffFromAlignment(
  left: string[],
  right: string[],
  leftMatched: boolean[],
  rightMatched: boolean[],
): Finding[] {
  const findings: Finding[] = [];
  const leftSet = new Set(left);

  for (let i = 0; i < left.length; i++) {
    if (leftMatched[i]) continue;
    const token = left[i];
    const display = displayToken(token);
    const kind = classifyToken(token, 'dropped');
    if (!kind) continue;
    findings.push({
      direction: 'dropped',
      kind,
      token: display,
      verbatimIndex: i,
    });
  }

  for (let j = 0; j < right.length; j++) {
    if (rightMatched[j]) continue;
    const token = right[j];
    const display = displayToken(token);
    const kind = classifyToken(token, 'inserted');
    if (!kind) continue;
    if (kind === 'entity' && leftSet.has(token)) continue;
    findings.push({
      direction: 'inserted',
      kind,
      token: display,
      rewriteIndex: j,
    });
  }

  return findings;
}

function classifyToken(
  token: string,
  direction: FindingDirection,
): FindingKind | null {
  if (isNegationToken(token)) return 'negation';
  if (String(token).startsWith('num:')) return 'number';
  if (direction === 'inserted') {
    if (STOPWORDS.has(token)) return null;
    if (FILLERS.has(token)) return null;
    if (UNIT_ALIASES.has(token)) return null;
    return 'entity';
  }
  return null;
}

function isNegationToken(token: string): boolean {
  if (token === "n't" || NEGATIONS.has(token)) return true;
  if (NEGATIVE_PREDICATES.has(token)) return true;
  return false;
}

function displayToken(token: string): string {
  if (String(token).startsWith('num:')) return String(token).slice(4);
  return token;
}

function isContentToken(token: string): boolean {
  if (String(token).startsWith('num:')) return true;
  if (STOPWORDS.has(token)) return false;
  if (FILLERS.has(token)) return false;
  if (UNIT_ALIASES.has(token)) return false;
  return true;
}

function detectLargeDeletion(
  left: string[],
  right: string[],
  leftMatched: boolean[],
): Finding | null {
  if (right.length > 3) return null;

  const contentLeft = left.filter((t) => isContentToken(t));
  if (contentLeft.length < 6) return null;

  const unmatchedContent = left.filter((t, i) => !leftMatched[i] && isContentToken(t));
  if (unmatchedContent.length < 6) return null;
  if (unmatchedContent.length < contentLeft.length * 0.55) return null;

  const firstUnmatched = left.findIndex((_, i) => !leftMatched[i]);
  return {
    direction: 'dropped',
    kind: 'entity',
    token: '[content-truncated]',
    verbatimIndex: firstUnmatched >= 0 ? firstUnmatched : 0,
  };
}

function polarityCount(tokens: string[]): number {
  let n = 0;
  for (const t of tokens) {
    if (isNegationToken(t)) n += 1;
  }
  return n;
}

function attachRewriteCharSpans(findings: Finding[], rewrite: string): void {
  const tokens = prepareFlat(rewrite);
  const spans = tokenCharSpans(rewrite, tokens);

  for (const f of findings) {
    if (f.rewriteIndex == null || f.rewriteIndex < 0 || f.rewriteIndex >= spans.length) {
      continue;
    }
    const span = spans[f.rewriteIndex];
    if (span) {
      f.rewriteCharStart = span.start;
      f.rewriteCharEnd = span.end;
    }
  }
}

function tokenCharSpans(text: string, normTokens: string[]): { start: number; end: number }[] {
  const raw = tokenize(text);
  const collapsed = collapseStammers(raw);
  const withoutFillers = stripFillers(collapsed);
  const spans: { start: number; end: number }[] = [];
  const lower = text.toLowerCase();
  let cursor = 0;

  for (const rawTok of withoutFillers) {
    const idx = lower.indexOf(rawTok.toLowerCase(), cursor);
    if (idx < 0) continue;
    const start = idx;
    const end = idx + rawTok.length;
    cursor = end;

    const expanded = CONTRACTION_EXPANSIONS.get(rawTok.toLowerCase());
    const parts = expanded ?? [rawTok.toLowerCase()];
    const normParts = parts.flatMap((p) => flattenNorm(normalizeSingleToken(p)));
    for (const _ of normParts) {
      if (spans.length < normTokens.length) {
        spans.push({ start, end });
      }
    }
  }

  while (spans.length < normTokens.length) {
    spans.push({ start: 0, end: text.length });
  }

  return spans;
}

function verdictLevel(findings: Finding[]): VerdictLevel {
  if (findings.some((f) => f.token === '[content-truncated]')) return 'high';
  if (findings.some((f) => f.kind === 'negation' || f.kind === 'number')) {
    return 'high';
  }
  if (findings.some((f) => f.kind === 'entity')) {
    return 'medium';
  }
  return 'clean';
}

/*
 * Known false positives
 * ---------------------
 * Keep this block. Add a line when the corpus finds a new class.
 *
 * - Unit abbreviation swaps that are not in UNIT_ALIASES may flag as entities
 *   (e.g. "tbsp" vs "tablespoon") until listed.
 * - Domain jargon that looks like a proper noun can flag as an inserted entity
 *   when the STT spelling differs from the rewrite spelling.
 * - Contraction normalisation (Im -> I'm) can flag an inserted entity on
 *   the expanded token (corpus clip-12).
 * - The English word "one" (as in "the green one") is treated as number 1 and
 *   can false-positive when a rewrite drops the filler noun (corpus clip-18).
 * - A stammer or repeated clause that repeats a NEGATIVE_PREDICATES word
 *   (e.g. "failed") inflates polarity count vs a cleaned single pass
 *   (corpus clip-19).
 * - Discourse "no" inside a self-correction ("Tuesday - no, Wednesday") can
 *   flag a dropped negation when the final intent is unchanged (corpus clip-16).
 * - Large rewrite truncation is summarised as [content-truncated]; individual
 *   dropped instruction words are not listed separately.
 */
