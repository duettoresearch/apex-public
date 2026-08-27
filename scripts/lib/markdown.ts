/**
 * Why: Source markdown is written for readers inside a private repository. Its
 * relative links point at files that do not exist on this site, and its raw HTML
 * would be an injection surface. Rendering has to rewrite the first and remove
 * the second before anything reaches a page.
 * What: Renders markdown to sanitized HTML with heading anchors, rewrites
 * relative links to site routes when the target is allowlisted and unlinks them
 * when it is not, and extracts a per-document table of contents.
 * Test: `rewrites an allowlisted relative link`, `unlinks a non-allowlisted one`,
 *       `emits heading anchors`
 */

import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkRehype from 'remark-rehype';
import rehypeSlug from 'rehype-slug';
import rehypeSanitize, {
  defaultSchema,
  type Options as SanitizeOptions,
} from 'rehype-sanitize';
import rehypeStringify from 'rehype-stringify';
import { visit } from 'unist-util-visit';
import { toString as hastToString } from 'hast-util-to-string';
import type { Root as HastRoot, Element } from 'hast';
import { ALLOWLIST_BY_PATH, type AllowlistEntry } from '../../content.config.ts';

/** One entry in a document's table of contents. */
export interface TocEntry {
  readonly depth: number;
  readonly id: string;
  readonly text: string;
}

export interface RenderedDoc {
  readonly html: string;
  readonly toc: readonly TocEntry[];
}

/**
 * Sanitize schema extended to keep what the source documents actually use:
 * heading `id`s (rehype-slug adds them), GFM table alignment, and the language
 * class on fenced code blocks.
 */
const SANITIZE_SCHEMA: SanitizeOptions = {
  ...defaultSchema,
  attributes: {
    ...defaultSchema.attributes,
    '*': [...(defaultSchema.attributes?.['*'] ?? []), 'id'],
    a: [...(defaultSchema.attributes?.['a'] ?? []), 'target', 'rel'],
    code: [...(defaultSchema.attributes?.['code'] ?? []), ['className', /^language-./]],
    th: [...(defaultSchema.attributes?.['th'] ?? []), 'align'],
    td: [...(defaultSchema.attributes?.['td'] ?? []), 'align'],
  },
};

/** Strips a leading `./` and any `#fragment` or trailing `/`. */
function normalizeTarget(href: string, fromPath: string): { path: string; hash: string } {
  const [rawPath = '', hash = ''] = href.split('#');
  const fromDir = fromPath.includes('/') ? fromPath.slice(0, fromPath.lastIndexOf('/')) : '';
  const joined = rawPath.startsWith('/')
    ? rawPath.slice(1)
    : normalizePath(fromDir ? `${fromDir}/${rawPath}` : rawPath);
  return { path: joined, hash: hash ? `#${hash}` : '' };
}

/** Resolves `.` and `..` segments without touching the filesystem. */
function normalizePath(p: string): string {
  const out: string[] = [];
  for (const seg of p.split('/')) {
    if (seg === '' || seg === '.') continue;
    if (seg === '..') out.pop();
    else out.push(seg);
  }
  return out.join('/');
}

/** True for a link that leaves the document — a scheme, a mailto, or an anchor. */
function isExternalOrAnchor(href: string): boolean {
  return /^(https?:|mailto:|#)/i.test(href);
}

/**
 * Rewrites relative links. An allowlisted target becomes the site route for that
 * document; anything else is unlinked in place, keeping its text. The repository
 * is private, so emitting a URL into it would give every reader a 404 and would
 * disclose a path.
 */
function rewriteLinks(fromPath: string) {
  return (tree: HastRoot): void => {
    visit(tree, 'element', (node: Element, index, parent) => {
      if (node.tagName !== 'a') return;
      const href = node.properties?.['href'];
      if (typeof href !== 'string') return;

      if (isExternalOrAnchor(href)) {
        // An off-site link opens in a new tab and drops referrer/opener.
        if (/^https?:/i.test(href)) {
          node.properties = {
            ...node.properties,
            target: '_blank',
            rel: ['noreferrer', 'noopener'],
          };
        }
        return;
      }

      const { path, hash } = normalizeTarget(href, fromPath);
      const entry: AllowlistEntry | undefined = ALLOWLIST_BY_PATH.get(path);
      if (entry) {
        node.properties = { ...node.properties, href: `/docs/${entry.slug}${hash}` };
        return;
      }

      // Not publishable: replace the anchor with its own children.
      if (parent && typeof index === 'number' && 'children' in parent) {
        parent.children.splice(index, 1, ...node.children);
      }
    });
  };
}

/** Collects h2/h3 headings into a table of contents as a side effect. */
function collectToc(sink: TocEntry[]) {
  return (tree: HastRoot): void => {
    visit(tree, 'element', (node: Element) => {
      if (!/^h[23]$/.test(node.tagName)) return;
      const id = node.properties?.['id'];
      if (typeof id !== 'string') return;
      sink.push({ depth: Number(node.tagName.slice(1)), id, text: hastToString(node) });
    });
  };
}

/** Drops a YAML frontmatter block. The site renders bodies, not metadata. */
export function stripFrontmatter(markdown: string): string {
  if (!markdown.startsWith('---\n')) return markdown;
  const end = markdown.indexOf('\n---', 4);
  if (end === -1) return markdown;
  return markdown.slice(markdown.indexOf('\n', end + 1) + 1);
}

/** Renders one allowlisted document to sanitized HTML plus its TOC. */
export async function renderMarkdown(
  markdown: string,
  fromPath: string,
): Promise<RenderedDoc> {
  const toc: TocEntry[] = [];
  const file = await unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkRehype)
    .use(rehypeSlug)
    .use(rewriteLinks, fromPath)
    .use(collectToc, toc)
    .use(rehypeSanitize, SANITIZE_SCHEMA)
    .use(rehypeStringify)
    .process(markdown);

  return { html: String(file), toc };
}
