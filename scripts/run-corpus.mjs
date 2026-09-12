#!/usr/bin/env node
/**
 * Run every fixtures/clip-*.wav through the Dictation API and ground().
 * Writes corpus-results.json. Rate-limited to ~1 req/s; one 429 retry.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ground } from '../ground.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const FIXTURES = path.join(ROOT, 'fixtures');
const OUT = path.join(ROOT, 'corpus-results.json');
const UPSTREAM = 'https://dictation.assemblyai.com/v1/transcribe/live';

loadEnvFile(path.join(ROOT, '.env'));
const API_KEY = process.env.AAI_API_KEY;
if (!API_KEY) {
  console.error('AAI_API_KEY is not set.');
  process.exit(1);
}

const files = fs
  .readdirSync(FIXTURES)
  .filter((f) => /^clip-\d+\.wav$/i.test(f))
  .sort((a, b) => {
    const na = Number(a.match(/(\d+)/)[1]);
    const nb = Number(b.match(/(\d+)/)[1]);
    return na - nb;
  });

if (!files.length) {
  console.error('No fixtures/clip-*.wav files found.');
  process.exit(1);
}

const results = [];
for (let i = 0; i < files.length; i++) {
  const file = files[i];
  const entry = await transcribeOne(file);
  results.push(entry);
  console.log(
    `${file}: verdict=${entry.verdict ?? entry.error ?? '?'} findings=${(entry.findings || []).length}`,
  );
  if (i < files.length - 1) await sleep(1000);
}

fs.writeFileSync(OUT, JSON.stringify(results, null, 2) + '\n');
console.log(`Wrote ${OUT} (${results.length} clips)`);

async function transcribeOne(file) {
  const audioPath = path.join(FIXTURES, file);
  const audio = fs.readFileSync(audioPath);

  let attempt = 0;
  while (attempt < 2) {
    attempt += 1;
    try {
      const form = new FormData();
      form.append(
        'config',
        new Blob([JSON.stringify({})], { type: 'application/json' }),
      );
      form.append('audio', new Blob([audio], { type: 'audio/wav' }), file);

      const res = await fetch(UPSTREAM, {
        method: 'POST',
        headers: { Authorization: API_KEY },
        body: form,
        signal: AbortSignal.timeout(90_000),
      });

      const raw = await res.text();
      if (res.status === 429) {
        if (attempt === 1) {
          console.warn(`${file}: 429 — waiting 5s and retrying once`);
          await sleep(5000);
          continue;
        }
        return {
          file,
          error: 'rate_limited',
          status: 429,
          verdict: null,
          findings: [],
        };
      }

      if (!res.ok) {
        console.error(`${file}: upstream ${res.status}`);
        return {
          file,
          error: `upstream_${res.status}`,
          status: res.status,
          verdict: null,
          findings: [],
        };
      }

      const data = JSON.parse(raw);
      const checked = ground(data.text ?? '', data.llm_response);
      return {
        file,
        text: data.text ?? null,
        llm_response: data.llm_response ?? null,
        llm_error: data.llm_error ?? null,
        confidence: data.confidence ?? null,
        request_time_ms: data.request_time_ms ?? null,
        verdict: checked.verdict.level,
        findings: checked.findings,
      };
    } catch (err) {
      return {
        file,
        error: String(err && err.message ? err.message : err),
        verdict: null,
        findings: [],
      };
    }
  }
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function loadEnvFile(filePath) {
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
