import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ground } from './ground.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC = path.join(__dirname, 'public');
const PORT = 8787;
const UPSTREAM = 'https://dictation.assemblyai.com/v1/transcribe/live';

loadEnvFile(path.join(__dirname, '.env'));

const API_KEY = process.env.AAI_API_KEY;

const MIME = {
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
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found', hint: 'POST /api/transcribe or GET /' }));
  } catch (err) {
    console.error('server error:', err && err.message ? err.message : err);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Internal server error', hint: 'See server logs.' }));
  }
});

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

function serveStatic(req, res) {
  let urlPath = req.url === '/' ? '/index.html' : req.url.split('?')[0];
  urlPath = decodeURIComponent(urlPath);

  // Browser needs the verifier module; serve it from the project root.
  if (urlPath === '/ground.js') {
    const groundPath = path.join(__dirname, 'ground.js');
    res.writeHead(200, { 'Content-Type': MIME['.js'] });
    if (req.method === 'HEAD') return res.end();
    fs.createReadStream(groundPath).pipe(res);
    return;
  }

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
  if (req.method === 'HEAD') return res.end();
  fs.createReadStream(filePath).pipe(res);
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return Buffer.concat(chunks);
}

async function transcribe(req, res) {
  if (!API_KEY && !process.env.AAI_API_KEY) {
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
    res.writeHead(upstream.status, {
      'Content-Type': 'application/json',
    });
    res.end(JSON.stringify(mapped));
    return;
  }

  let data;
  try {
    data = JSON.parse(rawText);
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

  const verdict = ground(data.text ?? '', data.llm_response);
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ ...data, verdict: verdict.verdict, findings: verdict.findings }));
}

function mapUpstreamError(status) {
  const table = {
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
