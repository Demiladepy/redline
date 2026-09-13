import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = readFileSync(path.join(root, 'ground.ts'), 'utf8');
const start = src.indexOf('export const WORD_CONFIDENCE_THRESHOLD');
let body = src.slice(start);
body = body
  .replace(/^export type[\s\S]*?^type NormToken[\s\S]*?;\r?\n\r?\n/m, '')
  .replace(/new Map<string, string\[\]>/g, 'new Map')
  .replace(/new Map<string, string>/g, 'new Map')
  .replace(/new Map<string, number>/g, 'new Map')
  .replace(/FILLER_PHRASES: string\[\]\[\]/g, 'FILLER_PHRASES')
  .replace(/KNOWN_LIMITS: string\[\]/g, 'KNOWN_LIMITS')
  .replace(/return UNIT_ALIASES\.get\(t\)!;/g, 'return UNIT_ALIASES.get(t);')
  .replace(/ as DropCause/g, '')
  .replace(/: DropCause =/g, ' =')
  .replace(
    /\):\s*\{\s*leftMatched:\s*boolean\[\];\s*rightMatched:\s*boolean\[\]\s*\}\s*\{/g,
    ') {',
  )
  .replace(/\):\s*\{\s*leftMatched;\s*rightMatched\s*\}\s*\{/g, ') {')
  .replace(/\):\s*\{\s*start:\s*number;\s*end:\s*number\s*\}\[\]\s*\{/g, ') {')
  .replace(/\):\s*(?:GroundResult|FindingCategory|AnnotatedFinding\[\]|Finding\[\]|Finding \| null|void|VerdictLevel|FindingKind \| null)\s*\{/g, ') {')
  .replace(/const dp:\s*number\[\]\[\]/g, 'const dp')
  .replace(/const spans:\s*\{\s*start:\s*number;\s*end:\s*number\s*\}\[\]/g, 'const spans')
  .replace(/\(f: Finding\)/g, '(f)')
  .replace(/^\s*findings: Finding\[\],/gm, '  findings,')
  .replace(/\(findings: Finding\[\]/g, '(findings')
  .replace(/^\s*verbatim: string,/gm, '  verbatim,')
  .replace(/rewrite: string \| null \| undefined,/g, 'rewrite,')
  .replace(/words\?: WordConfidence\[\] \| null,/g, 'words,')
  .replace(/: string\[\](?=[),])/g, '')
  .replace(/: boolean\[\](?=[),])/g, '')
  .replace(/: number\[\]\[\](?=[),])/g, '')
  .replace(/: NormToken(?=[),])/g, '')
  .replace(/: string(?=[),])/g, '')
  .replace(/: Finding(?=\))/g, '')
  .replace(/: AnnotatedFinding\[\] \{/g, ' {')
  .replace(/: FindingCategory \{/g, ' {')
  .replace(/: GroundResult \{/g, ' {')
  .replace(/: Finding\[\] \{/g, ' {')
  .replace(/: Finding \| null \{/g, ' {')
  .replace(/: FindingKind \| null \{/g, ' {')
  .replace(/: VerdictLevel \{/g, ' {')
  .replace(/: string\[\] \{/g, ' {')
  .replace(/: string \{/g, ' {')
  .replace(/: void \{/g, ' {')
  .replace(/const out: string\[\] =/g, 'const out =')
  .replace(/const findings: Finding\[\] =/g, 'const findings =')
  .replace(/const spans: \{\s*start: number;\s*end: number\s*\}\[\]/g, 'const spans')
  .replace(/direction: FindingDirection,/g, 'direction,')
  .replace(/: NormToken/g, '')
  .replace(/: FindingDirection/g, '')
  .replace(/: FindingKind \| null/g, '')
  .replace(/: boolean/g, '')
  .replace(/: number/g, '')
  .replace(/: string\[\]/g, '')
  .replace(/: Finding\[\]/g, '')
  .replace(/: string/g, '');

const js = `/**
 * Browser parity with ground.ts — run: node scripts/sync-ground-js.mjs
 */

${body}`;
writeFileSync(path.join(root, 'public', 'ground.js'), js);
console.log('synced public/ground.js');
