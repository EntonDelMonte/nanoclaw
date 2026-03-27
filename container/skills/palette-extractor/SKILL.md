# Palette Extractor

Extracts hex colour codes from a palette image (PNG) and saves them as a JSON file named after the source image. Works with any palette image — strips duplicates, preserves left-to-right order.

## When to Use

- User sends a colour palette image (PNG, JPEG)
- User says "use these colours" / "extract the palette" / "save these hex codes"
- After a `[Photo: /workspace/group/attachments/filename.png]` message containing a colour swatch

## Inputs

| Input | Description |
|-------|-------------|
| `image_path` | Absolute path to the image file (from `[Photo: ...]` tag or explicit path) |
| `project_path` | Absolute path to the current project folder (e.g. `/workspace/extra/obsidian/MnemClaw/projects/trsr`) |
| `n_colors` | Number of colours to extract (default: auto-detect all unique colours, max 20) |

## Workflow

### 1. Parse the image with Python stdlib

No external dependencies — uses only `zlib` and `struct` to decode PNG pixels directly.

```bash
python3 << 'PYEOF'
import sys, zlib, struct, json, os

IMAGE_PATH = "REPLACE_WITH_IMAGE_PATH"
PROJECT_PATH = "REPLACE_WITH_PROJECT_PATH"
N_MAX = 20  # cap to avoid noise from anti-aliasing

def read_png_pixels(path):
    with open(path, 'rb') as f:
        sig = f.read(8)
        if sig != b'\x89PNG\r\n\x1a\n':
            raise ValueError("Not a PNG file")

        width = height = bit_depth = color_type = 0
        idat = b''
        palette = []

        while True:
            length_bytes = f.read(4)
            if len(length_bytes) < 4:
                break
            length = struct.unpack('>I', length_bytes)[0]
            chunk_type = f.read(4).decode('ascii', errors='replace')
            data = f.read(length)
            f.read(4)  # CRC

            if chunk_type == 'IHDR':
                width, height = struct.unpack('>II', data[:8])
                bit_depth, color_type = data[8], data[9]
            elif chunk_type == 'PLTE':
                palette = [(data[i], data[i+1], data[i+2]) for i in range(0, len(data), 3)]
            elif chunk_type == 'IDAT':
                idat += data
            elif chunk_type == 'IEND':
                break

        raw = zlib.decompress(idat)
        pixels = []

        # color_type: 0=grayscale, 2=RGB, 3=indexed, 4=grayscale+alpha, 6=RGBA
        if color_type == 3 and palette:
            # Indexed colour — samples per pixel = 1
            stride = width + 1  # +1 for filter byte per row
            for y in range(height):
                row_start = y * stride + 1
                for x in range(width):
                    idx = raw[row_start + x]
                    pixels.append(palette[idx])
        elif color_type == 2:
            stride = width * 3 + 1
            for y in range(height):
                row_start = y * stride + 1
                for x in range(width):
                    o = row_start + x * 3
                    pixels.append((raw[o], raw[o+1], raw[o+2]))
        elif color_type == 6:
            stride = width * 4 + 1
            for y in range(height):
                row_start = y * stride + 1
                for x in range(width):
                    o = row_start + x * 4
                    pixels.append((raw[o], raw[o+1], raw[o+2]))
        elif color_type == 0:
            stride = width + 1
            for y in range(height):
                row_start = y * stride + 1
                for x in range(width):
                    v = raw[row_start + x]
                    pixels.append((v, v, v))

        return pixels, width, height

pixels, width, height = read_png_pixels(IMAGE_PATH)

# Deduplicate while preserving order (left-to-right, top-to-bottom)
seen = set()
unique = []
for p in pixels:
    key = p
    if key not in seen:
        seen.add(key)
        unique.append(p)
    if len(unique) >= N_MAX:
        break

hex_colors = ['#{:02X}{:02X}{:02X}'.format(r, g, b) for r, g, b in unique]

# Output JSON
stem = os.path.splitext(os.path.basename(IMAGE_PATH))[0]
# Strip photo_ prefix if present (from Telegram download)
if stem.startswith('photo_'):
    stem = stem[6:]

out = {
    "source": os.path.basename(IMAGE_PATH),
    "colors": hex_colors,
    "count": len(hex_colors),
    "dimensions": {"width": width, "height": height}
}

os.makedirs(PROJECT_PATH, exist_ok=True)
out_path = os.path.join(PROJECT_PATH, stem + '.json')
with open(out_path, 'w') as f:
    json.dump(out, f, indent=2)

print(json.dumps({"path": out_path, "colors": hex_colors, "count": len(hex_colors)}))
PYEOF
```

Replace `REPLACE_WITH_IMAGE_PATH` and `REPLACE_WITH_PROJECT_PATH` before running.

### 2. Interpret the output

The script prints a JSON object:
```json
{
  "path": "/workspace/.../palette-name.json",
  "colors": ["#2C1B47", "#7B4F8E", "#C9A0DC", "#F5D6E8", "#FFF5F0"],
  "count": 5
}
```

Read the `colors` array and confirm to the user:
- How many colours were extracted
- The hex values
- Where the JSON was saved

### 3. If the image is JPEG or another format

JPEG doesn't have a clean pixel layout. For non-PNG images:
1. Check if the file extension is `.jpg` or `.jpeg`
2. Use the JPEG approach: read unique colours by sampling evenly across rows — JPEG compression may introduce slight variations, so round each channel to the nearest 8 to reduce noise:
   ```python
   # Round channels to nearest 8 to collapse near-identical anti-aliased pixels
   key = (r >> 3 << 3, g >> 3 << 3, b >> 3 << 3)
   ```

### 4. Save path rules

| Context | Save to |
|---------|---------|
| Active project known | `{project_path}/{image_stem}.json` |
| No active project | `/workspace/group/palettes/{image_stem}.json` |

## Output Format

```json
{
  "source": "twilight-5-1x.png",
  "colors": ["#2C1B47", "#7B4F8E", "#C9A0DC", "#F5D6E8", "#FFF5F0"],
  "count": 5,
  "dimensions": { "width": 5, "height": 1 }
}
```

## Error Handling

- **File not found**: Check the path from the `[Photo: ...]` tag — the container path is `/workspace/group/attachments/filename`
- **Not a PNG**: The script raises `ValueError` — try the JPEG rounding approach instead
- **All pixels identical**: The palette image may be too small or the wrong file — confirm with the user
- **PNG with filter bytes**: The simple stride calculation above assumes `None` (0x00) filter per row. For filtered PNGs (filter byte ≠ 0), pixel values may be wrong. In that case, fall back to sampling every Nth pixel and rounding to nearest 16.
