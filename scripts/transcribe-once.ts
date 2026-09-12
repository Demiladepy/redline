#!/usr/bin/env node
/** One transcribe round-trip; prints elapsed ms on stdout. Used by measure-warm.ts cold runs. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const CLIP = path.join(ROOT, 'fixtures', 'clip-01.wav');
const UPSTREAM = 'https://dictation.assemblyai.com/v1/transcribe/live';

loadEnvFile(path.join(ROOT, '.env'));
const API_KEY = process.env.AAI_API_KEY;
if (!API_KEY) {
  console.error('AAI_API_KEY is not set.');
  process.exit(1);
}

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
const res = await fetch(UPSTREAM, {
  method: 'POST',
  headers: { Authorization: API_KEY },
  body: form,
  signal: AbortSignal.timeout(90_000),
});
const body = await res.text();
if (!res.ok) {
  console.error(`upstream ${res.status}: ${body.slice(0, 200)}`);
  process.exit(1);
}
console.log(String(Math.round(performance.now() - t0)));

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
