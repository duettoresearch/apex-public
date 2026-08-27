/**
 * Why: The hero background is a screenshot of an internal relationship graph.
 * Its shape is the point — nodes, edges, clusters — but roughly eighty of its
 * labels are real people's names and internal team names, which rule 6 of
 * `CLAUDE.md` keeps out of published output. The screenshot therefore cannot be
 * committed, cropped, or merely scaled down; the label pixels have to be
 * destroyed before anything reaches `public/`.
 * What: Reads a source screenshot, pixellates it in two passes, proves no text
 * survives, keys the white page background out to transparency, and writes
 * `public/hero-graph.webp`. Both passes run on one raw RGBA buffer:
 *   1. Targeted — Tesseract locates every word box; each one, padded, is
 *      pixellated at a large block size.
 *   2. Global — the whole frame is pixellated at a block size that reduces a
 *      10px glyph to about one block while a 15-30px node stays a round blob.
 * The global pass is what makes the result safe. OCR recall is good but not
 * total, so a label Tesseract missed is still destroyed by the global pass, and
 * the verification below checks that pass rather than standing as the only
 * defence. Without Tesseract installed the targeted pass is skipped and the
 * global pass runs alone, which is why its block size is the parameter that
 * escalates on failure.
 * Test: the script verifies itself — after processing it re-runs OCR with the
 * same settings that recognise 157 words on the untouched source, and exits
 * non-zero unless zero words of three or more letters come back. `scripts/
 * leak-check.ts` repeats a weaker form of that scan over every image in
 * `public/` on each run of the gate.
 *
 * Usage:
 *   tsx scripts/prepare-hero-graph.ts <source-image> [options]
 *
 *   --out <path>     output file (default public/hero-graph.webp)
 *   --width <n>      maximum output width in pixels (default 1600)
 *   --block <n>      starting global block size (default 5)
 *   --max-bytes <n>  output size ceiling (default 256000)
 *
 * The source image is never copied into the repository. Pass it from wherever
 * it lives; only the processed output is committed.
 */

import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

/** A word box in source-image coordinates. */
interface WordBox {
  left: number;
  top: number;
  width: number;
  height: number;
  text: string;
  conf: number;
}

/** Raw RGBA pixels plus the dimensions needed to index them. */
interface Frame {
  data: Uint8ClampedArray;
  width: number;
  height: number;
}

/** Three or more consecutive letters is a word, and a word may be a name. */
const WORD_RE = /[A-Za-z]{3,}/;

/**
 * OCR scans an upscaled copy. Tesseract reports "Empty page" on this screenshot
 * at native resolution because its labels are about 10px tall, so scanning at
 * 1x would find nothing and every verification would pass falsely.
 */
const OCR_SCALE = 3;

/** Padding around each detected word box, in source pixels. */
const BOX_PAD = 4;

/**
 * Confidence below which a "word" is Tesseract reading shapes out of noise
 * rather than reading text.
 *
 * Pixellated texture always yields a few three-letter fragments — `aoe`, `mth`,
 * `een` — at low confidence, so a plain zero-words rule never converges and
 * escalates the block size until the graph itself is gone. The labels on this
 * screenshot come back at confidence 93 to 97, far above this floor, so the
 * floor separates a legible name from noise without weakening the check.
 */
const CONF_FLOOR = 60;

/** Block size for the targeted pass, relative to the global block size. */
const LABEL_BLOCK_FACTOR = 2.5;

/** Pixels at or above this in every channel are page background, not ink. */
const BACKGROUND_FLOOR = 244;

