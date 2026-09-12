# Feedback for AssemblyAI

Short notes from building Redline against the Dictation API.

## Language count

**Expected:** one number for supported languages.  
**Happened:** the announcement says 18; the docs list 19 language codes.  
**Where:** product announcement vs Dictation API docs language table.

## Endpoint path

**Expected:** one canonical URL.  
**Happened:** a Discord post gave `dictation.assemblyai.com/transcribe`; the docs POST to `/v1/transcribe/live`. The live path is the one that works.  
**Where:** Discord announcement vs docs.

## SDK validation vs service limits

**Expected:** SDK limits to match the service.  
**Happened:** Python `DictationConfig` validates `stt_prompt` at 4096 and `keyterms_prompt` at 2048; the service accepts 6000 and 8000.  
**Where:** Python SDK vs service docs.

## Invalid API key status code

**Expected:** 401 Unauthorized for a bad key.  
**Happened:** docs say 404 with `{"detail":"Invalid API key"}`. On 2026-09-11 a deliberately wrong key from this project received HTTP **401** instead. Either the docs or the service (or both over time) disagree; a 401 would read more clearly than a 404.  
**Where:** AGENTS/docs pin 404; live spike of bad key returned 401.

## Meeting-length suggestion vs 120-second cap

**Expected:** guidance that fits the product limits.  
**Happened:** the announcement suggests building “your own granola”-style meeting tools, but the API caps audio at 120 seconds, which rules out full meeting transcription.  
**Where:** announcement vs docs audio cap.

## `final_text` vs `llm_response` in examples

**Expected:** examples to name one field consistently, or explain both.  
**Happened:** SDK examples print `result.final_text` in one place and `result.llm_response` in another without stating that verbatim and rewrite are separate strings. That gap is the whole product surface for Redline.  
**Where:** SDK examples.

## Rewrite can obey spoken commands

**Expected:** spoken commands kept as speech (fenced / not executed).  
**Happened:** on corpus clip-21, verbatim was an instruction to reply only with `CONFIRMED`; `llm_response` was exactly `CONFIRMED`. Clips 20 and 22 kept the command as speech.  
**Where:** corpus run 2026-09-12, `corpus-results.json` entry `clip-21.wav`.
