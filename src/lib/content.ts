/**
 * Why: The generated JSON is the build's only output contract, and it is
 * imported as untyped JSON by default. Declaring the shapes once here means a
 * page that reads a field the pipeline stopped emitting fails to compile rather
 * than rendering `undefined`.
 * What: Types the committed snapshot in `src/generated/` and re-exports it as
 * typed values. Everything is a static import, so nothing is fetched at runtime.
 * Test: `npm run typecheck`
 */

import statsJson from '../generated/stats.json';
import schemaTypesJson from '../generated/schema-types.json';
import docsJson from '../generated/docs.json';
import pagesJson from '../generated/pages.json';
import toolingJson from '../generated/tooling.json';

export interface TocEntry {
  readonly depth: number;
  readonly id: string;
  readonly text: string;
}

export interface Doc {
  readonly slug: string;
  readonly title: string;
  readonly blurb: string;
  readonly sourcePath: string;
  readonly html: string;
  readonly toc: readonly TocEntry[];
}

export interface LinkageEdge {
  readonly field: string;
  readonly targetType: string;
  readonly resolution: string;
}

export interface ArtifactType {
  readonly type: string;
  readonly description: string;
  readonly idPattern: string | null;
  readonly pathTemplate: string | null;
  readonly statuses: readonly string[];
  readonly terminalStatuses: readonly string[];
  readonly required: readonly string[];
  readonly optional: readonly string[];
  readonly linkage: readonly LinkageEdge[];
}

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
  readonly mergedPullRequests?: number;
  readonly companionMcpTools?: number;
}

export interface Workflow {
  readonly file: string;
  readonly name: string;
}

export interface SkillCategory {
  readonly category: string;
  readonly skills: readonly string[];
}

export interface Tooling {
  readonly cliCommands: readonly string[];
  readonly workflows: readonly Workflow[];
  readonly skills: readonly string[];
  readonly skillCategories: readonly SkillCategory[];
  readonly companionDescription?: string;
  readonly companionMcpTools?: number;
}

export const stats = statsJson as Stats;
export const schemaTypes = schemaTypesJson as readonly ArtifactType[];
export const docs = docsJson as readonly Doc[];
export const tooling = toolingJson as Tooling;

const pages = pagesJson as readonly Doc[];

/** Looks up an authored page by slug. Throws at import time if it is missing. */
export function page(slug: string): Doc {
  const found = pages.find((p) => p.slug === slug);
  if (!found) throw new Error(`generated content is missing the page "${slug}"`);
  return found;
}

/** Looks up an allowlisted document by slug, or undefined for an unknown route. */
export function doc(slug: string): Doc | undefined {
  return docs.find((d) => d.slug === slug);
}

/**
 * Why: The snapshot used to carry the timestamp of the run that produced it, so
 * a refresh that found nothing new still changed a file and opened a pull
 * request. Freshness belongs to the build, not to the committed content.
 * What: The UTC date this bundle was built, stamped in by `vite.config.ts`.
 * Falls back to an empty string so a bundle built without the define renders
 * nothing rather than the literal `undefined`.
 * Test: `the committed snapshot carries no wall-clock timestamp`
 */
export const BUILD_DATE: string = (import.meta.env.VITE_BUILD_TIME ?? '').slice(0, 10);

/** Formats an integer with thousands separators. */
export function num(n: number): string {
  return n.toLocaleString('en-US');
}
