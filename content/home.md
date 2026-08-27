## Product decisions, in git, checked by CI

APEX — AI Product Execution — is a product development framework where every
product artifact is a markdown file in a git repository. A strategic bet, a
validated experiment, a requirements document, an engineering plan, a decision
record: each one is a file with YAML frontmatter, validated against a JSON
Schema, moved through a status lifecycle, and merged by pull request.

The same review, branching, and merge discipline a team already applies to its
code is applied to the decisions that produce it.

## What that buys you

**{{stats.artifactTypes}} artifact types with a machine contract.** The
frontmatter schema is the authority on what each type requires — its ID pattern,
its status enum, its required fields, and which other artifacts it may point at.
A file that does not satisfy its type fails validation before it reaches `main`.

**Status lifecycles enforced in CI.** An initiative moves
`discovery → validated → delivery → deployed → learning → success`, and its
position on that path is a validated field, not a convention. Terminal artifacts
move to status-named directories automatically. The validator runs on every pull
request and on every push.

**Tiered review with auto-merge for low-risk changes.** A classifier reads each
changed file and assigns it a tier. Meeting notes and progress updates are Tier 0
and merge without human review. Everything else needs one or more code-owner
approvals. Anything the classifier cannot read or classify fails closed to the
highest tier.

**AI agents as first-class contributors.** {{stats.skills}} skills expose the
framework as slash commands, so an agent creates an initiative, generates a PRD
from its evidence, or scores that PRD against a quality rubric using the same
procedure a person would. A hosted MCP server gives AI tools read and write
access to the artifact graph. Every agent write lands as a pull request against
the same schema and the same checks.

## What is in the repository today

The framework has been running on itself since **{{stats.firstCommitDate}}** —
{{stats.daysActive}} days, {{stats.commits}} commits, {{stats.contributors}}
distinct commit authors. It currently tracks {{stats.artifactsTotal}} typed
artifacts across {{stats.initiatives}} initiatives, {{stats.products}} products,
and {{stats.domains}} domains.

Those numbers are read out of the repository each time this site is built. Full
breakdown on the [statistics](/stats) page.

## Where to start

- [How it works](/how-it-works) — the lifecycle end to end, the two ways to
  contribute, the review tiers, and the command surface.
- [The schema](/schema) — every artifact type, its ID pattern, its statuses, its
  required fields, and the raw schema to download.
- [Compared](/compare) — APEX next to Backstage, ADR tooling, RFC processes,
  docs-as-code, Shape Up, and product-management SaaS, including where those
  tools do something APEX does not.
- [Tooling](/tooling) — the CLI, the validation passes, the CI workflows, and the
  Companion app.
