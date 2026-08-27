/**
 * Why: The build must read two private repositories without ever checking them
 * out into this working tree, and without a maintainer having to remember which
 * branch a local checkout happens to be on. Reading through an explicit git ref
 * gives the same answer whatever the checkout's HEAD is doing.
 * What: Resolves a repository source from the environment (a local checkout read
 * at a ref, or a clone made with a token) and exposes read/list/log operations
 * over it. Every read routes through `readFile`, which refuses paths outside the
 * allowlist.
 * Test: `refuses a path outside the allowlist`, `lists the tree at a ref`
 */

import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { NEVER_READ_TREES } from '../../content.config.ts';

/** Where the pipeline got its content, recorded in the generated snapshot. */
export type SourceMode = 'local' | 'clone';

export interface RepoSource {
  readonly name: string;
  readonly dir: string;
  readonly ref: string;
  readonly mode: SourceMode;
}

/** Runs git in a repository and returns stdout. Throws on a non-zero exit. */
function git(dir: string, args: readonly string[], maxBuffer = 64 * 1024 * 1024): string {
  return execFileSync('git', ['-C', dir, ...args], {
    encoding: 'utf8',
    maxBuffer,
  });
}

/**
 * Why: A path that is not in the allowlist must be unreachable, not merely
 * unused. Enforcing that at the single read chokepoint means a future caller
 * cannot widen the surface by accident.
 */
function assertReadable(repo: RepoSource, path: string, allowlist: ReadonlySet<string>): void {
  for (const tree of NEVER_READ_TREES) {
    if (path === tree || path.startsWith(tree)) {
      throw new Error(
        `refusing to read ${repo.name}:${path} — it is under an excluded tree (${tree})`,
      );
    }
  }
  if (!allowlist.has(path)) {
    throw new Error(
      `refusing to read ${repo.name}:${path} — not in the allowlist declared by content.config.ts`,
    );
  }
}

/** Reads one allowlisted file's contents at the source's ref. */
export function readFileAt(
  repo: RepoSource,
  path: string,
  allowlist: ReadonlySet<string>,
): string {
  assertReadable(repo, path, allowlist);
  return git(repo.dir, ['show', `${repo.ref}:${path}`]);
}

/**
 * Lists every tracked path at the ref. Path names alone carry no body text, so
 * this is not gated by the allowlist — the aggregate stats are built from it.
 */
export function listTree(repo: RepoSource): string[] {
  return git(repo.dir, ['ls-tree', '-r', '--name-only', repo.ref])
    .split('\n')
    .filter((l) => l.length > 0);
}

/** Runs `git log` with the given format and arguments, returning raw lines. */
export function log(repo: RepoSource, args: readonly string[]): string[] {
  return git(repo.dir, ['log', repo.ref, ...args])
    .split('\n')
    .filter((l) => l.length > 0);
}

/** Total commit count reachable from the ref. */
export function commitCount(repo: RepoSource): number {
  return Number(git(repo.dir, ['rev-list', '--count', repo.ref]).trim());
}

/** Distinct commit-author count. Aggregate only — no names are read out. */
export function contributorCount(repo: RepoSource): number {
  return git(repo.dir, ['shortlog', '-sn', repo.ref])
    .split('\n')
    .filter((l) => l.trim()).length;
}

/**
 * Reads a raw blob without the allowlist gate. Reserved for the two derived
 * facts the pipeline extracts by regex (CLI command names, MCP tool count) and
 * for workflow `name:` fields — in each case the caller discards the body and
 * keeps only names.
 *
 * Callers must not publish what this returns.
 */
export function readForDerivationOnly(repo: RepoSource, path: string): string {
  for (const tree of NEVER_READ_TREES) {
    if (path.startsWith(tree)) {
      throw new Error(`refusing to read ${repo.name}:${path} — excluded tree (${tree})`);
    }
  }
  return git(repo.dir, ['show', `${repo.ref}:${path}`]);
}

/**
 * Resolves a repository source from the environment.
 *
 * `<PREFIX>_REPO_PATH` uses a local checkout, read at `APEX_REF` (default
 * `origin/main`) so a stale or feature-branch HEAD cannot change the output.
 * Otherwise `GITHUB_TOKEN` clones the repository into a temporary directory
 * with full history, which the commit and contributor counts require.
 *
 * Returns null when neither is configured.
 */
export function resolveSource(opts: {
  readonly name: string;
  readonly pathEnv: string;
  readonly slug: string;
}): RepoSource | null {
  const ref = process.env['APEX_REF'] ?? 'origin/main';
  const local = process.env[opts.pathEnv];

  if (local && existsSync(join(local, '.git'))) {
    // A local checkout may not have the ref fetched; fall back to its HEAD
    // rather than failing, and say which was used.
    let resolved = ref;
    try {
      git(local, ['rev-parse', '--verify', `${ref}^{commit}`]);
    } catch {
      resolved = 'HEAD';
      console.warn(`[content] ${opts.name}: ref ${ref} not found, reading HEAD instead`);
    }
    return { name: opts.name, dir: local, ref: resolved, mode: 'local' };
  }

  const token = process.env['GITHUB_TOKEN'];
  if (token) {
    const dir = mkdtempSync(join(tmpdir(), `apex-public-${opts.slug}-`));
    const url = `https://x-access-token:${token}@github.com/duettoresearch/${opts.slug}`;
    console.log(`[content] ${opts.name}: cloning (full history, main only)`);
    execFileSync('git', ['clone', '--branch', 'main', '--single-branch', url, dir], {
      stdio: 'inherit',
    });
    return { name: opts.name, dir, ref: 'HEAD', mode: 'clone' };
  }

  return null;
}
