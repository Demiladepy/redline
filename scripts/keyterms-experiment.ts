#!/usr/bin/env node
/**
 * PRD §8 / S2: run two clips with default config and an over-stuffed keyterms list.
 * Compares verbatim vs rewrite and prints ground() findings.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ground, findingCategory } from '../ground.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const UPSTREAM = 'https://dictation.assemblyai.com/v1/transcribe/live';

const CLIPS = ['clip-01.wav', 'clip-12.wav'];

/** Common words stuffed into keyterms — S2 warns this can cause overcorrection. */
const OVERSTUFFED_KEYTERMS = [
  'the',
  'and',
  'is',
  'was',
  'are',
  'to',
  'of',
  'in',
  'for',
  'on',
  'with',
  'a',
  'an',
  'patient',
  'doctor',
  'hospital',
  'medicine',
  'allergic',
  'penicillin',
  'transfer',
  'account',
  'meeting',
  'report',
  'please',
  'thank',
  'hello',
  'yes',
  'no',
  'not',
  'call',
  'book',
  'flight',
  'morning',
  'tuesday',
  'friday',
  'money',
  'payment',
  'invoice',
  'email',
  'phone',
  'address',
  'name',
  'company',
  'team',
  'project',
  'review',
  'update',
  'confirm',
  'cancel',
  'schedule',
  'tomorrow',
  'today',
  'yesterday',
  'week',
  'month',
  'year',
  'time',
  'date',
  'number',
  'amount',
  'total',
  'price',
  'cost',
  'service',
  'support',
  'help',
  'question',
  'answer',
  'information',
  'details',
  'document',
  'file',
  'data',
  'system',
  'server',
  'client',
  'user',
  'admin',
  'login',
  'password',
  'security',
  'access',
  'error',
  'success',
  'failed',
  'complete',
  'pending',
  'active',
  'inactive',
  'status',
  'record',
  'note',
  'message',
  'send',
  'receive',
  'open',
  'close',
  'start',
  'stop',
  'continue',
  'finish',
  'begin',
  'end',
];

loadEnvFile(path.join(ROOT, '.env'));
const API_KEY = process.env.AAI_API_KEY;
if (!API_KEY) {
  console.error('AAI_API_KEY is not set.');
  process.exit(1);
}

type ConfigLabel = 'default' | 'overstuffed';

for (const clip of CLIPS) {
  console.log(`\n=== ${clip} ===`);
  for (const label of ['default', 'overstuffed'] as ConfigLabel[]) {
    const config =
      label === 'default'
        ? {}
        : { keyterms_prompt: OVERSTUFFED_KEYTERMS.slice(0, 100) };
    const result = await transcribe(clip, config);
    if (result.error) {
      console.log(`  [${label}] ERROR: ${result.error}`);
      continue;
    }
    const checked = ground(result.text ?? '', result.llm_response);
    console.log(`  [${label}] verdict=${checked.verdict.level} llm_error=${result.llm_error ?? 'null'}`);
    console.log(`    text: ${JSON.stringify(result.text ?? '')}`);
    console.log(`    llm_response: ${JSON.stringify(result.llm_response ?? '')}`);
    if (checked.findings.length) {
      for (const f of checked.findings) {
        console.log(
          `    finding: ${f.direction} ${findingCategory(f)} (${f.kind}) token=${f.token}`,
        );
      }
    } else {
      console.log('    findings: none');
    }
    await sleep(1500);
  }
}

async function transcribe(
  file: string,
  config: Record<string, unknown>,
): Promise<{
  text?: string | null;
  llm_response?: string | null;
  llm_error?: string | null;
  error?: string;
}> {
  const audioPath = path.join(ROOT, 'fixtures', file);
  const audio = fs.readFileSync(audioPath);
  const form = new FormData();
  form.append(
    'config',
    new Blob([JSON.stringify(config)], { type: 'application/json' }),
  );
  form.append('audio', new Blob([audio], { type: 'audio/wav' }), file);

  try {
    const res = await fetch(UPSTREAM, {
      method: 'POST',
      headers: { Authorization: API_KEY as string },
      body: form,
      signal: AbortSignal.timeout(90_000),
    });
    const raw = await res.text();
    if (!res.ok) {
      return { error: `upstream ${res.status}: ${raw.slice(0, 120)}` };
    }
    const data = JSON.parse(raw) as {
      text?: string;
      llm_response?: string | null;
      llm_error?: string | null;
    };
    return {
      text: data.text ?? null,
      llm_response: data.llm_response ?? null,
      llm_error: data.llm_error ?? null,
    };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function loadEnvFile(filePath: string): void {
  if (process.env.AAI_API_KEY) return;
  if (!fs.existsSync(filePath)) return;
  const text = fs.readFileSync(filePath, 'utf8');
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const m = trimmed.match(/^AAI_API_KEY\s*=\s*(.*)$/);
    if (m) {
      process.env.AAI_API_KEY = m[1].trim().replace(/^['"]|['"]$/g, '');
    }
  }
}
