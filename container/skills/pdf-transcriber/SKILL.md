---
name: pdf-transcriber
description: Extract text from PDF files page by page, correct common transcription errors, and archive as Markdown files with YAML front-matter in the Obsidian vault under "PDF Transcripts". Use whenever you need to ingest a PDF into the knowledge base.
allowed-tools: Bash(pdftotext:*), Read, Write, Bash
---

# PDF Transcriber

Extracts text from PDFs algorithmically (via `pdftotext`), cleans up common extraction artefacts, annotates page numbers, and saves the result as a structured Markdown file in the Obsidian vault.

---

## Prerequisites

`pdftotext` (poppler-utils) is installed in the container. No additional setup needed.

---

## Workflow

### 1. Get page count

```bash
pdfinfo "<file.pdf>" | grep "^Pages:"
```

### 2. Extract full text (layout-preserving)

```bash
pdftotext -layout "<file.pdf>" "/tmp/raw_extract.txt"
```

### 3. Extract page by page (for page markers)

```bash
# Loop N pages — inserts a page marker before each page's text
python3 - <<'EOF'
import subprocess, sys

pdf = sys.argv[1] if len(sys.argv) > 1 else "/tmp/input.pdf"
result = subprocess.run(["pdfinfo", pdf], capture_output=True, text=True)
pages = int([l for l in result.stdout.splitlines() if l.startswith("Pages:")][0].split(":")[1].strip())

output = []
for p in range(1, pages + 1):
    r = subprocess.run(["pdftotext", "-layout", "-f", str(p), "-l", str(p), pdf, "-"],
                       capture_output=True, text=True)
    text = r.stdout.strip()
    if text:
        output.append(f"\n\n<!-- page {p} -->\n\n{text}")

print("\n".join(output))
EOF
```

Or simpler with bash:

```bash
PAGES=$(pdfinfo "$PDF" | grep "^Pages:" | awk '{print $2}')
for p in $(seq 1 $PAGES); do
  echo -e "\n\n<!-- page $p -->\n"
  pdftotext -layout -f $p -l $p "$PDF" -
done
```

### 4. Common artefact corrections (apply after extraction)

Use `sed` or Python string replacements for:

| Pattern | Fix |
|---|---|
| Soft hyphens `­` (U+00AD) | Remove |
| Broken hyphenation `word-\n` | Join as `word` |
| Ligatures `ﬁ ﬂ ﬀ ` | Replace with `fi fl ff` |
| Multiple blank lines (3+) | Collapse to two |
| Trailing whitespace on lines | Strip |
| `l` vs `1` / `O` vs `0` in numbers | Review in context (flag, don't auto-fix) |
| Smart quotes `"" ''` | Preserve as-is (valid UTF-8) |

Quick correction pipeline:

```bash
sed -E \
  -e 's/\xc2\xad//g' \
  -e 's/-[[:space:]]*\n([a-z])/\1/g' \
  -e 's/ﬁ/fi/g; s/ﬂ/fl/g; s/ﬀ/ff/g' \
  -e 's/[[:blank:]]+$//' \
  -e '/^$/N;/^\n$/d' \
  /tmp/raw_extract.txt
```

---

## Output Format

Save to: `/workspace/extra/obsidian/PDF Transcripts/<SlugifiedTitle>.md`

```markdown
---
title: "Full Document Title"
author: "<first author surname, or organisation/company/institution if no individual author>"
source: "<original filename or URL>"
pages: <N>
extracted: <YYYY-MM-DD>
maturity: transcript
status: archived
tags:
  - pdf-transcript
  - <topic tags>
description: "One-sentence summary of the document."
---

# Full Document Title

> *Extracted from: `<source>`  — <N> pages*

---

<!-- page 1 -->

<page 1 text>

---

<!-- page 2 -->

<page 2 text>

...

---

## JTAG Annotation
Type: PDF Transcript
Scope: <subject area or field>
Maturity: Transcript — algorithmically extracted, not manually reviewed
Cross-links: <[[related vault notes if known]]>
Key Components: <main topics, arguments, or sections found in the document>
```

---

## Rules

- Always include an `author` field in the YAML — use the first/primary author's surname, or the group, institution, or company name if there is no individual author
- Always use the `<!-- page N -->` HTML comment marker before each page's content — never omit page numbers
- Preserve section headings if clearly identifiable from capitalisation or whitespace patterns
- Do **not** silently fix `1`/`l` or `0`/`O` ambiguities — leave a `[?]` flag inline if uncertain
- If the PDF is scanned (image-only), note `transcription-method: ocr-unavailable` in the YAML and explain that `pdftotext` returned no text
- Folder path: always `/workspace/extra/obsidian/PDF Transcripts/`
- File name: kebab-case slug of title, e.g. `annual-report-2025.md`
