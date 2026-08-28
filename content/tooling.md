Four layers put the framework into practice: a command-line validator, CI
workflows, a library of skills, and a Companion app that gives people and AI
tools a usable front end to the repository.

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
| `apex check-links`        | Verify Markdown link integrity, with an optional autofix                  |
| `apex check-codeowners`   | Verify code-owner coverage over the artifact tree                         |
| `apex classify-pr`        | Assign a review tier to each changed file in a pull request               |
| `apex verify-pr-type`     | Check that a pull request's declared type matches its contents            |
| `apex arch-classify`      | Compare accumulated change against an artifact's architecture declaration |
| `apex track-warnings`     | Record validator warning counts over time to watch them trend             |
| `apex generate-apex-yaml` | Generate the repository-linkage manifest                                  |

`validate` and `check-links` also run as a pre-commit hook, so the failure
arrives before the commit rather than after the push.

## What validation checks

`apex validate` runs its checks in a fixed order during a single filesystem
walk. The checks fall into five groups:

**The contract.** Unknown artifact types are errors. Frontmatter is validated
against the schema branch for its type, and artifact IDs must be globally unique.
Deprecated fields follow a published transition window — first a warning, then
an error after a stated date — so a contract change does not break every existing
artifact on the day it lands.

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

Every finding carries a severity. Advisory checks warn without failing the
build. Referential rules move from warning to error on a published schedule
rather than on the day they are introduced.

## CI workflows

{{stats.workflows}} workflows run against the repository. Together, they:

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

Each skill is a written procedure in a `SKILL.md` file, not a wrapper around a
hidden implementation. The same skill therefore works for a person or an agent.
The catalog is deployed to two trees — one canonical and one containing stubs
that point to it — so every procedure has a single source while remaining
available in both editors.

The full catalog is in the [skills and agents specification](/docs/spec-skills).

## APEX Companion

The APEX Companion is a hosted web application, REST API, and CLI for browsing,
searching, and summarizing artifacts without Git, a terminal, or an AI coding
tool. It addresses the framework's main adoption cost: a repository is a strong
source of truth but a poor reading experience.

It also hosts the canonical MCP server, which gives AI tools authenticated read
and write access to the artifact graph over OAuth 2.1 with PKCE. Tools can search
artifacts, read one in full, create one with a body, transition its status, and
drive pull-request review. Every write passes through the same schema validation
and lands as a reviewable change.

## Retired

Two components were removed after other tools covered the same ground. Their
retirements are recorded as explicit decisions:

- **`packages/apex-mcp`** — a local, unauthenticated MCP server run over stdio.
  Retired in favor of the Companion's hosted server, so there is one MCP surface
  rather than two that can disagree.
- **The Docusaurus documentation site** — replaced by the Companion app, and left
  as a redirect-only stub rather than a second publishing surface to maintain.
