/**
 * Why: `npm run leak-check` only protects the people who remember to run it. The
 * same gate belongs in the test suite so CI and a pre-commit run both fail on a
 * leak without anyone opting in.
 *
 * No fixture below embeds a real secret. Every generic pattern carries its own
 * synthetic sample, and the private-tier tests use a denylist constructed in the
 * test itself — this repository is public, so a test that hard-coded a real
 * token would leak it exactly as a committed denylist would.
 *
 * What: Asserts each generic pattern still matches, that a private token is
 * caught and redacted in output, that vetted ticket tokens pass, and that the
 * committed snapshot is clean.
 * Test: this file
 */

import { describe, expect, it } from 'vitest';
import { readdir, readFile } from 'node:fs/promises';
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { extname, join } from 'node:path';
import {
  ALLOWED_TICKET_TOKENS,
  GENERIC_PATTERNS,
  denylistStatus,
  formatFindings,
  loadPrivateDenylist,
  scanText,
  SCANNABLE_EXTENSIONS,
} from '../../scripts/lib/forbidden.ts';

const ROOT = join(import.meta.dirname, '..', '..');
const GENERATED = join(ROOT, 'src', 'generated');
const PUBLIC = join(ROOT, 'public');

/** A synthetic token, so the suite exercises the private tier without one. */
const FAKE_PRIVATE_TOKEN = 'Zzyzx Codename';

async function collect(dir: string): Promise<string[]> {
  const out: string[] = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await collect(full)));
    else if (SCANNABLE_EXTENSIONS.includes(extname(entry.name))) out.push(full);
  }
  return out;
}

describe('generic patterns', () => {
  it('every pattern matches its own sample', () => {
    expect(GENERIC_PATTERNS.length).toBeGreaterThan(0);
    for (const pattern of GENERIC_PATTERNS) {
      const findings = scanText(pattern.sample, 'x.md');
      expect(
        findings.some((f) => f.rule === pattern.rule),
        `${pattern.rule} stopped matching its sample`,
      ).toBe(true);
    }
  });

  it('each pattern builds a fresh regex, so a repeat scan finds the same hit', () => {
    for (const pattern of GENERIC_PATTERNS) {
      const first = scanText(pattern.sample, 'x.md').length;
      const second = scanText(pattern.sample, 'x.md').length;
      expect(second, pattern.rule).toBe(first);
    }
  });

  it('flags an unknown ticket key', () => {
    expect(scanText('see ZZZ-999 for context', 'x.md').map((f) => f.match)).toContain(
      'ZZZ-999',
    );
  });

  it('allows the vetted schema example ids', () => {
    for (const token of ALLOWED_TICKET_TOKENS) {
      const findings = scanText(`example: ${token}`, 'x.md').filter(
        (f) => f.rule === 'ticket-key',
      );
      expect(findings, token).toHaveLength(0);
    }
  });

  it('allows a products path template but flags a concrete one', () => {
    const template = scanText('products/{domain}/{product}/initiatives/{slug}/', 'x.md');
    expect(template.filter((f) => f.rule === 'product-path')).toHaveLength(0);

    const concrete = scanText('products/alpha/beta/initiatives/x/', 'x.md');
    expect(concrete.filter((f) => f.rule === 'product-path')).toHaveLength(1);
  });
});

describe('private denylist', () => {
  it('flags a token supplied at runtime', () => {
    const findings = scanText(`a line naming ${FAKE_PRIVATE_TOKEN} here`, 'x.md', [
      FAKE_PRIVATE_TOKEN,
    ]);
    expect(findings.map((f) => f.rule)).toContain('private-denylist');
  });

  it('matches a private token regardless of casing', () => {
    const findings = scanText(FAKE_PRIVATE_TOKEN.toUpperCase(), 'x.md', [FAKE_PRIVATE_TOKEN]);
    expect(findings).toHaveLength(1);
  });

  it('redacts the token when reporting, so a build log is not a leak', () => {
    const findings = scanText(FAKE_PRIVATE_TOKEN, 'x.md', [FAKE_PRIVATE_TOKEN]);
    const report = formatFindings(findings);
    expect(report).toContain('<redacted private token>');
    expect(report).not.toContain(FAKE_PRIVATE_TOKEN);
  });

  it('finds nothing when no denylist is loaded', () => {
    expect(scanText(FAKE_PRIVATE_TOKEN, 'x.md')).toHaveLength(0);
  });

  it('says plainly whether it is loaded', () => {
    expect(denylistStatus(['a', 'b'])).toContain('2 tokens loaded');
    expect(denylistStatus([])).toContain('WARNING');
  });
});