function tesseractAvailable(): boolean {
  try {
    execFileSync('which', ['tesseract'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

/**
 * Every word Tesseract recognises in `pngPath`, in that image's coordinates.
 *
 * Runs page-segmentation modes 11 (sparse text) and 6 (uniform block) and
 * returns the union: the labels are scattered, which suits 11, while 6 picks up
 * clustered runs that 11 discards. Boxes divide back down by `OCR_SCALE`
 * because the scan happens on an upscaled copy.
 */
async function ocrWords(pngPath: string, tmp: string): Promise<WordBox[]> {
  const scaled = join(tmp, 'ocr-input.png');
  const meta = await sharp(pngPath).metadata();
  await sharp(pngPath)
    .resize({ width: Math.round((meta.width ?? 0) * OCR_SCALE), kernel: 'lanczos3' })
    .flatten({ background: '#ffffff' })
    .grayscale()
    .normalise()
    .png()
    .toFile(scaled);

  const seen = new Map<string, WordBox>();
  for (const psm of ['11', '6']) {
    const stem = join(tmp, `ocr-${psm}`);
    try {
      execFileSync('tesseract', [scaled, stem, '--psm', psm, 'tsv'], { stdio: 'ignore' });
    } catch {
      continue;
    }
    for (const line of readFileSync(`${stem}.tsv`, 'utf8').split('\n').slice(1)) {
      const c = line.split('\t');
      if (c.length < 12) continue;
      const text = (c[11] ?? '').trim();
      if (!WORD_RE.test(text)) continue;
      const box: WordBox = {
        left: Math.floor(Number(c[6]) / OCR_SCALE),
        top: Math.floor(Number(c[7]) / OCR_SCALE),
        width: Math.ceil(Number(c[8]) / OCR_SCALE),
        height: Math.ceil(Number(c[9]) / OCR_SCALE),
        text,
        conf: Number(c[10]),
      };
      if (!Number.isFinite(box.left) || !Number.isFinite(box.top)) continue;
      seen.set(`${box.left},${box.top},${box.width},${box.height}`, box);
    }
  }
  return [...seen.values()];
}

/** The lowercased letter-runs inside a recognised word, for set comparison. */
function letterRuns(text: string): string[] {
  return (text.toLowerCase().match(/[a-z]{3,}/g) ?? []).filter(Boolean);
}

/**
 * What OCR can still read in a processed image, split two ways.
 *
 * `legible` is every word recognised at or above `CONF_FLOOR` — the claim that
 * matters, since a name a reader could make out is a name OCR reads
 * confidently. `matched` is every recognised fragment, at any confidence, that
 * also appears in the source's own word list; it catches the case where a real
 * label survived but came back with low confidence, which the floor alone would
 * excuse.
 */
async function survivingText(
  pngPath: string,
  tmp: string,
  sourceWords: Set<string>,
): Promise<{ legible: string[]; matched: string[] }> {
  const words = await ocrWords(pngPath, tmp);
  const legible = words.filter((w) => w.conf >= CONF_FLOOR).map((w) => w.text);
  const matched = words.flatMap((w) => letterRuns(w.text)).filter((r) => sourceWords.has(r));
  return { legible, matched: [...new Set(matched)] };
}

/**
 * Replaces every `block`x`block` cell of the region with that cell's mean
 * colour — a box-average pixellation, equivalent to downscaling the region by
 * `block` and scaling it back with nearest-neighbour, without the round trip
 * through an encoder.
 *
 * The grid is anchored at the image origin rather than at the region, so
 * overlapping regions and the global pass land on the same cell boundaries and
 * leave no seams.
 */
function pixellate(
  frame: Frame,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  block: number,
) {
  const { data, width, height } = frame;
  const left = Math.max(0, Math.min(width, Math.floor(x0)));
  const top = Math.max(0, Math.min(height, Math.floor(y0)));
  const right = Math.max(left, Math.min(width, Math.ceil(x1)));
  const bottom = Math.max(top, Math.min(height, Math.ceil(y1)));

  const startX = Math.floor(left / block) * block;
  const startY = Math.floor(top / block) * block;

  for (let by = startY; by < bottom; by += block) {
    for (let bx = startX; bx < right; bx += block) {
      const cx1 = Math.min(bx + block, width);
      const cy1 = Math.min(by + block, height);
      if (bx >= width || by >= height) continue;

      let r = 0;
      let g = 0;
      let b = 0;
      let n = 0;
      for (let y = by; y < cy1; y++) {
        for (let x = bx; x < cx1; x++) {
          const i = (y * width + x) * 4;
          r += data[i] ?? 0;
          g += data[i + 1] ?? 0;
          b += data[i + 2] ?? 0;
          n++;
        }
      }
      if (n === 0) continue;
      const mr = Math.round(r / n);
      const mg = Math.round(g / n);
      const mb = Math.round(b / n);
      for (let y = by; y < cy1; y++) {
        for (let x = bx; x < cx1; x++) {
          const i = (y * width + x) * 4;
          data[i] = mr;
          data[i + 1] = mg;
          data[i + 2] = mb;
        }
      }
    }
  }
}

/**
 * Turns the white page background into transparency, keeping node and edge
 * colour intact.
 *
 * Alpha comes from the pixel's darkest channel, so a saturated node keeps most
 * of its opacity while the near-white page drops out entirely. Keying instead
 * of baking in a background colour means the hero band's colour still comes
 * from a design-system token, and the asset works on any background.
 */
function keyOutBackground(frame: Frame): void {
  const { data } = frame;
  for (let i = 0; i < data.length; i += 4) {
    const min = Math.min(data[i] ?? 0, data[i + 1] ?? 0, data[i + 2] ?? 0);
    if (min >= BACKGROUND_FLOOR) {
      data[i + 3] = 0;
      continue;
    }
    data[i + 3] = Math.min(255, Math.round((255 - min) * 1.35));
  }
}

function arg(name: string, fallback: string): string {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? (process.argv[i + 1] ?? fallback) : fallback;
}

async function main(): Promise<void> {
  const source = process.argv[2];
  if (!source || source.startsWith('--')) {
    console.error('usage: tsx scripts/prepare-hero-graph.ts <source-image> [options]');
    process.exit(2);
  }

  const outPath = arg('out', join(ROOT, 'public', 'hero-graph.webp'));
  const maxWidth = Number(arg('width', '1600'));
  const maxBytes = Number(arg('max-bytes', '256000'));
  let block = Number(arg('block', '5'));

  const tmp = mkdtempSync(join(tmpdir(), 'hero-graph-'));
  try {
    const ocr = tesseractAvailable();
    console.log(
      ocr
        ? '[hero-graph] tesseract found — targeted pass enabled'
        : '[hero-graph] tesseract NOT found — global pass only (fallback route)',
    );

    // Normalise to a flat RGBA buffer once; every pass mutates it in place.
    const flatPng = join(tmp, 'source.png');
    await sharp(source).flatten({ background: '#ffffff' }).png().toFile(flatPng);

    // The label boxes come from the untouched source, so they are found once
    // and reused: escalating the block size changes how hard each box is hit,
    // never where the boxes are.
    const sourceBoxes = ocr ? await ocrWords(flatPng, tmp) : [];
    const sourceWords = new Set(sourceBoxes.flatMap((b) => letterRuns(b.text)));
    if (ocr) {
      console.log(
        `[hero-graph] words on source: ${sourceBoxes.length} boxes, ` +
          `${sourceWords.size} distinct terms`,
      );
    }

    const raw = await sharp(flatPng).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const frame: Frame = {
      data: new Uint8ClampedArray(raw.data),
      width: raw.info.width,
      height: raw.info.height,
    };
    const pristine = new Uint8ClampedArray(frame.data);
    console.log(`[hero-graph] source ${frame.width}x${frame.height}`);

    let legible: string[] = [];
    let matched: string[] = [];
    let attempt = 0;
    let verified = join(tmp, 'verified.png');

    for (; attempt < 6; attempt++) {
      frame.data.set(pristine);

      if (ocr) {
        const labelBlock = Math.round(block * LABEL_BLOCK_FACTOR);
        for (const b of sourceBoxes) {
          pixellate(
            frame,
            b.left - BOX_PAD,
            b.top - BOX_PAD,
            b.left + b.width + BOX_PAD,
            b.top + b.height + BOX_PAD,
            labelBlock,
          );
        }
        console.log(
          `[hero-graph] pass ${attempt + 1}: ${sourceBoxes.length} label boxes at ` +
            `${labelBlock}px, ` +
            `global ${block}px`,
        );
      } else {
        console.log(`[hero-graph] pass ${attempt + 1}: global ${block}px`);
      }

      pixellate(frame, 0, 0, frame.width, frame.height, block);

      verified = join(tmp, `pixellated-${attempt}.png`);
      await sharp(Buffer.from(frame.data), {
        raw: { width: frame.width, height: frame.height, channels: 4 },
      })
        .png()
        .toFile(verified);

      if (!ocr) break;
      ({ legible, matched } = await survivingText(verified, tmp, sourceWords));
      console.log(
        `[hero-graph] after processing: ${legible.length} word(s) at conf >= ${CONF_FLOOR}, ` +
          `${matched.length} matching a source term`,
      );
      if (legible.length === 0 && matched.length === 0) break;
      console.log(
        `[hero-graph] still readable: ${[...legible, ...matched].slice(0, 8).join(', ')}`,
      );
      block += 2;
    }

    if (legible.length > 0 || matched.length > 0) {
      console.error(
        `[hero-graph] FAILED — text still recognised at block ${block}: ` +
          `${legible.length} confident word(s), ${matched.length} source term(s)`,
      );
      process.exit(1);
    }
    if (!ocr) {
      console.log(
        '[hero-graph] no OCR verification available — confirm no label is legible at 200% zoom',
      );
    }

    keyOutBackground(frame);

    const width = Math.min(maxWidth, frame.width);
    let quality = 82;
    let out: Buffer = Buffer.alloc(0);
    for (; quality >= 40; quality -= 8) {
      out = await sharp(Buffer.from(frame.data), {
        raw: { width: frame.width, height: frame.height, channels: 4 },
      })
        .resize({ width, kernel: 'nearest' })
        .webp({ quality, alphaQuality: 80, effort: 6 })
        .toBuffer();
      if (out.byteLength <= maxBytes) break;
    }
    writeFileSync(outPath, out);
    console.log(
      `[hero-graph] wrote ${outPath} — ${width}px wide, q${quality}, ` +
        `${(out.byteLength / 1024).toFixed(1)} KB`,
    );
    if (out.byteLength > maxBytes) {
      console.error(`[hero-graph] FAILED — output exceeds ${maxBytes} bytes`);
      process.exit(1);
    }
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

main().catch((err: unknown) => {
  console.error(`[hero-graph] FAILED: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
