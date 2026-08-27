/**
 * Why: Strip rules run on input and can stop matching silently when the source
 * is rewritten upstream. Scanning finished output instead catches the leak
 * regardless of which transform failed, which is why this gate — not the strip
 * rules — is what the release actually depends on.
 * What: Scans `src/generated/` and `public/` (and, with `--dist`, the built
 * `dist/`) against the generic patterns plus the private denylist, and exits
 * non-zero on any hit. Also reads the images in `public/` with Tesseract when
 * it is installed, warning on any word it can make out — a name rendered into a
 * picture is invisible to a string scan.
 * Test: mirrored as a Vitest suite in `src/tests/leak.test.ts`, so `npm test`
 *       fails on a leak even when nobody runs this script.
 *
 * The private denylist is optional HERE by design. This script also runs inside
 * `npm run build`, which must work on a deployment host that has no access to
 * the private tokens — it validates a snapshot generated on a machine that did.
 * `npm run content`, which produces a snapshot, refuses to run without it.
 *
 * Usage:
 *   tsx scripts/leak-check.ts          # scan src/generated/ and public/
 *   tsx scripts/leak-check.ts --dist   # also scan dist/
 */

import { execFileSync } from 'node:child_process';
import { readdir } from 'node:fs/promises';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  SCANNABLE_EXTENSIONS,
  denylistStatus,
  formatFindings,
  loadPrivateDenylist,
  scanFiles,
} from './lib/forbidden.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

/** Image types the OCR pass reads. */
const IMAGE_EXTENSIONS = ['.png', '.webp', '.jpg', '.jpeg'];

/**
 * Reads the images in `public/` and reports any word Tesseract recognises.
 *
 * Warns rather than fails, for two reasons. Tesseract is not installed
 * everywhere this gate runs, so a hard failure would turn a missing tool into a
 * broken build; and OCR invents short words out of texture, so a hit is a
 * prompt to look rather than proof of a leak. The real defence for the one
 * image this applies to is `scripts/prepare-hero-graph.ts`, which destroys the
 * label pixels and refuses to write a file while any survive. This pass exists
 * to catch the next image somebody drops into `public/` without running it.
 */
async function ocrImages(dir: string): Promise<void> {
  try {
    execFileSync('which', ['tesseract'], { stdio: 'ignore' });
  } catch {
    console.log('[leak-check] tesseract not installed — skipping the image text scan');
    return;
  }

  const images: string[] = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (entry.isFile() && IMAGE_EXTENSIONS.includes(extname(entry.name).toLowerCase())) {
      images.push(join(dir, entry.name));
    }
  }
  if (images.length === 0) return;

  const tmp = mkdtempSync(join(tmpdir(), 'leak-ocr-'));
  try {
    for (const image of images) {
      const stem = join(tmp, 'ocr');
      try {
        execFileSync('tesseract', [image, stem, '--psm', '11', 'tsv'], { stdio: 'ignore' });
      } catch {
        continue;
      }
      const words = readFileSync(`${stem}.tsv`, 'utf8')
        .split('\n')
        .slice(1)
        .map((line) => (line.split('\t')[11] ?? '').trim())
        .filter((text) => /[A-Za-z]{3,}/.test(text));
      if (words.length > 0) {
        console.warn(
          `[leak-check] WARNING ${image}: ${words.length} word(s) readable — ` +
            `${words.slice(0, 6).join(', ')}`,
        );
      }
    }
    console.log(`[leak-check] ${images.length} image(s) scanned for readable text in ${dir}`);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

/** Every scannable file under a directory, recursively. */
export async function collectScannable(dir: string): Promise<string[]> {
  const out: string[] = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await collectScannable(full)));
    else if (SCANNABLE_EXTENSIONS.includes(extname(entry.name))) out.push(full);
  }
  return out;
}

async function main(): Promise<void> {
  const denylist = loadPrivateDenylist(ROOT);
  console.log(denylistStatus(denylist));

  const targets = [join(ROOT, 'src', 'generated'), join(ROOT, 'public')];
  if (process.argv.includes('--dist')) targets.push(join(ROOT, 'dist'));

  let total = 0;
  for (const target of targets) {
    if (!existsSync(target)) {
      console.log(`[leak-check] ${target} does not exist — skipping`);
      continue;
    }
    const files = await collectScannable(target);
    const findings = await scanFiles(files, ROOT, denylist);
    console.log(`[leak-check] ${files.length} files scanned in ${target}`);
    if (findings.length > 0) {
      console.error(`[leak-check] ${findings.length} finding(s):`);
      console.error(formatFindings(findings));
      total += findings.length;
    }
  }

  const publicDir = join(ROOT, 'public');
  if (existsSync(publicDir)) await ocrImages(publicDir);

  if (total > 0) {
    console.error(`[leak-check] FAILED — ${total} forbidden string(s) in published output`);
    process.exit(1);
  }
  console.log('[leak-check] clean');
}

main().catch((err: unknown) => {
  console.error(`[leak-check] FAILED: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