describe('denylist parsing', () => {
  /**
   * Two comment lines, one of them containing a comma. The env form used to
   * split on commas before it dropped comments, so `codenames and channel ids`
   * became a token of its own and the count came out two higher than the same
   * text read as a file.
   */
  const SAMPLE = [
    '# people, codenames and channel ids live here',
    'alpha-token',
    'beta-token, gamma-token',
    '',
    '   ',
  ].join('\n');

  const EXPECTED = ['alpha-token', 'beta-token', 'gamma-token'];

  /** Loads with the denylist environment set to exactly `env`, then restores it. */
  function loadWith(env: Record<string, string | undefined>): string[] {
    const keys = ['LEAK_DENYLIST', 'LEAK_DENYLIST_FILE'] as const;
    const saved = keys.map((k) => [k, process.env[k]] as const);
    try {
      for (const k of keys) delete process.env[k];
      for (const [k, v] of Object.entries(env)) if (v !== undefined) process.env[k] = v;
      return loadPrivateDenylist(ROOT).sort();
    } finally {
      for (const [k, v] of saved) {
        if (v === undefined) delete process.env[k];
        else process.env[k] = v;
      }
    }
  }

  it('a comment line containing a comma yields no token', () => {
    expect(
      loadWith({ LEAK_DENYLIST: SAMPLE, LEAK_DENYLIST_FILE: join(ROOT, 'no-such-file') }),
    ).toEqual(EXPECTED);
  });

  it('the file form and the env form load the same tokens', () => {
    const dir = mkdtempSync(join(tmpdir(), 'denylist-'));
    const file = join(dir, 'denylist');
    try {
      writeFileSync(file, SAMPLE, 'utf8');
      expect(loadWith({ LEAK_DENYLIST_FILE: file })).toEqual(EXPECTED);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('the committed snapshot', () => {
  /**
   * A run timestamp in generated content makes every refresh a content change,
   * so a week in which APEX did not move still opens a pull request whose whole
   * diff is one clock reading. The site states its freshness from a build-time
   * constant instead.
   */
  it('carries no wall-clock timestamp', async () => {
    const offenders: string[] = [];
    for (const file of await collect(GENERATED)) {
      const text = await readFile(file, 'utf8');
      if (/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(text) || /"generatedAt"/.test(text)) {
        offenders.push(file.slice(ROOT.length + 1));
      }
    }
    expect(offenders).toEqual([]);
  });
});

describe('published output', () => {
  const denylist = loadPrivateDenylist(ROOT);

  it.each([
    ['src/generated', GENERATED],
    ['public', PUBLIC],
  ])('%s contains no forbidden string', async (label, dir) => {
    expect(existsSync(dir), `${label} is missing — run \`npm run content\``).toBe(true);

    const files = await collect(dir);
    expect(files.length, label).toBeGreaterThan(0);

    const findings = [];
    for (const file of files) {
      findings.push(
        ...scanText(await readFile(file, 'utf8'), file.slice(ROOT.length + 1), denylist),
      );
    }

    expect(findings.length, `\n${formatFindings(findings)}`).toBe(0);
  });

  it('the republished schema has its product enum redacted', async () => {
    const schema = JSON.parse(
      await readFile(join(PUBLIC, 'schema', 'frontmatter.schema.json'), 'utf8'),
    );
    const node = schema.definitions?.product_slug;
    expect(node, 'definitions.product_slug is missing entirely').toBeDefined();
    expect(node.enum, 'the product-slug enum was published').toBeUndefined();
    expect(String(node.$comment)).toContain('Redacted');
  });
});
