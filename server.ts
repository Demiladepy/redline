import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { ground } from './ground.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC = path.join(__dirname, 'public');
const PORT = 8787;
const UPSTREAM = 'https://dictation.assemblyai.com/v1/transcribe/live';

loadEnvFile(path.join(__dirname, '.env'));

type ErrorBody = { error: string; hint: string };

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.wav': 'audio/wav',
};

const server = http.createServer(async (req, res) => {
  try {
    if (req.method === 'GET' || req.method === 'HEAD') {
      return serveStatic(req, res);
    }
    if (req.method === 'POST' && req.url === '/api/transcribe') {
      return await transcribe(req, res);
    }
    if (req.method === 'POST' && req.url === '/api/check') {
      return await check(req, res);
    }
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found', hint: 'POST /api/transcribe or GET /' }));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('server error:', message);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Internal server error', hint: 'See server logs.' }));
  }
});

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

function serveStatic(req: IncomingMessage, res: ServerResponse): void {
  let urlPath = req.url === '/' ? '/index.html' : (req.url ?? '/').split('?')[0];
  urlPath = decodeURIComponent(urlPath);

  const filePath = path.normalize(path.join(PUBLIC, urlPath));
  if (!filePath.startsWith(PUBLIC)) {
    res.writeHead(403).end();
    return;
  }
  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    res.writeHead(404, { 'Content-Type': 'text/plain' }).end('Not found');
    return;
  }
  const ext = path.extname(filePath);
  res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
  if (req.method === 'HEAD') {
    res.end();
    return;
  }
  fs.createReadStream(filePath).pipe(res);
}

async function readBody(req: IncomingMessage): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

async function check(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const raw = await readBody(req);
  let body: { text?: string; llm_response?: string | null };
  try {
    body = JSON.parse(raw.toString('utf8')) as { text?: string; llm_response?: string | null };
  } catch {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Invalid JSON', hint: 'Send { text, llm_response }.' }));
    return;
  }
  const result = ground(body.text ?? '', body.llm_response);
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(result));
}

async function transcribe(req: IncomingMessage, res: ServerResponse): Promise<void> {
  if (!process.env.AAI_API_KEY) {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify({
        error: 'Server missing AAI_API_KEY',
        hint: 'Set AAI_API_KEY in the environment before starting the server.',
      }),
    );
    return;
  }

  const audio = await readBody(req);
  if (!audio.length) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify({
        error: 'Empty body',
        hint: 'POST raw WAV bytes to /api/transcribe.',
      }),
    );
    return;
  }

  const form = new FormData();
  form.append(
    'config',
    new Blob([JSON.stringify({ sample_rate: 16000, channels: 1 })], {
      type: 'application/json',
    }),
  );
  form.append('audio', new Blob([audio], { type: 'audio/wav' }), 'clip.wav');

  const upstream = await fetch(UPSTREAM, {
    method: 'POST',
    headers: { Authorization: process.env.AAI_API_KEY },
    body: form,
    signal: AbortSignal.timeout(90_000),
  });

  const rawText = await upstream.text();
  if (!upstream.ok) {
    console.error('upstream status', upstream.status, 'body length', rawText.length);
    const mapped = mapUpstreamError(upstream.status);
    res.writeHead(upstream.status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(mapped));
    return;
  }

  let data: Record<string, unknown>;
  try {
    data = JSON.parse(rawText) as Record<string, unknown>;
  } catch {
    console.error('upstream non-JSON body', rawText.slice(0, 200));
    res.writeHead(502, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify({
        error: 'Transcription upstream is unavailable. Try again.',
        hint: 'Upstream returned a non-JSON body.',
      }),
    );
    return;
  }

  const text = typeof data.text === 'string' ? data.text : '';
  const llmResponse =
    data.llm_response === null || typeof data.llm_response === 'string'
      ? (data.llm_response as string | null)
      : null;
  const checked = ground(text, llmResponse);
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(
    JSON.stringify({
      ...data,
      verdict: checked.verdict,
      findings: checked.findings,
    }),
  );
}

function mapUpstreamError(status: number): ErrorBody {
  const table: Record<number, ErrorBody> = {
    400: {
      error: 'The request was malformed — config must precede audio.',
      hint: 'Check multipart part order.',
    },
    401: {
      error: 'Invalid API key. The Dictation API returns 404 for this, not 401.',
      hint: 'Verify AAI_API_KEY. (This run saw upstream 401; docs describe 404.)',
    },
    404: {
      error: 'Invalid API key. The Dictation API returns 404 for this, not 401.',
      hint: 'Verify AAI_API_KEY.',
    },
    413: {
      error: 'That clip was too large. The cap is 120 seconds.',
      hint: 'Record a shorter clip.',
    },
    415: {
      error: 'The audio format was rejected. This endpoint takes WAV or raw PCM only.',
      hint: 'Use 16-bit PCM WAV from the AudioWorklet path.',
    },
    429: {
      error: 'Rate limited. Wait a moment and try again.',
      hint: 'Backoff and retry once.',
    },
    503: {
      error: 'The service is at capacity. Try again shortly.',
      hint: 'Temporary capacity limit.',
    },
    502: {
      error: 'Transcription upstream is unavailable. Try again.',
      hint: 'Bad gateway from upstream.',
    },
    504: {
      error: 'Transcription upstream is unavailable. Try again.',
      hint: 'Upstream timed out.',
    },
  };
  return (
    table[status] || {
      error: 'Transcription request failed.',
      hint: `Upstream status ${status}.`,
    }
  );
}

server.listen(PORT, () => {
  console.log(`Redline listening on http://localhost:${PORT}`);
});
