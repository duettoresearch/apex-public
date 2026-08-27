/**
 * Why: Every number this site states about APEX has to come from the repository
 * rather than from a maintainer's memory, or the site becomes another layer that
 * drifts. These counts are also the only thing derived from trees the pipeline
 * is otherwise forbidden to read, so each one is computed in a way that yields a
 * number and never a name.
 * What: Computes the aggregate statistics rendered on /stats and interpolated
 * into the authored copy.
 * Test: `counts artifacts by type`, `emits no path or person name`
 *
 * Nothing here reads the wall clock except `daysActive`, which is a fact a
 * reader sees. A run timestamp used to sit in this object; it made every
 * refresh a content change even when APEX had not moved, so the whole diff of
 * a scheduled pull request was one clock reading. The site states its freshness
 * from a build-time constant instead — see `BUILD_DATE` in `src/lib/content.ts`.
 */

import { execFileSync } from 'node:child_process';
import { commitCount, contributorCount, listTree, log, type RepoSource } from './source.ts';

export interface Stats {
  readonly sourceRef: string;

  readonly trackedMarkdown: number;
  readonly artifactsByType: Readonly<Record<string, number>>;
  readonly artifactsTotal: number;

  readonly initiatives: number;
  readonly initiativesByStatus: Readonly<Record<string, number>>;

  readonly domains: number;
  readonly products: number;

  readonly decisions: number;
  readonly proposals: number;
  readonly skills: number;
  readonly templates: number;
  readonly workflows: number;
  readonly artifactTypes: number;

  readonly commits: number;
  readonly contributors: number;
  readonly firstCommitDate: string;
  readonly daysActive: number;

  /** Omitted entirely when `gh` is unauthenticated. Never estimated. */
  readonly mergedPullRequests?: number;

  /** Omitted when apex-companion is not configured as a source. */
  readonly companionMcpTools?: number;
}

/**
 * Why: The counts below need to see inside files under `products/`, which the
 * pipeline may not publish from. `git grep -h` returns matching LINES without
 * their paths, so an initiative slug or directory name cannot come back — only
 * strings like `type: initiative`.
 */
function grepLines(repo: RepoSource, pattern: string, pathspec: readonly string[]): string[] {
  try {
    return execFileSync(
      'git',
      ['-C', repo.dir, 'grep', '-h', '-E', pattern, repo.ref, '--', ...pathspec],
      { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 },
    )
      .split('\n')
      .filter((l) => l.length > 0);
  } catch {
    // git grep exits 1 when nothing matched.
    return [];
  }
}

/** Tallies values into a plain object, sorted by descending count. */
function tally(values: readonly string[]): Record<string, number> {
  const counts = new Map<string, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  return Object.fromEntries([...counts.entries()].sort((a, b) => b[1] - a[1]));
}

/** Whole days between an ISO date and now. */
function daysSince(iso: string): number {
  const then = Date.parse(iso);
  return Math.floor((Date.now() - then) / 86_400_000);
}

/**
 * Asks GitHub for the merged-PR count. Returns undefined when `gh` is missing or
 * unauthenticated — the field is then omitted rather than guessed.
 */
function mergedPullRequests(): number | undefined {
  try {
    const out = execFileSync(
      'gh',
      [
        'api',
        'search/issues?q=repo:duettoresearch/APEX+is:pr+is:merged',
        '--jq',
        '.total_count',
      ],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] },
    );
    const n = Number(out.trim().split('\n').pop());
    return Number.isFinite(n) && n > 0 ? n : undefined;
  } catch {
    return undefined;
  }
}

/** Computes every aggregate the site publishes. */
export function collectStats(apex: RepoSource, companionMcpTools?: number): Stats {
  const tree = listTree(apex);

  const trackedMarkdown = tree.filter((p) => p.endsWith('.md')).length;

  // `type:` may carry a trailing comment or quotes; keep the bare token.
  const typeValues = grepLines(apex, '^type: ', ['*.md'])
    .map((l) =>
      l
        .slice('type:'.length)
        .trim()
        .replace(/^["']|["'].*$/g, ''),
    )
    .map((v) => v.split(/\s+#/)[0]?.trim() ?? '')
    .filter((v) => /^[a-z][a-z-]*$/.test(v));
  const artifactsByType = tally(typeValues);

  const initiativeFiles = tree.filter((p) => p.endsWith('/Initiative.md'));
  const initiativeStatuses = grepLines(apex, '^status: ', ['*/Initiative.md'])
    .map((l) =>
      l
        .slice('status:'.length)
        .trim()
        .replace(/^["']|["'].*$/g, ''),
    )
    .filter((v) => /^[a-z][a-z-]*$/.test(v));

  // Directory counts only. The names are held in memory and never emitted.
  const domains = new Set<string>();
  const products = new Set<string>();
  for (const p of tree) {
    if (!p.startsWith('products/')) continue;
    const parts = p.split('/');
    if (parts[1]) domains.add(parts[1]);
    if (parts[1] && parts[2] && parts[2].includes('.') === false) {
      products.add(`${parts[1]}/${parts[2]}`);
    }
  }

  const firstCommitDate = (
    log(apex, ['--reverse', '--format=%ad', '--date=short']).at(0) ?? ''
  ).trim();

  const merged = mergedPullRequests();

  const stats: Stats = {
    sourceRef: apex.ref,

    trackedMarkdown,
    artifactsByType,
    artifactsTotal: typeValues.length,

    initiatives: initiativeFiles.length,
    initiativesByStatus: tally(initiativeStatuses),

    domains: domains.size,
    products: products.size,

    decisions: tree.filter((p) => /^docs\/decisions\/DEC-.*\.md$/.test(p)).length,
    proposals: tree.filter((p) => /^proposals\/[^/]+\.md$/.test(p)).length,
    skills: tree.filter((p) => /^\.cursor\/skills\/[^/]+\/SKILL\.md$/.test(p)).length,
    templates: tree.filter((p) => /^templates\/[^/]+\.md$/.test(p)).length,
    workflows: tree.filter((p) => /^\.github\/workflows\/[^/]+\.ya?ml$/.test(p)).length,
    artifactTypes: 0, // filled in by the caller from the schema

    commits: commitCount(apex),
    contributors: contributorCount(apex),
    firstCommitDate,
    daysActive: firstCommitDate ? daysSince(firstCommitDate) : 0,
    ...(merged !== undefined ? { mergedPullRequests: merged } : {}),
    ...(companionMcpTools !== undefined ? { companionMcpTools } : {}),
  };

  return stats;
}
