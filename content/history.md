APEX began as a proposal to manage product development in Git. Since its second
week, the framework has managed its own evolution.

Every milestone below comes from the commit log. The figures at the bottom are
recalculated each time the site is built.

## Milestones

| Date       | What landed                                                                                                                                                                                                  |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 2026-02-07 | The repository is created under its original name, "PDP-SDLC." The first commits contain a process proposal and a set of document templates.                                                                 |
| 2026-02-08 | The frontmatter schema arrives, consolidated from an earlier CTO repository. Artifacts stop being prose governed by convention and become typed records.                                                     |
| 2026-02-13 | The project is rebranded as APEX and reorganized around the framework. APEX begins tracking its own development in its own artifacts.                                                                        |
| 2026-02-16 | The artifact contract is aligned across the schema, templates, and skills. Validation becomes enforced rather than advisory.                                                                                 |
| 2026-02-23 | Product-scoped ID patterns arrive. Experiment and PRD identifiers now carry the product code, so an ID indicates where its artifact belongs.                                                                 |
| 2026-02-27 | Seven validation checks, a repository-linkage schema, CI enforcement, and branch protection land. From this point, a broken artifact cannot reach `main`.                                                    |
| 2026-03-12 | Work begins on the APEX Companion, a web application for people who need to read and search artifacts without Git or a terminal.                                                                             |
| 2026-03-18 | Wiki-migration tooling arrives, including a value-signal audit for deciding what is worth moving. It is later retired after the migration is complete.                                                       |
| 2026-04-06 | The standalone remote MCP service is retired in favor of the Companion, consolidating the AI integration surface on one host.                                                                                |
| 2026-04-23 | Version 1.0.0 reaches "in implementation" status. Link checking, pull-request labeling, reviewer auto-assignment, and stale detection land the same day.                                                     |
| 2026-05-16 | The RFC artifact type is added, giving in-initiative technical debate a typed home instead of a comment thread.                                                                                              |
| 2026-05-29 | The Companion is promoted to a standalone internal product with its own initiative and proposal backlog.                                                                                                     |
| 2026-06-26 | Pod-charter model v2 adds a `pod-charter` type and membership-allocation enforcement, preventing a person from being committed beyond 100%.                                                                  |
| 2026-07-16 | Repository linkage and identity are normalized. A new registry declares initiative identifiers and enforces uniqueness, separating internal directory slugs from external keys.                              |
| 2026-08-25 | Architecture Review Board tooling arrives: a system-of-record registry, fitness-function detection, and `apex arch-classify`, which compares accumulated change with an artifact's architecture declaration. |

## Derived from the commit log

|                            |                              |
| -------------------------- | ---------------------------- |
| First commit               | {{stats.firstCommitDate}}    |
| Days active                | {{stats.daysActive}}         |
| Commits on the main branch | {{stats.commits}}            |
| Distinct commit authors    | {{stats.contributors}}       |
| Merged pull requests       | {{stats.mergedPullRequests}} |
| Tracked Markdown files     | {{stats.trackedMarkdown}}    |

## What the shape of that history shows

The schema arrived on day two, followed by CI enforcement three weeks later.
That sequence helped the artifact model hold: unchecked conventions drift, while
every layer added afterward — templates, skills, the CLI, and the Companion —
was built against a contract that already existed and already failed builds when
violated.

The retirements are as informative as the additions. A standalone MCP service
and a documentation site were each removed when another tool covered the same
ground. Later artifact types — `rfc` in May and `pod-charter` in June — were not
planned in advance. Each emerged after the framework revealed that an existing
type was being stretched beyond its intended purpose.
