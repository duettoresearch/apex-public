/**
 * Why: Strip rules run on input and can stop matching silently when the source
 * is rewritten upstream. Scanning finished output instead catches the leak
 * regardless of which transform failed, which is why this gate — not the strip
 * rules — is what the release actually depends on.
 * What: Scans `src/generated/` and `public/` (and, with `--dist`, the built
 * `dist/`) against the generic patterns plus the private denylist, and exits
 * non-zero on any hit.
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

import { readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
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
