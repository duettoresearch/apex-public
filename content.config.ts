/**
 * Why: This site publishes from a PRIVATE repository. The allowlist below is the
 * only reason that is safe — the pipeline reads a file's body if and only if the
 * file appears here. Everything else in the APEX repo is unreachable to the
 * build, including whole trees (products/, proposals/, policies/, guides/,
 * wiki/, docs/decisions/, teams/, guilds/, meetings/, archive/) that carry
 * customer names, people, and ticket keys.
 * What: Declares each allowlisted source path, the site route that renders it,
 * and the sanitizing transforms applied to its body before publication.
 * Test: `every allowlisted doc has a generated fragment`,
 *       `src/generated contains no forbidden string`
 */

import { companyHostPatterns } from './scripts/lib/forbidden.ts';

/**
 * A sanitizing transform. A rule may rewrite the whole document (for a block
 * that spans lines) or one line at a time; a rule declares whichever form fits.
 */
export interface StripRule {
  /** Human-readable reason, surfaced in the build log. */
  readonly reason: string;
  /** Rewrites the whole document. Runs before any line rule. */
  readonly applyDocument?: (markdown: string) => string;
  /** Rewrites one line. Returning `null` drops the line entirely. */
  readonly applyLine?: (line: string) => string | null;
}

/** One allowlisted document: where it comes from, where it goes, how it is cleaned. */
export interface AllowlistEntry {
  /** Repo-root-relative path in the APEX repository. */
  readonly path: string;
  /** Slug under /docs/:slug. */
  readonly slug: string;
  /** Title shown in navigation and on the page. */
  readonly title: string;
  /** One-line description for the docs index. */
  readonly blurb: string;
  readonly strip: readonly StripRule[];
}

/* ------------------------------------------------------------------ */
/* Generic rules — applied to most documents                          */
/* ------------------------------------------------------------------ */

/**
 * Internal hostnames name a host only reachable inside the corporate network.
 * They are replaced by the product's public name so the surrounding sentence
 * still reads, rather than left as a dangling reference.
 *
 * The patterns come from `scripts/lib/forbidden.ts` so the company domain has
 * exactly one literal definition in the tree — this repository is public, and a
 * second copy is a second thing to forget to update.
 */
const stripHostnames: StripRule = {
  reason: 'internal hostnames -> "the APEX Companion app"',
  applyLine(line) {
    const host = companyHostPatterns();
    let out = line.replace(host.link, '$1');
    out = out.replace(host.url, 'the APEX Companion app');
    out = out.replace(host.bare, 'the APEX Companion app');
    // A parenthetical that held nothing but a hostname reads as noise once the
    // hostname is gone.
    out = out.replace(/\(\s*the APEX Companion app\s*\)/g, '');
    out = out.replace(/\(\s*\)/g, '');
    return out.replace(/\s+$/, '');
  },
};

const SLACK_CHANNEL_RE = /\bC0[A-Z0-9]{8,}\b/g;

/** Slack channel ids are internal routing detail with no public meaning. */
const stripSlack: StripRule = {
  reason: 'Slack channel ids -> "a Slack channel"',
  applyLine(line) {
    return line
      .replace(/\bSlack\s+`?C0[A-Z0-9]{8,}`?/g, 'a Slack channel')
      .replace(SLACK_CHANNEL_RE, 'a Slack channel');
  },
};

/**
 * The bold-field header block under each spec H1 names a GitHub owner. The rest
 * of that line (Status / Subsystem / Last-updated / Spec ID) carries nothing
 * private, so only the owner field is removed.
 */
const stripOwnerTag: StripRule = {
  reason: 'drop the **Owner:** field from the spec header block',
  applyLine(line) {
    if (!line.includes('**Owner:**')) return line;
    return line
      .replace(/\s*·?\s*\*\*Owner:\*\*\s*@[A-Za-z0-9-]+/g, '')
      .replace(/^\s*·\s*/, '')
      .replace(/\s+$/, '');
  },
};

