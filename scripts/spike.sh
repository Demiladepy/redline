#!/usr/bin/env bash
# Spike the AssemblyAI Dictation API with fixtures/clip-01.wav.
set -u

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [ -z "${AAI_API_KEY:-}" ]; then
  echo "AAI_API_KEY is not set. Export it in this shell before running." >&2
  exit 1
fi

if [ ! -f fixtures/clip-01.wav ]; then
  echo "fixtures/clip-01.wav not found." >&2
  exit 1
fi

tmp="$(mktemp)"
trap 'rm -f "$tmp"' EXIT

http_code="$(
  curl -sS -o "$tmp" -w "%{http_code}" \
    -X POST "https://dictation.assemblyai.com/v1/transcribe/live" \
    -H "Authorization: ${AAI_API_KEY}" \
    -F "config={};type=application/json" \
    -F "audio=@fixtures/clip-01.wav;type=audio/wav"
)"

echo "HTTP status: ${http_code}"
echo "--- body ---"
cat "$tmp"
echo
echo "--- end ---"

if [ "$http_code" = "404" ]; then
  echo "404 here means a bad API key, not a bad URL."
fi
