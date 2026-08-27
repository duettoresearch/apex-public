Four things enforce the framework: a command-line validator, a set of CI
workflows, a library of skills, and a companion app that fronts the repository
for people and for AI tools.

## The `apex` CLI

Installed from the repository with `pip install -e packages/apex-tools/`. It
finds the repository root by walking up from the current directory to the first
directory containing both `products/` and `schemas/`.

| Command                   | What it does                                                              |
| ------------------------- | ------------------------------------------------------------------------- |
| `apex new`                | Scaffold a new artifact of a given type from its template                 |
| `apex validate`           | Run every validation pass over the repository                             |
| `apex migrate`            | Move initiatives into the directory their status implies                  |
| `apex status-change`      | Transition one initiative's status and relocate its directory             |
| `apex archive`            | Move terminal proposals into the archive                                  |
| `apex check-links`        | Verify markdown link integrity, with an optional autofix                  |
| `apex check-codeowners`   | Verify code-owner coverage over the artifact tree                         |
| `apex classify-pr`        | Assign a review tier to each changed file in a pull request               |
| `apex verify-pr-type`     | Check that a pull request's declared type matches its contents            |
| `apex arch-classify`      | Compare accumulated change against an artifact's architecture declaration |
| `apex track-warnings`     | Record validator warning counts over time to watch them trend             |
| `apex generate-apex-yaml` | Generate the repository-linkage manifest                                  |

`validate` and `check-links` also run as a pre-commit hook, so the failure
arrives before the commit rather than after the push.

## What validation checks

`apex validate` runs its passes in a fixed order over a single filesystem walk.
They fall into five groups:

**The contract.** Unknown artifact types are errors. Frontmatter is validated
against the per-type schema branch. Artifact IDs are globally unique. Deprecated
fields are reported on a runway — a warning first, an error after a stated
promotion date — so a contract change does not break every existing artifact on
the day it lands.

**Linkage.** Cross-references resolve: an experiment's parent initiative, a PRD's
validated experiments, an implementation's parent PRD, an initiative's
dependencies, with cycle detection on the dependency graph. A reference that
points at the wrong artifact type is reported separately from one that points at
nothing.

**Placement.** An artifact's path must agree with its type, domain, product, and
status. Terminal artifacts belong in status-named directories. Proposals live in
`proposals/` until they reach a terminal status, then in the archive.

**Governance.** Every initiative names a pod, and that pod resolves to a real pod
charter. Per-person allocation across charters does not exceed 100%. Guild
charters name an executive sponsor. Files matching an ignore pattern are not
tracked. Binary files inside product folders are size-capped.

**Documentation coherence.** The documented skill count must match the number of
skills on disk — the check exists because that number had drifted before.

Findings carry a severity. Advisory passes warn and never fail a build; a
referential rule graduates from warning to error on a published runway rather
than on the day someone writes it.

## CI workflows

{{stats.workflows}} workflows run against the repository. Their jobs, in one line
each:

- Validate frontmatter and links on every pull request and every push, filtered
  to the changed files on a pull request and unfiltered on a push.
- Classify each pull request's files into review tiers, comment the table, apply
  a tier label, and squash-merge the auto-merge-eligible ones.
- Verify that a pull request's declared type matches what it actually changes.
- Check code-owner coverage, and check pod-merge eligibility against initiative
  status.
- Auto-request the owning pod's product manager and tech lead as reviewers.
- Label pull requests by changed path, falling back to the branch prefix.
- Advisory architecture-rule checks and a repository-linkage drift check.
- Track validator warning counts so a warning trend is visible before it becomes
  an error.
- Scheduled hygiene: stale pull requests, stale initiatives, a weekly triage
  issue, a weekly health sweep, a daily status report, and branch cleanup after a
  pull request closes.
- Run the Python package test suite.

## Skills

{{stats.skills}} skills, grouped into 12 workflow categories, expose the
framework as slash commands: setup, proposals, discovery, specification,
planning, delivery, learning, documentation and communications, records,
reference, status and workflow, and pull requests.

Each skill is a written procedure in a `SKILL.md` file rather than a wrapper
around a hidden implementation, which is why the same skill executes correctly
whether a person or an agent is following it. The catalog is deployed to two
trees — one canonical, one a set of stubs pointing at it — so the procedure has a
single source and both editors reach it.

The full catalog is in the [skills and agents specification](/docs/spec-skills).

## APEX Companion

A hosted web application, REST API, and CLI that lets people browse, search, and
summarize APEX artifacts without git, a terminal, or an AI coding tool. It is the
answer to the framework's main adoption cost: the repository is a good source of
truth and a poor reading experience.

It also hosts the canonical MCP server, which gives AI tools authenticated read
and write access to the artifact graph over OAuth 2.1 with PKCE — searching
artifacts, reading one in full, creating a new one with a body, transitioning a
status, and driving pull-request review. Every write goes through the same schema
validation and lands as a reviewable change.

## Retired

Two things were built and then removed once something else covered the same
ground, and the removals are recorded as decisions rather than left implicit:

- **`packages/apex-mcp`** — a local, unauthenticated MCP server run over stdio.
  Retired in favor of the Companion's hosted server, so there is one MCP surface
  rather than two that can disagree.
- **The Docusaurus documentation site** — replaced by the Companion app, and left
  as a redirect-only stub rather than a second publishing surface to maintain.
