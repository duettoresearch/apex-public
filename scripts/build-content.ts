/**
 * Why: The site is public and static, but its subject lives in a private
 * repository. This script is the only bridge between the two, so it is also the
 * only place a leak can originate. It reads a fixed allowlist, sanitizes each
 * document, and writes a snapshot into `src/generated/` that is committed — so
 * `npm run dev` and `npm run build` work for anyone, with no credentials.
 * What: Reads the allowlisted APEX sources, renders them to sanitized HTML,
 * derives the schema table, the tool/skill/workflow inventories, and the
 * aggregate statistics, then writes the snapshot and runs the leak gate over it.
 * Test: `npm run content && npm run leak-check`
 *
 * Usage:
 *   tsx scripts/build-content.ts                 # fail if no source configured
 *   tsx scripts/build-content.ts --if-available  # no-op if no source configured
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  ALLOWLIST,
  CLI_MAIN_PATH,
  COMPANION_MCP_SERVER,
  COMPANION_README,
  SCHEMA_PATH,
  SCHEMA_REDACTIONS,
  SKILLS_DIR,
  WORKFLOWS_DIR,
} from '../content.config.ts';
import {
  listTree,
  readFileAt,
  readForDerivationOnly,
  resolveSource,
  type RepoSource,
} from './lib/source.ts';
import { denylistStatus, loadPrivateDenylist } from './lib/forbidden.ts';
import { renderMarkdown, stripFrontmatter, type TocEntry } from './lib/markdown.ts';
import { parseSchema, type ArtifactTypeRecord } from './lib/schema.ts';
import { collectStats, type Stats } from './lib/stats.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'src', 'generated');
const PUBLIC_SCHEMA = join(ROOT, 'public', 'schema', 'frontmatter.schema.json');

/** A rendered document ready for the /docs/:slug route. */
interface GeneratedDoc {
  readonly slug: string;
  readonly title: string;
  readonly blurb: string;
  readonly sourcePath: string;
  readonly html: string;
  readonly toc: readonly TocEntry[];
}

/**
 * Applies a document's declared strip rules in two phases: whole-document rules
 * first, so a block spanning several lines can be replaced as a unit, then line
 * rules over the result.
 */
function sanitize(markdown: string, entry: (typeof ALLOWLIST)[number]): string {
  let text = markdown;
  for (const rule of entry.strip) {
    if (rule.applyDocument) text = rule.applyDocument(text);
  }

  const lineRules = entry.strip
    .map((r) => r.applyLine)
    .filter((fn): fn is NonNullable<typeof fn> => fn !== undefined);

  const kept: string[] = [];
  for (const line of text.split('\n')) {
    let current: string | null = line;
    for (const apply of lineRules) {
      if (current === null) break;
      current = apply(current);
    }
    if (current !== null) kept.push(current);
  }
  return kept.join('\n');
}

/**
 * Empties the JSON pointers `SCHEMA_REDACTIONS` names, leaving a `$comment` in
 * place of each so a reader sees that something was removed and why. The schema
 * stays valid: an absent `enum` widens the constraint rather than breaking it.
 */
function redactSchema(schema: Record<string, unknown>): Record<string, unknown> {
  const copy = JSON.parse(JSON.stringify(schema)) as Record<string, unknown>;

  for (const { pointer, reason } of SCHEMA_REDACTIONS) {
    let node: Record<string, unknown> | undefined = copy;
    for (const segment of pointer.slice(0, -1)) {
      node = node?.[segment] as Record<string, unknown> | undefined;
      if (!node) break;
    }
    const leaf = pointer.at(-1);
    if (node && leaf && leaf in node) {
      delete node[leaf];
      node['$comment'] = `Redacted for public publication: ${reason}.`;
      console.log(`[content] redacted schema ${pointer.join('.')}`);
    }
  }

  return copy;
}

