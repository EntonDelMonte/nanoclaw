/**
 * Image processing utilities for NanoClaw.
 * Downloads an image from a URL, resizes it to fit within 1024px on the
 * longest side, and returns the result as a base64 string with its MIME type.
 */
import fs from 'fs';
import https from 'https';
import http from 'http';
import path from 'path';

// sharp is an optional native dependency — load lazily so a missing binary
// doesn't crash the host process at startup.
let sharpModule: typeof import('sharp') | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  sharpModule = require('sharp') as typeof import('sharp');
} catch {
  // sharp not available (e.g. native binary missing after cross-platform install)
  // processImage will fall back to returning the raw image without resizing.
}

export interface ProcessedImage {
  base64: string;
  mimeType: string;
}

/**
 * Download raw bytes from a URL (http or https).
 */
function downloadBuffer(url: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const get = url.startsWith('https') ? https.get : http.get;
    get(url, (res) => {
      if (
        res.statusCode &&
        res.statusCode >= 300 &&
        res.statusCode < 400 &&
        res.headers.location
      ) {
        // Follow one redirect
        downloadBuffer(res.headers.location).then(resolve).catch(reject);
        res.resume();
        return;
      }
      if (res.statusCode && res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode} downloading image`));
        res.resume();
        return;
      }
      const chunks: Buffer[] = [];
      res.on('data', (chunk: Buffer) => chunks.push(chunk));
      res.on('end', () => resolve(Buffer.concat(chunks)));
      res.on('error', reject);
    }).on('error', reject);
  });
}

/**
 * Download an image from `url`, resize to fit within `maxDimension` px on the
 * longest side (preserving aspect ratio), and return base64 + mimeType.
 *
 * The output is always JPEG (good compression, universally supported by Claude).
 */
export async function processImage(
  url: string,
  maxDimension = 1024,
): Promise<ProcessedImage> {
  const raw = await downloadBuffer(url);

  if (sharpModule) {
    const resized = await sharpModule(raw)
      .resize(maxDimension, maxDimension, {
        fit: 'inside',
        withoutEnlargement: true,
      })
      .jpeg({ quality: 85 })
      .toBuffer();
    return { base64: resized.toString('base64'), mimeType: 'image/jpeg' };
  }

  // Fallback: pass raw image without resizing (sharp not available)
  return { base64: raw.toString('base64'), mimeType: 'image/jpeg' };
}

/**
 * Download an image from `url` and save it to `destPath` (without resizing).
 * Used to persist a local copy alongside the base64 for container access.
 */
export function downloadToFile(url: string, destPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    fs.mkdirSync(path.dirname(destPath), { recursive: true });
    const file = fs.createWriteStream(destPath);
    const get = url.startsWith('https') ? https.get : http.get;
    get(url, (res) => {
      if (
        res.statusCode &&
        res.statusCode >= 300 &&
        res.statusCode < 400 &&
        res.headers.location
      ) {
        file.close();
        fs.unlink(destPath, () => {});
        downloadToFile(res.headers.location, destPath)
          .then(resolve)
          .catch(reject);
        res.resume();
        return;
      }
      res.pipe(file);
      file.on('finish', () => file.close(() => resolve()));
      file.on('error', (err) => {
        fs.unlink(destPath, () => {});
        reject(err);
      });
    }).on('error', (err) => {
      fs.unlink(destPath, () => {});
      reject(err);
    });
  });
}
