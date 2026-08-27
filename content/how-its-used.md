A piece of work enters APEX as an idea and leaves it as a retrospective. Every
step in between is a file, a status change, and a pull request.

## The lifecycle

**Proposal.** An idea is written up as a proposal. A global or cross-cutting
process change goes in `proposals/`; a product idea goes in the product's folder
as a product proposal and can be upvoted to signal demand. A proposal that is
accepted becomes an initiative, and the initiative records which proposal it came
from.

**Initiative.** The strategic bet, and the root of everything downstream. It
states a hypothesis, names an owning pod, and carries a status. It is a directory
rather than a file, so meetings, discovery, experiments, designs, and updates
live alongside it.

**Discovery.** Interviews, competitive scans, source inventories, survey
readouts. Research that a later decision will rest on, kept next to the bet it
informs rather than in a separate research tool.

**Experiment.** A time-boxed test of the initiative's hypothesis. It runs
`planned → running → completed` and records an outcome: validated, invalidated,
or inconclusive. An inconclusive experiment is a real, publishable result.

**PRD.** Requirements, generated from the initiative's accumulated context, and
anchored to the experiments whose evidence they rest on. A separate review
artifact scores the PRD's implementability across five dimensions before it can
be approved.

**Implementation.** The engineering execution plan, linked to an approved PRD.
This is the one artifact allowed to carry granular ticket references — an
initiative may name a board and a PRD may name a single epic, but neither carries
issue tables, so a re-ticketed sprint does not churn the strategy documents.

**Decision.** An architectural or process decision, recorded ADR-style, standing
outside the initiative tree because its consequences outlive any one bet.

**Retrospective.** After the work ships and metrics come in at T+7 and T+30, the
outcome and its learnings are written down and the initiative reaches a terminal
status.

## Two ways to contribute

**Open a pull request with the artifact.** For most work this is the whole
process. Write the file, run the validator, open the PR, get the approvals the
tier requires. The merge is the approval.

**File a proposal first.** For an idea that needs public debate before anyone
writes the artifact, a proposal in `proposals/` gets reviewed and voted on in the
open. This costs more and is worth it when the disagreement is about whether to
do the thing at all, not how.

The lightweight path is the default. The heavyweight path exists so that the
default does not have to carry arguments it was not designed for.

## Branch prefixes

The branch prefix signals what kind of change is arriving, and the slug matches
the initiative directory or proposal filename so the branch and the work it
carries cannot drift apart.

`initiative/` · `proposal/` · `experiment/` · `prd/` · `impl/` · `design/` ·
`guide/` · `policy/` · `decision/` · `team/` · `pod/` · `guild/` · `arb/` ·
`fix/` · `feature/` · `docs/` · `chore/`

The full table, with when to use each, is in the
[branch naming convention](/docs/branch-naming-convention).

## Review tiers

A classifier reads every changed file in a pull request and assigns it a tier.
The pull request inherits the highest tier of any file it touches.

| Tier  | What lands here                                                                                                | Review required             |
| ----- | -------------------------------------------------------------------------------------------------------------- | --------------------------- |
| **0** | Meeting notes, discovery and planning material, tickets, release notes, assets, and progress updates           | None — bot-gated auto-merge |
| **1** | An existing core artifact with administrative-only frontmatter changes; any other file inside a product folder | One code-owner approval     |
| **2** | New core artifacts, substantive changes, anything ambiguous or unreadable                                      | Full code-owner review      |

Two rules bound what Tier 0 can admit. An update artifact qualifies only when
both its path and its own frontmatter say it is one — a markdown file merely
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

{{stats.skills}} skills wrap the procedures above as `/apex-*` commands, grouped
into 12 workflow categories. `/apex-initiative` creates an initiative and gathers
its context. `/apex-prd` generates a PRD from that context. `/apex-prd-review`
scores it. `/apex-transition` moves an artifact's status and refuses an illegal
transition. `/apex-validate` runs the same checks CI will run.

A skill is a written procedure, not a wrapper around a hidden API — which is why
the same skill works whether a person or an agent is executing it, and why the
result is reviewable as a diff either way.

The complete catalog is in the [skills and agents specification](/docs/spec-skills).

## Reading further

The specification documents this page summarizes are published in full:

- [Architecture](/docs/spec-architecture) — the artifact model and linkage graph
- [Artifact reference](/docs/spec-artifacts) — per-type fields and lifecycles
- [Directory structure](/docs/spec-directory-structure) — where everything lives
- [Workflow](/docs/spec-workflow) — every lifecycle, merge eligibility, governance
- [Validation and tooling](/docs/spec-validation-and-tooling) — what CI enforces
