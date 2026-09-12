/**
 * Deterministic meaning checker: align verbatim transcript vs LLM rewrite.
 * No model calls. Findings are the product.
 * Erasable TypeScript only (Node --experimental-strip-types).
 */

export type VerdictLevel = 'none' | 'clean' | 'medium' | 'high';
export type FindingDirection = 'dropped' | 'inserted';
export type FindingKind = 'negation' | 'number' | 'entity';

export type Finding = {
  direction: FindingDirection;
  kind: FindingKind;
  token: string;
};

export type GroundResult = {
  verdict: { level: VerdictLevel };
  findings: Finding[];
};

type NormToken = string | string[];

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

  const left = prepare(String(verbatim ?? ''));
  const right = prepare(String(rewrite));

  const findings: Finding[] = [];
  findings.push(...diffNegations(left, right));
  findings.push(...diffNumbers(left, right));
  findings.push(...diffEntities(left, right));

  const level = verdictLevel(findings);
  return { verdict: { level }, findings };
}

function prepare(text: string): NormToken[] {
  const raw = tokenize(text);
  const collapsed = collapseStammers(raw);
  const withoutFillers = stripFillers(collapsed);
  return withoutFillers.map(normalizeToken);
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

function flatten(tokens: NormToken[]): string[] {
  const out: string[] = [];
  for (const t of tokens) {
    if (Array.isArray(t)) out.push(...t);
    else out.push(t);
  }
  return out;
}

function polarityCount(tokens: NormToken[]): number {
  let n = 0;
  for (const t of flatten(tokens)) {
    if (t === "n't" || NEGATIONS.has(t)) n += 1;
    else if (NEGATIVE_PREDICATES.has(t)) n += 1;
  }
  return n;
}

function diffNegations(left: NormToken[], right: NormToken[]): Finding[] {
  const findings: Finding[] = [];
  const leftBag = negationBag(left);
  const rightBag = negationBag(right);

  for (const [token, count] of leftBag) {
    const r = rightBag.get(token) ?? 0;
    for (let i = 0; i < count - r; i++) {
      findings.push({ direction: 'dropped', kind: 'negation', token });
    }
  }
  for (const [token, count] of rightBag) {
    const l = leftBag.get(token) ?? 0;
    for (let i = 0; i < count - l; i++) {
      findings.push({ direction: 'inserted', kind: 'negation', token });
    }
  }

  if (findings.length === 0 && polarityCount(left) !== polarityCount(right)) {
    findings.push({
      direction: polarityCount(left) > polarityCount(right) ? 'dropped' : 'inserted',
      kind: 'negation',
      token: '[polarity]',
    });
  }

  return findings;
}

function negationBag(tokens: NormToken[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const t of flatten(tokens)) {
    if (t === "n't" || NEGATIONS.has(t)) {
      const key = t === "n't" ? 'not' : t;
      m.set(key, (m.get(key) ?? 0) + 1);
    }
  }
  return m;
}

function diffNumbers(left: NormToken[], right: NormToken[]): Finding[] {
  const findings: Finding[] = [];
  const l = numberBag(left);
  const r = numberBag(right);

  for (const [token, count] of l) {
    const rc = r.get(token) ?? 0;
    for (let i = 0; i < count - rc; i++) {
      findings.push({ direction: 'dropped', kind: 'number', token });
    }
  }
  for (const [token, count] of r) {
    const lc = l.get(token) ?? 0;
    for (let i = 0; i < count - lc; i++) {
      findings.push({ direction: 'inserted', kind: 'number', token });
    }
  }
  return findings;
}

function numberBag(tokens: NormToken[]): Map<string, number> {
  const m = new Map<string, number>();
  const flat = flatten(tokens);
  const values: string[] = [];
  for (let i = 0; i < flat.length; i++) {
    const t = flat[i];
    if (!String(t).startsWith('num:')) continue;
    let v = Number(String(t).slice(4));
    if (i + 1 < flat.length && String(flat[i + 1]).startsWith('num:')) {
      const next = Number(String(flat[i + 1]).slice(4));
      if (next === 1000 || next === 1_000_000 || next === 1_000_000_000) {
        v = v * next;
        i += 1;
      }
    }
    values.push(String(v));
  }
  for (const v of values) {
    m.set(v, (m.get(v) ?? 0) + 1);
  }
  return m;
}

function diffEntities(left: NormToken[], right: NormToken[]): Finding[] {
  const findings: Finding[] = [];
  const leftSet = new Set(flatten(left).filter((t) => !String(t).startsWith('num:')));
  const rightTokens = flatten(right).filter((t) => !String(t).startsWith('num:'));

  for (const t of rightTokens) {
    if (leftSet.has(t)) continue;
    if (STOPWORDS.has(t)) continue;
    if (FILLERS.has(t)) continue;
    if (NEGATIONS.has(t)) continue;
    if (NEGATIVE_PREDICATES.has(t)) continue;
    if (UNIT_ALIASES.has(t)) continue;
    findings.push({ direction: 'inserted', kind: 'entity', token: t });
  }
  return findings;
}

function verdictLevel(findings: Finding[]): VerdictLevel {
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
 * - Contractions split unevenly ("cannot" vs "can't") can under-count negation
 *   if a form is missing from NEGATIONS.
 * - Contraction normalisation ("Im" -> "I'm") can flag an inserted entity on
 *   the expanded token (corpus clip-12).
 * - The English word "one" (as in "the green one") is treated as number 1 and
 *   can false-positive when a rewrite drops the filler noun (corpus clip-18).
 * - A stammer or repeated clause that repeats a NEGATIVE_PREDICATES word
 *   (e.g. "failed") inflates polarity count vs a cleaned single pass
 *   (corpus clip-19).
 * - Discourse "no" inside a self-correction ("Tuesday - no, Wednesday") can
 *   flag a dropped negation when the final intent is unchanged (corpus clip-16).
 */
