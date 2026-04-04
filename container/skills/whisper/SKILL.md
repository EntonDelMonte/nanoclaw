---
name: whisper
description: Local voice transcription via whisper.cpp running on the host Mac with Metal GPU. Transcribe audio files to text. No API key required.
allowed-tools: Bash
---

# Whisper Transcription

Local whisper.cpp server running on the host Mac with Metal GPU acceleration (Apple M1 Max). Accepts common audio formats.

**No API key required — self-hosted.**

```bash
WHISPER_URL="${WHISPER_URL:-http://host.docker.internal:9090}"
```

---

## Transcribe an audio file

```bash
WHISPER_URL="${WHISPER_URL:-http://host.docker.internal:9090}"
curl -s "$WHISPER_URL/inference" \
  -F file="@/path/to/audio.ogg" \
  -F response_format="json" \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['text'].strip())"
```

Supported formats: `.wav`, `.mp3`, `.ogg`, `.m4a`, `.flac`, `.webm`, `.mp4`

---

## Response formats

| `response_format` | Output |
|-------------------|--------|
| `json` | `{"text": "..."}` |
| `text` | Plain text |
| `verbose_json` | Full segments with timestamps |
| `srt` | SRT subtitle format |
| `vtt` | WebVTT format |

---

## With timestamps (verbose_json)

```bash
WHISPER_URL="${WHISPER_URL:-http://host.docker.internal:9090}"
curl -s "$WHISPER_URL/inference" \
  -F file="@/path/to/audio.wav" \
  -F response_format="verbose_json" \
  | python3 -c "
import sys, json
d = json.load(sys.stdin)
for seg in d.get('segments', []):
    print(f\"[{seg['start']:.1f}s] {seg['text'].strip()}\")
"
```

---

## Rules

- Always set `WHISPER_URL="${WHISPER_URL:-http://host.docker.internal:9090}"` at the top of each script block
- Use `response_format="json"` for most use cases — returns `{"text": "..."}`
- Model: `ggml-small.en` — English only, fast, accurate
- If the server is down: `curl http://host.docker.internal:9090/` should return an HTML page
