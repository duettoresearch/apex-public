/**
 * Why: This repository is public, so a denylist written into it publishes
 * exactly what it exists to suppress — a list of people, internal codenames, and
 * chat identifiers is a leak whether it appears in output or in the scanner.
 * The list is therefore split: patterns that name no specific secret live here,
 * and the specific tokens load at runtime from outside the repository.
 * What: Declares the generic patterns, loads the private token list, and scans
 * finished output, returning one finding per hit with file, line, and match.
 * Test: `every generic pattern matches its own sample`,
 *       `flags a private denylist token`, `allows a vetted ticket token`,
 *       `src/generated contains no forbidden string`
 */

import { readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { relative, resolve } from 'node:path';

/**
 * The company's public domain. It is a marketing hostname, not a secret, so it
 * stays in the repository — but internal subdomains under it are hosts only
 * reachable inside the corporate network, and must never reach published output.
 *
 * This is the ONE literal occurrence in the tree. Both the detection pattern and
 * its self-test sample derive from it, and `content.config.ts` imports the strip
 * patterns rather than restating the domain.
 */
export const COMPANY_DOMAIN = 'duettosystems.com';

const DOMAIN_RE_SOURCE = COMPANY_DOMAIN.replace(/\./g, '\\.');

/** Fresh strip patterns for the company domain, for `content.config.ts`. */
export function companyHostPatterns(): {
  readonly link: RegExp;
  readonly url: RegExp;
  readonly bare: RegExp;
} {
  return {
    link: new RegExp(`\\[([^\\]]+)\\]\\(https?://[^)]*${DOMAIN_RE_SOURCE}[^)]*\\)`, 'gi'),
    url: new RegExp(`https?://[a-z0-9.-]*${DOMAIN_RE_SOURCE}[^\\s)>\\]]*`, 'gi'),
    bare: new RegExp(`\\b[a-z0-9.-]*${DOMAIN_RE_SOURCE}\\b`, 'gi'),
  };
}

/**
 * One detection rule that names no specific secret.
 *
 * `build` returns a fresh RegExp per call because a `g` pattern carries
 * `lastIndex` between uses, and `sample` is a string the pattern must match — a
 * pattern that silently stops matching is the failure mode this whole module
 * exists to prevent, so each one proves itself in the test suite.
 */
export interface GenericPattern {
  readonly rule: string;
  readonly description: string;
  readonly build: () => RegExp;
  readonly sample: string;
}

/**
 * Ticket-shaped tokens that are APEX's own published vocabulary rather than
 * live tickets: artifact-ID grammar, spec-internal record numbering, and the
 * worked ID examples in the schema and artifact reference.
 *
 * Deliberately exact tokens rather than prefixes. A new prefix appearing
 * upstream should fail the build and be vetted by a human, which a prefix rule
 * would quietly stop doing.
 */
export const ALLOWED_TICKET_TOKENS: ReadonlySet<string> = new Set([
  // The year segment of an APEX artifact ID (I-2026-XX-NNN and friends).
  'PROP-2026',
  'PRD-2026',
  'IMPL-2026',
  'DEC-2026',
  'DOC-2026',
  'PC-2026',
  'GC-2026',
  'TC-2026',

  // Spec-internal record numbering: reconciliation items, deprecation-runway
  // ids, and spec catalog numbers. None is a ticket in any tracker.
  'DISC-10',
  'DISC-13',
  'DISC-14',
  'DISC-17',
  'DISC-18',
  'DISC-19',
  'DISC-23',
  'DISC-24',
  'DISC-25',
  'DEP-001',
  'DEP-002',
  'DEP-003',
  'DOC-10',
  'DOC-38',

  // Spec ids from the external, public trusty-tools DOC-38 standard.
  'SLD-01',
  'SLD-02',
  'SLD-03',

  // Worked artifact-ID examples: a short product code plus a counter, published
  // in APEX's own README as the canonical illustration of the ID grammar.
  'HOT-420',
  'FOR-003',
  'FOR-007',
  'APX-001',
  'APX-002',
  'APX-005',
  'APX-008',
  'HS-001',
  'GC-001',
  'GC-005',
  'PC-019',
  'PC-020',
  'PC-022',
  'TC-001',
  'TC-006',
  'DOC-001',
  'DEC-001',
  'DEC-004',
  'DEC-009',
  'DEC-018',
]);

/**
 * Concrete `products/` paths that are vetted. `products/apex/…` names the
 * framework itself, which is this site's whole subject.
 */
export const ALLOWED_PRODUCT_PATHS: ReadonlySet<string> = new Set([
  'products/apex/initiatives',
]);

/**
 * Patterns safe to commit: each describes a SHAPE, so none discloses the thing
 * it detects. Every sample below is synthetic.
 */
export const GENERIC_PATTERNS: readonly GenericPattern[] = [
  {
    rule: 'company-host',
    description: 'a hostname under the company domain, including internal subdomains',
    build: () => companyHostPatterns().bare,
    sample: `apex.dev.${COMPANY_DOMAIN}`,
  },
  {
    rule: 'issue-tracker-host',
    description: 'a link into the hosted issue tracker',
    build: () => /\batlassian\.net\b/gi,
    sample: 'example.atlassian.net/browse/X',
  },
  {
    rule: 'chat-host',
    description: 'a link into the team chat workspace',
    build: () => /\bslack\.com\b/gi,
    sample: 'https://example.slack.com/archives/X',
  },
  {
    rule: 'artifact-host',
    description: 'a link into the binary artifact repository',
    build: () => /\bjfrog\.io\b/gi,
    sample: 'https://example.jfrog.io/artifactory/x',
  },
  {
    rule: 'chat-channel-id',
    description: 'a chat channel identifier',
    build: () => /\bC0[A-Z0-9]{8,10}\b/g,
    sample: 'C0ABCDEFGHI',
  },
  {
    rule: 'org-handle',
    description: 'a personal code-host handle carrying the org suffix',
    build: () => /@[a-z0-9-]+-duetto\b/g,
    sample: '@example-duetto',
  },
];

/** One forbidden-string hit. */
export interface Finding {
  readonly file: string;
  readonly line: number;
  readonly match: string;
  readonly rule: string;
}

/** Anything shaped like a ticket key. Vetted exceptions are allowlisted above. */
export const TICKET_KEY_RE = /\b[A-Z]{2,5}-\d{2,5}\b/g;

/**
 * A concrete `products/` path with two or more real segments. The path TEMPLATES
 * the spec publishes (`products/{domain}/{product}/…`) are fine; a real
 * initiative path is not, because its slug names customer-facing work.
 */
const CONCRETE_PRODUCT_PATH_RE = /\bproducts\/(?!\{)[a-z0-9._-]+\/(?!\{)[a-z0-9._-]+/g;

/* ------------------------------------------------------------------ */
/* The private tier                                                   */
/* ------------------------------------------------------------------ */

/** Default location of the gitignored private token file, repo-root-relative. */
export const DEFAULT_DENYLIST_FILE = '.leak-denylist.local';

/**
 * Why: The env form and the file form were parsed differently. The env form
 * split on commas before it dropped comments, so the text after a comma inside
 * a `# comment` line survived as a token: a secret pasted from a file with two
 * such comments reported 10 tokens where the same file reported 8. The count
 * printed below is the only signal anyone has that the private tier is
 * complete, so the two forms have to agree.
 * What: Splits on newlines first, drops blank and `#` comment lines, then
 * splits what is left on commas and trims each part. Same for both sources.
 * Test: `a comment line containing a comma yields no token`
 */
function parseDenylist(text: string, into: Set<string>): void {
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    for (const part of trimmed.split(',')) {
      const token = part.trim();
      if (token) into.add(token);
    }
  }
}

/**
 * Loads the specific tokens the repository must not contain: people, internal
 * codenames, exact chat identifiers, personal handles.
 *
 * Sources are merged, both optional, both parsed by `parseDenylist`:
 *   - `LEAK_DENYLIST` — newline- or comma-separated, for CI secrets
 *   - `LEAK_DENYLIST_FILE` (default `.leak-denylist.local`) — a gitignored file
 *
 * Either form may carry `#` comment lines and blank lines; neither contributes
 * a token. Pasting the file into the secret verbatim therefore loads the same
 * tokens the file does, and both print the same count.
 *
 * Returns an empty list when neither is present. That is a legitimate state for
 * `npm test` and `npm run build`, which validate a snapshot generated elsewhere,
 * and a hard failure for `npm run content`, which generates one.
 */
export function loadPrivateDenylist(root: string): string[] {
  const tokens = new Set<string>();

  const fromEnv = process.env['LEAK_DENYLIST'];
  if (fromEnv) parseDenylist(fromEnv, tokens);

  const file = process.env['LEAK_DENYLIST_FILE'] ?? DEFAULT_DENYLIST_FILE;
  try {
    parseDenylist(readFileSync(resolve(root, file), 'utf8'), tokens);
  } catch {
    // Absent is normal; the caller decides whether that is acceptable.
  }

  return [...tokens];
}

/** The one-line status the scanner prints so a run's coverage is never implicit. */
export function denylistStatus(tokens: readonly string[]): string {
  return tokens.length > 0
    ? `[leak-check] private denylist: ${tokens.length} tokens loaded`
    : '[leak-check] WARNING: no private denylist loaded — generic patterns only';
}

/* ------------------------------------------------------------------ */
/* Scanning                                                           */
/* ------------------------------------------------------------------ */

/** Scans one file's text and returns every finding in it. */
export function scanText(
  text: string,
  file: string,
  denylist: readonly string[] = [],
): Finding[] {
  const findings: Finding[] = [];
  const lines = text.split('\n');

  lines.forEach((line, i) => {
    const lineNo = i + 1;
    const lower = line.toLowerCase();

    for (const token of denylist) {
      if (lower.includes(token.toLowerCase())) {
        findings.push({ file, line: lineNo, match: token, rule: 'private-denylist' });
      }
    }

    for (const pattern of GENERIC_PATTERNS) {
      for (const m of line.matchAll(pattern.build())) {
        findings.push({ file, line: lineNo, match: m[0], rule: pattern.rule });
      }
    }

    for (const m of line.matchAll(TICKET_KEY_RE)) {
      if (!ALLOWED_TICKET_TOKENS.has(m[0])) {
        findings.push({ file, line: lineNo, match: m[0], rule: 'ticket-key' });
      }
    }

    for (const m of line.matchAll(CONCRETE_PRODUCT_PATH_RE)) {
      if (ALLOWED_PRODUCT_PATHS.has(m[0])) continue;
      findings.push({ file, line: lineNo, match: m[0], rule: 'product-path' });
    }
  });

  return findings;
}

/** Scans a list of files. */
export async function scanFiles(
  files: readonly string[],
  root: string,
  denylist: readonly string[] = [],
): Promise<Finding[]> {
  const findings: Finding[] = [];
  for (const file of files) {
    const text = await readFile(file, 'utf8');
    findings.push(...scanText(text, relative(root, file), denylist));
  }
  return findings;
}

/** Extensions worth scanning. Fonts and images cannot carry a readable leak. */
export const SCANNABLE_EXTENSIONS: readonly string[] = [
  '.json',
  '.html',
  '.js',
  '.css',
  '.txt',
  '.md',
  '.map',
];

/**
 * Formats findings for a terminal. A `private-denylist` match is redacted: the
 * point is to keep the token out of published text, and a build log is text.
 */
export function formatFindings(findings: readonly Finding[]): string {
  return findings
    .map((f) => {
      const shown = f.rule === 'private-denylist' ? '<redacted private token>' : f.match;
      return `  ${f.file}:${f.line}  [${f.rule}]  ${shown}`;
    })
    .join('\n');
}
