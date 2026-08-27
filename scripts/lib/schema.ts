/**
 * Why: The schema is the contract every APEX artifact is validated against, so
 * it is the one place on this site where a claim about "22 artifact types" can
 * be checked rather than asserted. Deriving the type table from the schema file
 * means the page cannot drift from the thing it describes.
 * What: Reads `schemas/frontmatter.schema.json` and produces one record per
 * artifact type: name, description, ID pattern, status enum, required fields,
 * and outbound linkage edges.
 * Test: `derives one record per type in the enum`, `resolves the allOf dispatch`
 */

/** One outbound reference an artifact type may declare. */
export interface LinkageEdge {
  readonly field: string;
  readonly targetType: string;
  readonly resolution: string;
}

/** Everything the schema page shows for a single artifact type. */
export interface ArtifactTypeRecord {
  readonly type: string;
  readonly description: string;
  /** null when identity comes from the path rather than an ID field. */
  readonly idPattern: string | null;
  readonly pathTemplate: string | null;
  readonly statuses: readonly string[];
  readonly terminalStatuses: readonly string[];
  readonly required: readonly string[];
  readonly optional: readonly string[];
  readonly linkage: readonly LinkageEdge[];
}

interface JsonSchemaNode {
  readonly [key: string]: unknown;
}

/** Reads a string property, or null when absent or the wrong shape. */
function str(node: JsonSchemaNode, key: string): string | null {
  const v = node[key];
  return typeof v === 'string' ? v : null;
}

/** Reads a string-array property, or an empty array. */
function strArray(node: JsonSchemaNode, key: string): string[] {
  const v = node[key];
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
}

/**
 * Resolves the root `allOf` type dispatch into a `type` -> definition map.
 * Each branch is `if: {properties: {type: {const}}}, then: {$ref}`.
 */
function dispatchMap(schema: JsonSchemaNode): Map<string, JsonSchemaNode> {
  const defs = (schema['definitions'] ?? {}) as Record<string, JsonSchemaNode>;
  const out = new Map<string, JsonSchemaNode>();

  const allOf = schema['allOf'];
  if (!Array.isArray(allOf)) return out;

  for (const branch of allOf as JsonSchemaNode[]) {
    const cond = branch['if'] as JsonSchemaNode | undefined;
    const then = branch['then'] as JsonSchemaNode | undefined;
    if (!cond || !then) continue;

    const props = cond['properties'] as Record<string, JsonSchemaNode> | undefined;
    const typeConst = props?.['type']?.['const'];
    const ref = str(then, '$ref');
    if (typeof typeConst !== 'string' || !ref) continue;

    const defName = ref.replace('#/definitions/', '');
    const def = defs[defName];
    if (def) out.set(typeConst, def);
  }

  return out;
}

/** Pulls the status enum out of a definition's `status` property. */
function statusEnum(def: JsonSchemaNode): string[] {
  const props = def['properties'] as Record<string, JsonSchemaNode> | undefined;
  const status = props?.['status'];
  if (!status) return [];
  const direct = strArray(status, 'enum');
  if (direct.length > 0) return direct;
  // Some types express status as a union of enums.
  const anyOf = status['anyOf'];
  if (Array.isArray(anyOf)) {
    return (anyOf as JsonSchemaNode[]).flatMap((n) => strArray(n, 'enum'));
  }
  return [];
}

/** Reads the `x-apex-linkage` annotation into typed edges. */
function linkage(def: JsonSchemaNode): LinkageEdge[] {
  const raw = def['x-apex-linkage'];
  if (!Array.isArray(raw)) return [];
  return (raw as JsonSchemaNode[])
    .map((e) => ({
      field: str(e, 'field') ?? '',
      targetType: str(e, 'target_type') ?? 'unknown',
      resolution: str(e, 'resolution') ?? 'optional',
    }))
    .filter((e) => e.field.length > 0);
}

/**
 * The per-type one-liners. The schema's own `description` fields describe
 * individual properties rather than the type, so the purpose text comes from
 * the architecture spec's type table, transcribed here.
 */
const TYPE_PURPOSE: Readonly<Record<string, string>> = {
  initiative: 'A strategic bet with a hypothesis to validate. The root artifact.',
  experiment: 'A time-boxed validation of a hypothesis within an initiative.',
  prd: 'Product requirements, generated from an initiative and its evidence.',
  'prd-review': 'A scored quality review of a PRD, gating it before approval.',
  implementation: 'An engineering execution plan linked to an approved PRD.',
  design: 'A technical architecture design scoped to an initiative.',
  proposal: 'A global or cross-cutting process proposal open for debate.',
  'product-proposal': 'A low-friction product idea in a product folder backlog.',
  decision: 'An architectural or process decision record, ADR-style.',
  policy: 'A standing, binding operating decision.',
  guide: 'A step-by-step task instruction aimed at one audience.',
  'team-charter': "A team's structure, mission, and ways of working.",
  'pod-charter': "A pod's structure, mission, membership, and ownership.",
  'guild-charter': 'An advisory, standards-setting guild that owns no delivery.',
  wiki: 'A reference or knowledge-base article.',
  update: 'A stakeholder progress update scoped to an initiative.',
  rfc: 'A request for comments scoped to an initiative.',
  doc: 'Generated product documentation for a shipped initiative.',
  retrospective: 'A post-initiative retrospective capturing outcome and learnings.',
  'test-manifest': 'A map from a PRDacceptance criteria to the tests that cover them.',
  note: 'A catch-all for content worth keeping that fits no other type.',
  discovery: 'Research input backing an initiative: interviews, scans, readouts.',
};

/** Builds the full artifact-type table from the parsed schema document. */
export function parseSchema(schema: JsonSchemaNode): ArtifactTypeRecord[] {
  const rootProps = schema['properties'] as Record<string, JsonSchemaNode> | undefined;
  const types = strArray(rootProps?.['type'] ?? {}, 'enum');
  const defs = dispatchMap(schema);

  return types.map((type) => {
    const def = defs.get(type) ?? {};
    const props = (def['properties'] ?? {}) as Record<string, unknown>;
    const required = strArray(def, 'required');
    const optional = Object.keys(props)
      .filter((k) => !required.includes(k) && k !== 'type')
      .sort();

    return {
      type,
      description: TYPE_PURPOSE[type] ?? '',
      idPattern: str(def, 'x-apex-id-pattern'),
      pathTemplate: str(def, 'x-apex-path-template'),
      statuses: statusEnum(def),
      terminalStatuses: strArray(def, 'x-apex-terminal-statuses'),
      required,
      optional,
      linkage: linkage(def),
    };
  });
}
