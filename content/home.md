## Product decisions, versioned in Git and enforced by CI

APEX — AI Product Execution — brings product development into the same
version-controlled workflow as code. Every artifact — from a strategic bet or
validated experiment to a requirements document, engineering plan, or decision
record — is a Markdown file with YAML frontmatter. Each file is validated
against a JSON Schema, moves through a defined lifecycle, and reaches the main
branch through a pull request.

The result is a product record that teams and AI agents can inspect, validate,
and improve with the same review, branching, and merge discipline already used
for code.

## What that buys you

**{{stats.artifactTypes}} artifact types with machine-enforced contracts.** The
frontmatter schema defines each type's ID pattern, allowed statuses, required
fields, and permitted relationships. A file that breaks its contract fails
validation before it reaches `main`.

**Lifecycles enforced in CI.** An initiative moves
`discovery → validated → delivery → deployed → learning → success`, and its
position on that path is a validated field, not a naming convention. Terminal
artifacts move to status-named directories automatically. The validator runs on
every pull request and every push.

**Review effort matched to change risk.** A classifier assigns every changed
file a review tier. Meeting notes and progress updates are Tier 0 and can merge
without human review. Everything else requires one or more code-owner approvals.
Anything the classifier cannot read or classify fails closed at the highest
tier.

**AI agents as first-class contributors.** {{stats.skills}} skills expose the
framework as slash commands. An agent can create an initiative, generate a PRD
from its evidence, or score that PRD against a quality rubric by following the
same procedure as a person. A hosted MCP server gives AI tools read and write
access to the artifact graph. Every agent change arrives as a pull request and
must pass the same schema and checks.

## What is in the repository today

The framework has managed its own development since
**{{stats.firstCommitDate}}**: {{stats.daysActive}} days,
{{stats.commits}} commits, and {{stats.contributors}} distinct commit authors.
It now tracks {{stats.artifactsTotal}} typed artifacts across
{{stats.initiatives}} initiatives, {{stats.products}} products, and
{{stats.domains}} domains.

These figures are calculated directly from the repository each time the site is
built. See the full breakdown on the [statistics](/stats) page.

## Where to start

- [How it works](/how-it-works) — the end-to-end lifecycle, the two ways to
  contribute, the review tiers, and the command surface.
- [The schema](/schema) — every artifact type, its ID pattern, its statuses, its
  required fields, and the raw schema to download.
- [Compared](/compare) — APEX next to Backstage, ADR tooling, RFC processes,
  docs-as-code, Shape Up, and product-management SaaS, including where those
  tools do something APEX does not.
- [Tooling](/tooling) — the CLI, the validation passes, the CI workflows, and the
  Companion app.