/** Any residual GitHub @handle outside a code span. */
const stripHandles: StripRule = {
  reason: 'drop GitHub @handles',
  applyLine(line) {
    return line.replace(/(^|[\s(`])@[A-Za-z0-9][A-Za-z0-9-]{0,38}/g, '$1a maintainer');
  },
};

/**
 * Links into a private repository's web UI return 404 for every public reader,
 * so they are demoted to their own link text.
 */
const stripPrivateRepoLinks: StripRule = {
  reason: 'unlink private-repository URLs',
  applyLine(line) {
    return line
      .replace(/\[([^\]]+)\]\(https?:\/\/github\.com\/duettoresearch\/[^)]*\)/gi, '$1')
      .replace(/https?:\/\/github\.com\/duettoresearch\/[^\s)>\]]*/gi, 'the APEX repository');
  },
};

/* ------------------------------------------------------------------ */
/* Targeted rules — one leak each, found by the leak gate             */
/* ------------------------------------------------------------------ */

/**
 * The README's "POD as metadata" example uses a live project codename as its
 * sample title. The example teaches that `pod` is a frontmatter field, which a
 * neutral title teaches equally well.
 */
const stripReadmeExampleCodename: StripRule = {
  reason: 'README frontmatter example: replace the project codename',
  applyLine(line) {
    return line.replace(/^title:\s*Project\s+\w+\s*$/, 'title: Example Initiative');
  },
};

/**
 * The product-slug enum is the company's internal product portfolio: 38
 * codenames with no public meaning and real competitive value. The rule this
 * section documents — that `product` is a closed enum the second path segment
 * must match — survives without the membership list.
 */
const stripProductSlugEnum: StripRule = {
  reason: 'replace the product-slug enum listing with a count',
  applyDocument(md) {
    return md.replace(
      /## Product-Slug Enum \(\d+\)[\s\S]*?\(\d+ total\. Source: [^)]*\)/,
      [
        '## Product-Slug Enum',
        '',
        'The `product` field and the second path segment MUST be one of a closed',
        'enum of product slugs defined in `schemas/frontmatter.schema.json`',
        '(`definitions.product_slug.enum`). A `product` value outside that enum',
        'fails validation, and so does a path whose second segment does not match',
        'the artifact’s declared `product`.',
        '',
        '*(The membership of this enum is internal product naming and is not',
        'published on this site.)*',
      ].join('\n'),
    );
  },
};

/**
 * The merge-eligibility section names the individual accounts allowed to approve
 * any pull request. The governance rule is what matters publicly; the roster is
 * a list of employees.
 */
const stripApproverRoster: StripRule = {
  reason: 'replace the named approver roster with the rule it encodes',
  applyDocument(md) {
    return md.replace(
      /\*\*Always-allowed approvers\*\*[\s\S]*?\n\n(?=\*\*Pod members\*\*)/,
      '**Always-allowed approvers**: two named leadership groups may merge any pull\n' +
        'request regardless of initiative status. Their membership is configured in\n' +
        '`pod-merge-config.yml` and is not published on this site.\n\n',
    );
  },
};

/**
 * A worked example that names a real product namespace. The point of the
 * sentence is that a product-scoped proposal may live under its product, which a
 * templated path shows without naming the product.
 */
const stripConcreteProductPaths: StripRule = {
  reason: 'replace concrete product paths with the path template',
  applyLine(line) {
    return line.replace(
      /products\/(?!\{)[a-z0-9-]+\/(?!\{)[a-z0-9-]+(\/[a-z0-9-]+)*\//g,
      'products/{domain}/{product}/',
    );
  },
};

/* ------------------------------------------------------------------ */
/* Rule sets                                                          */
/* ------------------------------------------------------------------ */

const BASE: readonly StripRule[] = [
  stripHostnames,
  stripSlack,
  stripPrivateRepoLinks,
  stripConcreteProductPaths,
  stripHandles,
];

const SPEC: readonly StripRule[] = [stripOwnerTag, ...BASE];

/* ------------------------------------------------------------------ */
/* The allowlist                                                      */
/* ------------------------------------------------------------------ */

export const ALLOWLIST: readonly AllowlistEntry[] = [
  {
    path: 'README.md',
    slug: 'readme',
    title: 'Repository README',
    blurb: 'Orientation: what APEX is, the pipeline, the command surface, the repo layout.',
    strip: [stripReadmeExampleCodename, ...BASE],
  },
  {
    path: 'AGENTS.md',
    slug: 'agents',
    title: 'Guide for AI Tools',
    blurb: 'What an AI coworker reads first when it opens the APEX repository.',
    strip: BASE,
  },
  {
    path: 'docs/spec/README.md',
    slug: 'spec',
    title: 'Normative Specification',
    blurb:
      'The spec catalog, the precedence order between layers, and the artifact model map.',
    strip: SPEC,
  },
  {
    path: 'docs/spec/01-architecture.md',
    slug: 'spec-architecture',
    title: 'Architecture',
    blurb: 'Core concepts, the 22 artifact types, the linkage graph, the product hierarchy.',
    strip: SPEC,
  },
  {
    path: 'docs/spec/02-artifacts.md',
    slug: 'spec-artifacts',
    title: 'Artifact Reference',
    blurb: 'Per-type purpose, ID pattern, location, status enum, and required fields.',
    strip: SPEC,
  },
  {
    path: 'docs/spec/03-directory-structure.md',
    slug: 'spec-directory-structure',
    title: 'Directory Structure',
    blurb: 'The annotated repo tree, initiative layout, and status-based directory movement.',
    strip: [stripProductSlugEnum, ...SPEC],
  },
  {
    path: 'docs/spec/04-workflow.md',
    slug: 'spec-workflow',
    title: 'Workflow',
    blurb:
      'Every status lifecycle, branch prefixes, merge eligibility, and the governance layer.',
    strip: [stripApproverRoster, ...SPEC],
  },
  {
    path: 'docs/spec/05-validation-and-tooling.md',
    slug: 'spec-validation-and-tooling',
    title: 'Validation & Tooling',
    blurb: 'Schema mechanics, the validation passes, the apex CLI, CI workflows, PR tiers.',
    strip: SPEC,
  },
  {
    path: 'docs/spec/06-skills.md',
    slug: 'spec-skills',
    title: 'Skills & Agents',
    blurb: 'The full skills catalog grouped by category, plus the agent roster.',
    strip: SPEC,
  },
  {
    path: 'docs/BRANCH-NAMING-CONVENTION.md',
    slug: 'branch-naming-convention',
    title: 'Branch Naming Convention',
    blurb: 'Which branch prefix signals which kind of change.',
    strip: [stripPrivateRepoLinks, stripConcreteProductPaths],
  },
];

/** Fast lookup from repo path to entry, used when rewriting relative links. */
export const ALLOWLIST_BY_PATH: ReadonlyMap<string, AllowlistEntry> = new Map(
  ALLOWLIST.map((e) => [e.path, e]),
);

/* ------------------------------------------------------------------ */
/* Non-document sources                                               */
/* ------------------------------------------------------------------ */

/**
 * The frontmatter schema, republished so a reader can check every claim this
 * site makes about the artifact contract.
 *
 * It is NOT safe verbatim: `definitions.product_slug.enum` is the company's
 * internal product portfolio. `SCHEMA_REDACTIONS` names the JSON pointers the
 * pipeline empties before publishing; the leak gate is what proves the
 * redaction actually happened.
 */
export const SCHEMA_PATH = 'schemas/frontmatter.schema.json';

export const SCHEMA_REDACTIONS: readonly {
  readonly pointer: readonly string[];
  readonly reason: string;
}[] = [
  {
    pointer: ['definitions', 'product_slug', 'enum'],
    reason: 'internal product portfolio — the enum is closed, its membership is not published',
  },
];

/** Directory names only. Skill bodies are never read. */
export const SKILLS_DIR = '.cursor/skills';

/** Command names only, derived by regex. The source is never published. */
export const CLI_MAIN_PATH = 'packages/apex-tools/src/apex/cli/main.py';

/** File names and each workflow's `name:` field only. */
export const WORKFLOWS_DIR = '.github/workflows';

/**
 * Trees the pipeline never opens for any reason. `products/` is aggregate-counted
 * (directory and file counts from the tree listing) and appears here so that no
 * other code path can read a body out of it.
 */
export const NEVER_READ_TREES: readonly string[] = [
  'products/',
  'proposals/',
  'policies/',
  'guides/',
  'wiki/',
  'docs/decisions/',
  'teams/',
  'guilds/',
  'meetings/',
  'archive/',
  'newsletters/',
  'pods/',
  'docs/spec/07-known-discrepancies.md',
  'docs/spec/08-repo-linkage.md',
  'docs/spec/09-canonical-datamodel.md',
];

/**
 * apex-companion is read for exactly two facts: its README's product description
 * and the MCP tool count derived from the server's registration calls.
 */
export const COMPANION_README = 'README.md';
export const COMPANION_MCP_SERVER = 'apex_companion/mcp/server.py';
