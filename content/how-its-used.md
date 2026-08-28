Work enters APEX as an idea and leaves as a retrospective. Every step in between
is recorded as a file, a status change, and a pull request, creating a traceable
path from intent to outcome.

## The lifecycle

**Proposal.** An idea begins as a proposal. A global or cross-cutting process
change goes in `proposals/`; a product idea goes in the product's folder, where
it can be upvoted to signal demand. When a proposal is accepted, it becomes an
initiative that retains a link to its source.

**Initiative.** The initiative is the strategic bet and the root of everything
downstream. It states a hypothesis, names an owning pod, and carries a status.
Because it is a directory rather than a single file, meetings, discovery,
experiments, designs, and updates can live alongside it.

**Discovery.** Interviews, competitive scans, source inventories, and survey
readouts capture the evidence behind later decisions. The research stays beside
the bet it informs instead of disappearing into a separate tool.

**Experiment.** A time-boxed test of the initiative's hypothesis. It runs
`planned → running → completed` and records an outcome: validated, invalidated,
or inconclusive. An inconclusive experiment is a real, publishable result.

**PRD.** Requirements are generated from the initiative's accumulated context
and anchored to the experiments that support them. Before approval, a separate
review artifact scores the PRD's implementability across five dimensions.

**Implementation.** The engineering execution plan links to an approved PRD. It
is the only artifact allowed to carry granular ticket references. An initiative
may name a board and a PRD may name a single epic, but neither carries issue
tables, so re-ticketing a sprint does not churn the strategy documents.

**Decision.** An architectural or process decision, recorded ADR-style, standing
outside the initiative tree because its consequences outlive any one bet.

**Retrospective.** After the work ships and metrics arrive at T+7 and T+30, the
team records the outcome and its lessons, and the initiative reaches a terminal
status.

## Two ways to contribute

**Open a pull request with the artifact.** For most work, this is the entire
process: write the file, run the validator, open the pull request, and get the
approvals required by its tier. The merge is the approval.

**File a proposal first.** When an idea needs open debate before anyone writes
the artifact, a proposal in `proposals/` is reviewed and voted on. This path
costs more, but it is worthwhile when the question is whether to do the work at
all, not how to do it.

The lightweight path is the default. The heavyweight path exists so that the
default does not have to carry arguments it was not designed for.

## Branch prefixes

The branch prefix signals the kind of change being proposed. Its slug matches
the initiative directory or proposal filename, keeping the branch tied to the
work it carries.

`initiative/` · `proposal/` · `experiment/` · `prd/` · `impl/` · `design/` ·
`guide/` · `policy/` · `decision/` · `team/` · `pod/` · `guild/` · `arb/` ·
`fix/` · `feature/` · `docs/` · `chore/`

The full table, with when to use each, is in the
[branch naming convention](/docs/branch-naming-convention).

## Review tiers

A classifier reads every changed file and assigns it a tier. The pull request
inherits the highest tier assigned to any file it touches.

| Tier  | What lands here                                                                                                | Review required             |
| ----- | -------------------------------------------------------------------------------------------------------------- | --------------------------- |
| **0** | Meeting notes, discovery and planning material, tickets, release notes, assets, and progress updates           | None — bot-gated auto-merge |
| **1** | An existing core artifact with administrative-only frontmatter changes; any other file inside a product folder | One code-owner approval     |
| **2** | New core artifacts, substantive changes, anything ambiguous or unreadable                                      | Full code-owner review      |

Two rules limit what Tier 0 can admit. An update artifact qualifies only when
both its path and its own frontmatter identify it as one — a Markdown file merely
sitting in an `updates/` directory does not. And if a file's frontmatter `type`
changed between the base branch and the pull request, the whole pull request
loses auto-merge eligibility, so an artifact cannot be relabelled into a
low-review shape.

Anything the classifier cannot read fails closed to Tier 2. An empty change set
is Tier 2, never Tier 0.

Beyond tiering, pod members may approve a merge only when every initiative the
pull request touches is already at `delivery` or later. Work still in `discovery`
or `validated` needs a leadership approver.

## Skills as slash commands

{{stats.skills}} skills turn the procedures above into `/apex-*` commands across
12 workflow categories. `/apex-initiative` creates an initiative and gathers its
context. `/apex-prd` generates a PRD from that context, and `/apex-prd-review`
scores it. `/apex-transition` changes an artifact's status while rejecting
illegal transitions. `/apex-validate` runs the same checks as CI.

A skill is a written procedure, not a wrapper around a hidden API. The same skill
therefore works for a person or an agent, and the result remains reviewable as a
diff either way.

The complete catalog is in the [skills and agents specification](/docs/spec-skills).

## Reading further

The specification documents this page summarizes are published in full:

- [Architecture](/docs/spec-architecture) — the artifact model and linkage graph
- [Artifact reference](/docs/spec-artifacts) — per-type fields and lifecycles
- [Directory structure](/docs/spec-directory-structure) — where everything lives
- [Workflow](/docs/spec-workflow) — every lifecycle, merge eligibility, governance
- [Validation and tooling](/docs/spec-validation-and-tooling) — what CI enforces
