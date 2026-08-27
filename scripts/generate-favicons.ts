/**
 * Why: `public/favicon.svg` is the real icon, but Safari's pinned tabs and iOS
 * home screens do not read it, and a browser that finds no `/favicon.ico` asks
 * for one on every navigation and logs a 404. Both fallbacks have to exist as
 * files, and hand-exported binaries drift from the SVG the moment it changes.
 * What: Rasterises `public/favicon.svg` into `public/favicon.ico` (32px) and
 * `public/apple-touch-icon.png` (180px). Re-run it after any edit to the SVG.
 * Test: `curl -I` on each path returns 200 — recorded on the pull request.
 *
 * Usage:
 *   tsx scripts/generate-favicons.ts
 */

import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE = join(ROOT, 'public', 'favicon.svg');

/**
 * Wraps a PNG in a single-image ICO container.
 *
 * Every browser that still asks for `favicon.ico` accepts a PNG payload inside
 * the container, so there is no bitmap encoder here — just the 6-byte directory
 * header and the 16-byte entry that point at the PNG bytes.
 */
function pngToIco(png: Buffer, size: number): Buffer {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(1, 4); // one image

  const entry = Buffer.alloc(16);
  entry.writeUInt8(size < 256 ? size : 0, 0); // width, 0 means 256
  entry.writeUInt8(size < 256 ? size : 0, 1); // height
  entry.writeUInt8(0, 2); // palette size
  entry.writeUInt8(0, 3); // reserved
  entry.writeUInt16LE(1, 4); // colour planes
  entry.writeUInt16LE(32, 6); // bits per pixel
  entry.writeUInt32LE(png.byteLength, 8);
  entry.writeUInt32LE(header.byteLength + entry.byteLength, 12);

  return Buffer.concat([header, entry, png]);
}

async function main(): Promise<void> {
  const ico32 = await sharp(SOURCE, { density: 384 }).resize(32, 32).png().toBuffer();
  const icoPath = join(ROOT, 'public', 'favicon.ico');
  writeFileSync(icoPath, pngToIco(ico32, 32));
  console.log(`[favicons] wrote ${icoPath} — 32px, ${ico32.byteLength + 22} bytes`);

  // iOS composites the icon on its own background and applies its own corner
  // mask, so this one is flattened onto the tile colour rather than left with
  // the SVG's transparent corners.
  const applePath = join(ROOT, 'public', 'apple-touch-icon.png');
  const apple = await sharp(SOURCE, { density: 384 })
    .resize(180, 180)
    .flatten({ background: '#0e2124' })
    .png({ compressionLevel: 9 })
    .toBuffer();
  writeFileSync(applePath, apple);
  console.log(`[favicons] wrote ${applePath} — 180px, ${apple.byteLength} bytes`);
}

main().catch((err: unknown) => {
  console.error(`[favicons] FAILED: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
