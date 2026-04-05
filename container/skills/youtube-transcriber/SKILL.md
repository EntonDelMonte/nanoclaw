---
name: youtube-transcriber
description: Fetch transcripts from YouTube videos (any length) and archive as Markdown in the Obsidian vault under "youtube/". Fetches existing captions when available; falls back to local whisper transcription for audio-only videos. No API key needed.
allowed-tools: Bash
---

# YouTube Transcriber

Fetches transcripts from any YouTube video using `yt-dlp`, cleans the VTT subtitle file into readable prose, and saves it as a structured Markdown note in the Obsidian vault.

Works with:
- Short clips and multi-hour lectures alike
- Auto-generated captions (any language)
- Manual/uploaded captions (preferred when available)
- YouTube Shorts, playlists (first video), and standard videos

---

## Transcribe Audio-Only Videos (No Captions)

When yt-dlp returns no transcript file, download audio and transcribe via local whisper:

```bash
WHISPER_URL="${WHISPER_URL:-http://host.docker.internal:9090}"

# Download audio only
yt-dlp \
  --extract-audio \
  --audio-format mp3 \
  --audio-quality 4 \
  --output "$WORK_DIR/audio.%(ext)s" \
  --no-playlist \
  "$VIDEO_URL" 2>&1

# Transcribe via whisper
curl -s "$WHISPER_URL/inference" \
  -F file="@$WORK_DIR/audio.mp3" \
  -F response_format="json" \
  | python3 -c "
import sys, json
try:
    result = json.load(sys.stdin)
    print(result.get('text', '').strip())
except:
    print('WHISPER_FAILED', file=sys.stderr)
    sys.exit(1)
"
```

**Note**: Add `transcription-source: whisper` to YAML header when using this method.

---

## Workflow

### Path A: Existing Captions Available

### 1. Download subtitles (no video download)

```bash
VIDEO_URL="https://www.youtube.com/watch?v=<ID>"
WORK_DIR=$(mktemp -d)

# Try manual subs first, fall back to auto-generated
yt-dlp \
  --write-subs \
  --write-auto-subs \
  --sub-lang "en.*,en" \
  --sub-format "vtt" \
  --skip-download \
  --no-playlist \
  --output "$WORK_DIR/%(title)s [%(id)s].%(ext)s" \
  "$VIDEO_URL" 2>&1
```

### 2. Get video metadata

```bash
yt-dlp --dump-json --skip-download --no-playlist "$VIDEO_URL" 2>/dev/null | \
  python3 -c "
import json, sys
d = json.load(sys.stdin)
print('TITLE:', d.get('title',''))
print('CHANNEL:', d.get('channel', d.get('uploader','')))
print('DATE:', d.get('upload_date',''))
print('DURATION:', d.get('duration_string', str(d.get('duration','')) + 's'))
print('URL:', d.get('webpage_url',''))
print('ID:', d.get('id',''))
print('DESCRIPTION:', (d.get('description') or '')[:300].replace('\n',' '))
"
```

### 3. Clean the VTT into prose

VTT files have timestamps and duplicate lines. Clean with Python: (see code below)

If `NO_TRANSCRIPT` is returned → **switch to Path B (whisper).**

---

### Path B: No Captions — Whisper Transcription

```bash
# Download audio only
yt-dlp \
  --extract-audio \
  --audio-format mp3 \
  --audio-quality 4 \
  --output "$WORK_DIR/audio.%(ext)s" \
  --no-playlist \
  "$VIDEO_URL" 2>&1

# Transcribe via whisper
WHISPER_URL="${WHISPER_URL:-http://host.docker.internal:9090}"
TEXT=$(curl -s "$WHISPER_URL/inference" \
  -F file="@$WORK_DIR/audio.mp3" \
  -F response_format="json" \
  | python3 -c "import sys,json; print(json.load(sys.stdin).get('text','').strip())")

# $TEXT now contains the transcript
```

---

### 3. Clean the VTT into prose (Path A continuation)

VTT files have timestamps and duplicate lines. Clean with Python:

```bash
python3 << 'EOF'
import re, sys, glob, os

# Find the downloaded .vtt file
vtt_files = glob.glob(os.path.join(sys.argv[1], "*.vtt"))
if not vtt_files:
    print("NO_TRANSCRIPT")
    sys.exit(0)

vtt_path = vtt_files[0]
with open(vtt_path, encoding="utf-8") as f:
    raw = f.read()

# Remove WEBVTT header and NOTE blocks
raw = re.sub(r'WEBVTT.*?\n\n', '', raw, flags=re.DOTALL)
raw = re.sub(r'NOTE\s.*?\n\n', '', raw, flags=re.DOTALL)

# Remove timestamp lines (00:00:00.000 --> 00:00:00.000 ...)
raw = re.sub(r'\d{2}:\d{2}:\d{2}\.\d{3} --> \d{2}:\d{2}:\d{2}\.\d{3}.*\n', '', raw)

# Remove cue identifiers (standalone numbers/words before timestamps)
raw = re.sub(r'^\w+\n', '', raw, flags=re.MULTILINE)

# Remove HTML tags (<c>, <i>, <b>, timing tags)
raw = re.sub(r'<[^>]+>', '', raw)

# Split into lines, deduplicate consecutive identical fragments
lines = [l.strip() for l in raw.splitlines() if l.strip()]
deduped = []
prev = None
for line in lines:
    if line != prev:
        deduped.append(line)
    prev = line

# Join into paragraphs: split on long gaps (lines ending with . ? !)
text = ' '.join(deduped)
# Add paragraph breaks after sentence-ending punctuation followed by capital letter
text = re.sub(r'([.!?])\s+([A-Z])', r'\1\n\n\2', text)

print(text.strip())
EOF
```

---

## Output Format

Save to: `/workspace/extra/obsidian/MnemClaw/youtube/<slug-from-title>.md`

```markdown
---
title: "<Video Title>"
author: "<Channel Name>"
source: "<YouTube URL>"
video_id: "<11-char ID>"
published: "<YYYY-MM-DD>"
duration: "<HH:MM:SS or MM:SS>"
extracted: "<YYYY-MM-DD>"
transcription-source: "captions" | "whisper" | "unavailable"
maturity: transcript
status: archived
tags:
  - youtube-transcript
  - <topic tags>
description: "<One-sentence summary from video description or first lines of transcript>"
---

# <Video Title>

> *[<Channel Name>](<YouTube URL>) · <duration> · Published <date>*

---

<cleaned transcript text with paragraph breaks>

---

## JTAG Annotation
Type: YouTube Transcript
Scope: <subject area or field>
Maturity: Transcript — auto-generated captions, cleaned
Cross-links: <[[related vault notes if known]]>
Key Components: <main topics or themes covered in the video>
```

---

## Rules

- Save to `/workspace/extra/obsidian/youtube/` — never to PDF Transcripts or elsewhere
- Always include `author` (channel name) and `video_id` in YAML
- If no transcript is available (private video, captions disabled), write the note anyway with `transcription-method: unavailable` and the video metadata
- For non-English videos: include `language:` field in YAML; do not translate
- Slug: kebab-case from title, max 60 chars, e.g. `how-transformers-work-andrej-karpathy.md`
- For very long videos (2h+), the transcript may be large — write it in full, do not truncate