/** Renders every allowlisted APEX document. */
async function buildDocs(apex: RepoSource): Promise<GeneratedDoc[]> {
  const allowed = new Set(ALLOWLIST.map((e) => e.path));
  const docs: GeneratedDoc[] = [];

  for (const entry of ALLOWLIST) {
    const raw = readFileAt(apex, entry.path, allowed);
    const body = sanitize(stripFrontmatter(raw), entry);
    const { html, toc } = await renderMarkdown(body, entry.path);
    docs.push({
      slug: entry.slug,
      title: entry.title,
      blurb: entry.blurb,
      sourcePath: entry.path,
      html,
      toc,
    });
    console.log(`[content] rendered ${entry.path} -> /docs/${entry.slug}`);
  }

  return docs;
}

/** Renders the authored marketing copy in `content/`. */
async function buildAuthored(stats: Stats): Promise<GeneratedDoc[]> {
  const pages = [
    { file: 'home.md', slug: 'home', title: 'APEX', blurb: 'What APEX is.' },
    {
      file: 'how-its-used.md',
      slug: 'how-its-used',
      title: 'How It Works',
      blurb: 'The lifecycle, the two contribution paths, the review tiers.',
    },
    {
      file: 'history.md',
      slug: 'history',
      title: 'History',
      blurb: 'Dated milestones, verified against the commit log.',
    },
    {
      file: 'compare.md',
      slug: 'compare',
      title: 'Compared',
      blurb: 'APEX next to Backstage, ADR tooling, RFC processes, and PM SaaS.',
    },
    {
      file: 'tooling.md',
      slug: 'tooling',
      title: 'Tooling',
      blurb: 'The CLI, the validation passes, CI, the skills, the Companion.',
    },
  ];

  const docs: GeneratedDoc[] = [];
  for (const page of pages) {
    const raw = await readFile(join(ROOT, 'content', page.file), 'utf8');
    const filled = interpolate(raw, stats);
    const { html, toc } = await renderMarkdown(filled, `content/${page.file}`);
    docs.push({
      slug: page.slug,
      title: page.title,
      blurb: page.blurb,
      sourcePath: `content/${page.file}`,
      html,
      toc,
    });
    console.log(`[content] rendered content/${page.file}`);
  }
  return docs;
}

/**
 * Stats keys the pipeline omits rather than guesses when their source is
 * unavailable. A placeholder for one of these renders as an em dash; a
 * placeholder for anything else that is missing is a typo and fails the build.
 */
const OPTIONAL_STATS_KEYS: ReadonlySet<string> = new Set([
  'mergedPullRequests',
  'companionMcpTools',
]);

/**
 * Replaces `{{stats.key}}` placeholders in authored copy. An unknown key is a
 * hard error: a page that silently renders `{{stats.typo}}` is worse than a
 * failed build.
 */
function interpolate(markdown: string, stats: Stats): string {
  return markdown.replace(/\{\{stats\.([a-zA-Z]+)\}\}/g, (_m, key: string) => {
    const value = (stats as unknown as Record<string, unknown>)[key];
    if (value === undefined) {
      if (OPTIONAL_STATS_KEYS.has(key)) return '—';
      throw new Error(`content: unknown stats placeholder {{stats.${key}}}`);
    }
    return typeof value === 'number' ? value.toLocaleString('en-US') : String(value);
  });
}

