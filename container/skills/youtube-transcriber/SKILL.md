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

### 3. Clean the VTT into prose and split into chunks (Path A continuation)

VTT auto-captions contain timestamps, duplicate cue lines, and a `word< word` artifact from the timed-text prediction stream. Clean aggressively and split into ~8 KB chunks for structured formatting:

```bash
python3 << 'PYEOF'
import re, sys, glob, os, json

WORK_DIR = sys.argv[1]
CHUNK_DIR = sys.argv[2]  # e.g. /tmp/transcript_chunks
os.makedirs(CHUNK_DIR, exist_ok=True)

# Find the downloaded .vtt file
vtt_files = glob.glob(os.path.join(WORK_DIR, "*.vtt"))
if not vtt_files:
    print("NO_TRANSCRIPT")
    sys.exit(0)

vtt_path = vtt_files[0]
with open(vtt_path, encoding="utf-8") as f:
    raw = f.read()

# 1. Remove WEBVTT header, NOTE blocks, and timestamp lines
raw = re.sub(r'WEBVTT.*?\n\n', '', raw, flags=re.DOTALL)
raw = re.sub(r'NOTE\s.*?\n\n', '', raw, flags=re.DOTALL)
raw = re.sub(r'\d{2}:\d{2}:\d{2}\.\d{3} --> \d{2}:\d{2}:\d{2}\.\d{3}.*\n', '', raw)
raw = re.sub(r'^\w+\n', '', raw, flags=re.MULTILINE)

# 2. Remove HTML/timing tags including the timed-text prediction artifact:
#    Each caption cue shows rolling word predictions separated by `word< nextword`.
#    Removing `\S+< ` strips the stale prediction half, keeping the clean continuation.
raw = re.sub(r'<[^>]+>', '', raw)       # Remove <c>, <i>, <b> HTML tags
raw = re.sub(r'\S+< ', '', raw)         # Remove word< prediction artifacts

# 3. Deduplicate consecutive identical lines (VTT cue overlap)
lines = [l.strip() for l in raw.splitlines() if l.strip()]
deduped = []
prev = None
for line in lines:
    if line != prev:
        deduped.append(line)
    prev = line

# 4. Join and remove consecutive duplicate words
text = ' '.join(deduped)
text = re.sub(r'\b(\w+)\s+\1\b', r'\1', text)
text = re.sub(r'\b(\w+)\s+\1\b', r'\1', text)  # second pass for triple duplicates
text = re.sub(r'  +', ' ', text).strip()

# 5. Split into ~8000-char chunks at sentence boundaries
CHUNK_SIZE = 8000
chunks = []
start = 0
while start < len(text):
    end = start + CHUNK_SIZE
    if end >= len(text):
        chunks.append(text[start:])
        break
    boundary = max(
        text.rfind('. ', start, end),
        text.rfind('? ', start, end),
        text.rfind('! ', start, end),
    )
    if boundary <= start:
        boundary = text.rfind(' ', start, end)
    if boundary <= start:
        boundary = end
    else:
        boundary += 1
    chunks.append(text[start:boundary].strip())
    start = boundary

# Save chunks
for i, chunk in enumerate(chunks):
    with open(os.path.join(CHUNK_DIR, f'chunk_{i+1:02d}.txt'), 'w') as f:
        f.write(chunk)

print(json.dumps({"chunks": len(chunks), "total_chars": len(text)}))
PYEOF
```

---

### 4. Format each chunk into structured prose

After cleaning, process each chunk to add paragraph breaks and speaker labels. Do this in a loop — **never process all chunks in one pass** (context overflow risk):

```bash
CHUNK_DIR=/tmp/transcript_chunks
> "$CHUNK_DIR/formatted_output.txt"

for chunk_file in "$CHUNK_DIR"/chunk_*.txt; do
    chunk=$(cat "$chunk_file")
    # Read the chunk text and format it:
    # - Break into logical paragraphs (3–6 sentences each) at topic/speaker shifts
    # - Prefix speaker turns with **Speaker:** in bold when identifiable
    # - Keep [Applause], [Music] markers on their own line
    # - Preserve ALL words verbatim — no summarizing, no omissions, no corrections
    # - Filler words (uh, um, you know) must be kept
    # Then append to formatted_output.txt with a trailing blank line
    echo "" >> "$CHUNK_DIR/formatted_output.txt"
done
```

**You (the agent) perform the formatting mentally for each chunk — read it, then write the formatted version to `formatted_output.txt` using a heredoc or `tee -a`.**

---

### 5. Assemble final file

```bash
CHUNK_DIR=/tmp/transcript_chunks
OUT="/workspace/extra/obsidian/MnemClaw/youtube/<slug>.md"

# Combine: frontmatter (already written) + blank line + formatted body + footer
cat "$CHUNK_DIR/formatted_output.txt" >> "$OUT"
# Then append the JTAG footer block
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

- Save to `/workspace/extra/obsidian/MnemClaw/youtube/` — never to PDF Transcripts or elsewhere
- Always include `author` (channel name) and `video_id` in YAML
- If no transcript is available (private video, captions disabled), write the note anyway with `transcription-method: unavailable` and the video metadata
- For non-English videos: include `language:` field in YAML; do not translate
- Slug: kebab-case from title, max 60 chars, e.g. `how-transformers-work-andrej-karpathy.md`
- **Always chunk** — even short videos. Split cleaned text into ~8 KB chunks and format each one separately. Never paste the full raw transcript into your context in one shot.
- **No summarizing** — every word from the source must appear in the output. Paragraph breaks and speaker labels are the only additions.
- **Speaker labels** — infer from context when possible (**Name:**). Use **Speaker:** when unknown. Omit if the video has only one speaker.
- **Filler words** — keep all uh, um, you know, etc. This is a verbatim transcript.
- For very long videos (2h+), expect 10–15 chunks. Process sequentially.
