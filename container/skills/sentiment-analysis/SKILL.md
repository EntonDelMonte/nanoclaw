---
name: sentiment-analysis
description: Classify emotional signals in community text — frustration, enthusiasm, confusion, anger, shock — with confidence scores and recommended actions. Zero external API dependency.
allowed-tools: Bash(sentiment-analysis:*), Read, Write
---
# Sentiment Analysis

## Overview

Classify the emotional tone and specific signals in community-sourced text (Reddit posts, GitHub issue comments, tweets, Telegram messages). Returns a structured classification with signal type, confidence, and a recommended action for Tribe Hub.

This skill uses the active LLM (no external sentiment API required). For high-volume batch classification, structured prompting with JSON output mode is used.

## Signal Taxonomy

| Signal | Definition | Tribe Hub Action |
|---|---|---|
| `frustration` | Repeated complaints, "why doesn't X work", negative threads, expressed disappointment | Flag immediately, draft de-escalation response |
| `enthusiasm` | Praise, sharing, feature requests with positive energy, gratitude | Amplify, engage, log as positive signal |
| `confusion` | FAQ repetition, "how do I", "I don't understand", unclear expectation | Flag as documentation gap |
| `anger` | Hostile language, public callouts, personal attacks, profanity directed at project | De-escalate only, escalate to Dan |
| `shock` | Sudden spike in mentions, viral threads, unexpected strong reaction (positive or negative) | Alert Dan, monitor trajectory |
| `neutral` | Factual questions, informational comments, no strong emotion | Standard response |
| `mixed` | Multiple signals present in same item | List all detected signals |

## Usage

### Single item classification prompt

Pass the following prompt to your active LLM with the text to classify:

```
Classify the emotional signal in this community message for an open-source software project.

Text: """
{TEXT}
"""

Platform: {PLATFORM}
Context: {OPTIONAL_CONTEXT}

Return JSON only:
{
  "signal": "frustration" | "enthusiasm" | "confusion" | "anger" | "shock" | "neutral" | "mixed",
  "signals": ["primary", "secondary"],  // list if mixed
  "confidence": 0.0-1.0,
  "intensity": "low" | "medium" | "high",
  "key_phrases": ["phrase that triggered classification"],
  "recommended_action": "one sentence describing what Tribe Hub should do",
  "escalate_to_dan": true | false
}
```

### Batch classification (multiple items)

```bash
# Write items to a temp JSON file, then classify each with LLM
# Input format: array of {id, platform, text} objects
# Output: same array with classification fields added
```

### Trend detection

After classifying a batch, aggregate signals to detect trends:

```bash
# Count by signal type
jq 'group_by(.signal) | map({signal: .[0].signal, count: length}) | sort_by(-.count)' classifications.json

# Flag if frustration > 20% of total in a 24h window
TOTAL=$(jq length classifications.json)
FRUSTRATION=$(jq '[.[] | select(.signal == "frustration")] | length' classifications.json)
echo "Frustration rate: $(echo "scale=2; $FRUSTRATION / $TOTAL * 100" | bc)%"
```

## Examples

### Input

```
Text: "I've been trying to get this working for 3 days. Nothing in the docs makes sense and every tutorial is outdated. Why is this project so hard to use??"
Platform: Reddit
```

### Expected Output

```json
{
  "signal": "frustration",
  "signals": ["frustration", "confusion"],
  "confidence": 0.95,
  "intensity": "high",
  "key_phrases": ["3 days", "nothing makes sense", "so hard to use"],
  "recommended_action": "Draft de-escalation response offering direct help; flag docs gap for project team",
  "escalate_to_dan": false
}
```

## Integration

Pass output directly to `community-response-draft` skill when `escalate_to_dan` is false and a response is warranted.

Pass to Dan immediately when `escalate_to_dan` is true (anger + high intensity, or shock with viral trajectory).

## Notes

- Confidence below 0.6: mark as `needs_human_review` and surface to Dan.
- Intensity `high` + signal `anger`: always set `escalate_to_dan: true`.
- For non-English text: note the language in output; translate key phrases for the log.
- This skill contains no external API calls — all classification is done by the active LLM.