/** Derives the `apex` CLI command names without publishing any source. */
function cliCommands(apex: RepoSource): string[] {
  const source = readForDerivationOnly(apex, CLI_MAIN_PATH);
  const names = new Set<string>();
  for (const m of source.matchAll(/add_parser\(\s*\n?\s*["']([a-z][a-z-]*)["']/g)) {
    if (m[1]) names.add(m[1]);
  }
  return [...names].sort();
}

/** Reads CI workflow file names and their `name:` field. Nothing else. */
function workflows(apex: RepoSource): { file: string; name: string }[] {
  return listTree(apex)
    .filter((p) => p.startsWith(`${WORKFLOWS_DIR}/`) && /\.ya?ml$/.test(p))
    .map((path) => {
      const text = readForDerivationOnly(apex, path);
      const m = text.match(/^name:\s*(.+)$/m);
      return {
        file: path.slice(WORKFLOWS_DIR.length + 1),
        name: (m?.[1] ?? '').trim().replace(/^["']|["']$/g, ''),
      };
    })
    .sort((a, b) => a.file.localeCompare(b.file));
}

/** Skill directory names only. A skill body is never opened. */
function skillNames(apex: RepoSource): string[] {
  return listTree(apex)
    .filter((p) => p.startsWith(`${SKILLS_DIR}/`) && p.endsWith('/SKILL.md'))
    .map((p) => p.slice(SKILLS_DIR.length + 1, -'/SKILL.md'.length))
    .sort();
}

/**
 * The 12 categories the skills catalog groups by, with the skills in each. The
 * grouping lives in the spec's prose rather than in any machine-readable file,
 * so it is transcribed here and checked against the derived directory list.
 */
const SKILL_CATEGORIES: readonly { category: string; skills: readonly string[] }[] = [
  { category: 'Setup', skills: ['apex-help', 'apex-setup', 'apex-git-setup'] },
  { category: 'Proposals', skills: ['apex-proposal', 'apex-vote', 'apex-wiki'] },
  { category: 'Discovery', skills: ['apex-initiative', 'apex-experiment'] },
  { category: 'Specification', skills: ['apex-prd', 'apex-prd-review'] },
  { category: 'Planning', skills: ['apex-tests', 'apex-implementation', 'apex-epic'] },
  { category: 'Delivery', skills: ['apex-ship'] },
  { category: 'Learning', skills: ['apex-measure', 'apex-learn'] },
  {
    category: 'Documentation & Comms',
    skills: ['apex-generate-docs', 'apex-newsletter', 'apex-newsletter-edition'],
  },
  {
    category: 'Records',
    skills: ['apex-decision', 'apex-policy', 'apex-guide', 'apex-charter'],
  },
  { category: 'Reference', skills: ['apex-artifacts'] },
  {
    category: 'Status & Workflow',
    skills: [
      'apex-status',
      'apex-dashboard',
      'apex-report',
      'apex-transition',
      'apex-update-initiative',
      'apex-validate',
      'apex-commit',
      'apex-session-sync',
      'apex-meeting-prep',
      'duetto-apex-maintenance',
    ],
  },
  {
    category: 'PR',
    skills: [
      'apex-pr-create',
      'apex-pr-report',
      'apex-pr-review',
      'apex-pr-approve',
      'apex-pr-comment',
      'apex-pr-request-changes',
    ],
  },
  { category: 'Deprecated', skills: ['apex-meeting'] },
];

/** Counts MCP tools by their registration calls. No tool body is read. */
function companionMcpToolCount(companion: RepoSource): number | undefined {
  try {
    const src = readForDerivationOnly(companion, COMPANION_MCP_SERVER);
    return [...src.matchAll(/^\s+_reg\([a-z_]+\)$/gm)].length || undefined;
  } catch {
    return undefined;
  }
}

/** The Companion's own one-line description, taken from its README's lead. */
function companionDescription(companion: RepoSource): string | undefined {
  try {
    const readme = readForDerivationOnly(companion, COMPANION_README);
    const afterHeading = readme.split('\n').slice(1).join('\n').trim();
    const para = afterHeading.split('\n\n')[0] ?? '';
    return para.replace(/\s+/g, ' ').trim() || undefined;
  } catch {
    return undefined;
  }
}

async function writeJson(name: string, value: unknown): Promise<void> {
  await writeFile(join(OUT, name), `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  console.log(`[content] wrote src/generated/${name}`);
}

/**
 * Why: The generated snapshot is committed and then republished by builds that
 * cannot see the private tokens. If it is produced without them, the generic
 * patterns are the only thing that ever inspects it, and a person's name or an
 * internal codename reaches the public site unchallenged.
 * What: Refuses to generate unless the private denylist loaded. `npm test` and
 * `npm run build` are unaffected — they validate, they do not generate.
 */
function requirePrivateDenylist(): void {
  const denylist = loadPrivateDenylist(ROOT);
  console.log(denylistStatus(denylist));

  if (denylist.length > 0) return;
  if (process.env['LEAK_DENYLIST_OPTIONAL'] === '1') {
    console.warn('[content] LEAK_DENYLIST_OPTIONAL=1 — generating with generic patterns only');
    return;
  }

  throw new Error(
    'refusing to generate content without the private denylist. Set LEAK_DENYLIST, ' +
      'or create .leak-denylist.local (see .env.example). ' +
      'Override with LEAK_DENYLIST_OPTIONAL=1 only if you understand what stops being checked.',
  );
}

async function main(): Promise<void> {
  const ifAvailable = process.argv.includes('--if-available');

  const apex = resolveSource({ name: 'APEX', pathEnv: 'APEX_REPO_PATH', slug: 'APEX' });
  if (!apex) {
    const message =
      'no APEX source configured — set APEX_REPO_PATH or GITHUB_TOKEN (see .env.example)';
    if (ifAvailable) {
      console.log(`[content] ${message}; using the committed snapshot`);
      return;
    }
    throw new Error(message);
  }

  requirePrivateDenylist();
  console.log(`[content] APEX source: ${apex.mode} @ ${apex.ref}`);

  const companion = resolveSource({
    name: 'apex-companion',
    pathEnv: 'APEX_COMPANION_REPO_PATH',
    slug: 'apex-companion',
  });

  await mkdir(OUT, { recursive: true });
  await mkdir(dirname(PUBLIC_SCHEMA), { recursive: true });

  // --- schema -------------------------------------------------------------
  const schemaRaw = readFileAt(apex, SCHEMA_PATH, new Set([SCHEMA_PATH]));
  const published = redactSchema(JSON.parse(schemaRaw) as Record<string, unknown>);
  const schemaTypes: ArtifactTypeRecord[] = parseSchema(published);
  await writeFile(PUBLIC_SCHEMA, `${JSON.stringify(published, null, 2)}\n`, 'utf8');
  console.log(`[content] wrote public/schema/ (${schemaTypes.length} types)`);

  // --- stats --------------------------------------------------------------
  const mcpTools = companion ? companionMcpToolCount(companion) : undefined;
  const stats: Stats = { ...collectStats(apex, mcpTools), artifactTypes: schemaTypes.length };

  // --- documents ----------------------------------------------------------
  const specDocs = await buildDocs(apex);
  const authored = await buildAuthored(stats);

  // --- inventories --------------------------------------------------------
  const skills = skillNames(apex);
  const declared = new Set(SKILL_CATEGORIES.flatMap((c) => c.skills));
  const uncategorized = skills.filter((s) => !declared.has(s));
  if (uncategorized.length > 0) {
    console.warn(`[content] skills missing a category: ${uncategorized.join(', ')}`);
  }

  const tooling = {
    cliCommands: cliCommands(apex),
    workflows: workflows(apex),
    skills,
    skillCategories: SKILL_CATEGORIES,
    companionDescription: companion ? companionDescription(companion) : undefined,
    companionMcpTools: mcpTools,
  };

  // --- write --------------------------------------------------------------
  await writeJson('stats.json', stats);
  await writeJson('schema-types.json', schemaTypes);
  await writeJson('docs.json', specDocs);
  await writeJson('pages.json', authored);
  await writeJson('tooling.json', tooling);

  console.log(
    `[content] done — ${specDocs.length} docs, ${authored.length} pages, ` +
      `${schemaTypes.length} artifact types, ${skills.length} skills`,
  );
}

main().catch((err: unknown) => {
  console.error(`[content] FAILED: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
