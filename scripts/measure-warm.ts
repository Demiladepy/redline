#!/usr/bin/env node
/**
 * R11: measure round-trip latency cold vs connection-pre-warmed.
 * Uses fixtures/clip-01.wav against the live Dictation API.
 *
 * Cold: fresh Node subprocess per request (forces full TLS handshake).
 * Warm: same process; GET /v1/warm immediately before each transcribe.
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const CLIP = path.join(ROOT, 'fixtures', 'clip-01.wav');
const ONCE = path.join(__dirname, 'transcribe-once.ts');
const WARM = 'https://dictation.assemblyai.com/v1/warm';
const RUNS = 10;

loadEnvFile(path.join(ROOT, '.env'));
if (!process.env.AAI_API_KEY) {
  console.error('AAI_API_KEY is not set.');
  process.exit(1);
}
if (!fs.existsSync(CLIP)) {
  console.error(`Missing ${CLIP}`);
  process.exit(1);
}

console.log(`Measuring ${RUNS} cold + ${RUNS} warmed on ${path.basename(CLIP)}`);
console.log('Cold = fresh Node process per run. Warm = GET /v1/warm then POST in-process.');
console.log('');

const coldMs: number[] = [];
for (let i = 0; i < RUNS; i++) {
  const ms = runOnceSubprocess();
  if (ms == null) {
    console.error('Cold run failed; aborting.');
    process.exit(1);
  }
  coldMs.push(ms);
  console.log(`cold ${i + 1}/${RUNS}: ${ms} ms`);
  await sleep(500);
}

console.log('');

const warmMs: number[] = [];
for (let i = 0; i < RUNS; i++) {
  await warmInProcess();
  const ms = await transcribeInProcess();
  warmMs.push(ms);
  console.log(`warm ${i + 1}/${RUNS}: ${ms} ms`);
  await sleep(500);
}

const coldStats = stats(coldMs);
const warmStats = stats(warmMs);

console.log('');
console.log('| Mode | n | median (ms) | p95 (ms) |');
console.log('| --- | ---: | ---: | ---: |');
console.log(`| Cold (fresh process each run) | ${RUNS} | ${coldStats.median} | ${coldStats.p95} |`);
console.log(`| Warm (GET /v1/warm + shared process pool) | ${RUNS} | ${warmStats.median} | ${warmStats.p95} |`);
console.log('');
const delta = coldStats.median - warmStats.median;
const pct = coldStats.median > 0 ? Math.round((delta / coldStats.median) * 100) : 0;
console.log(`Delta median: ${delta} ms (${pct}% faster warmed)`);

function runOnceSubprocess(): number | null {
  const result = spawnSync(
    process.execPath,
    ['--experimental-strip-types', ONCE],
    {
      cwd: ROOT,
      env: process.env,
      encoding: 'utf8',
    },
  );
  if (result.status !== 0) {
    console.error(result.stderr || result.stdout);
    return null;
  }
  const ms = Number.parseInt(String(result.stdout).trim(), 10);
  return Number.isFinite(ms) ? ms : null;
}

async function warmInProcess(): Promise<void> {
  try {
    await fetch(WARM, { method: 'GET', signal: AbortSignal.timeout(5_000) });
  } catch {
    // best-effort
  }
}

async function transcribeInProcess(): Promise<number> {
  const audio = fs.readFileSync(CLIP);
  const form = new FormData();
  form.append(
    'config',
    new Blob([JSON.stringify({ sample_rate: 16000, channels: 1 })], {
      type: 'application/json',
    }),
  );
  form.append('audio', new Blob([audio], { type: 'audio/wav' }), 'clip-01.wav');

  const t0 = performance.now();
  const res = await fetch('https://dictation.assemblyai.com/v1/transcribe/live', {
    method: 'POST',
    headers: { Authorization: process.env.AAI_API_KEY! },
    body: form,
    signal: AbortSignal.timeout(90_000),
  });
  const body = await res.text();
  const elapsed = Math.round(performance.now() - t0);
  if (!res.ok) {
    throw new Error(`upstream ${res.status}: ${body.slice(0, 200)}`);
  }
  return elapsed;
}

function stats(values: number[]): { median: number; p95: number } {
  const sorted = [...values].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)] ?? 0;
  const p95 = sorted[Math.ceil(sorted.length * 0.95) - 1] ?? sorted[sorted.length - 1] ?? 0;
  return { median, p95 };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
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
