APEX started as a proposal for putting a product development process in git. It
has been developed using itself since the second week of its existence.

Every milestone below was read out of the commit log. The derived figures at the
bottom are recomputed each time this site is built.

## Milestones

| Date       | What landed                                                                                                                                                                                                                      |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-02-07 | Repository created, under its original name "PDP-SDLC". The first commits are a process proposal and a set of document templates.                                                                                                |
| 2026-02-08 | The frontmatter schema arrives, consolidated from an earlier CTO repository. Artifacts stop being prose with conventions and start being typed records.                                                                          |
| 2026-02-13 | Rebranded to APEX and reorganized as an APEX project — the framework begins tracking its own development in its own artifacts.                                                                                                   |
| 2026-02-16 | The artifact contract is aligned across schema, templates, and skills, and validation is enforced rather than advisory.                                                                                                          |
| 2026-02-23 | Product-scoped ID patterns land: experiment and PRD identifiers carry the product code, so an ID says where its artifact belongs.                                                                                                |
| 2026-02-27 | Seven validation checks, a repository-linkage schema, CI enforcement, and branch protection. From here a broken artifact cannot reach `main`.                                                                                    |
| 2026-03-12 | Work begins on the APEX Companion — a web app for people who need to read and search artifacts without git or a terminal.                                                                                                        |
| 2026-03-18 | Tooling for migrating documentation out of a wiki, including a value-signal audit for deciding what was worth moving. Since retired: the migration finished.                                                                     |
| 2026-04-06 | The standalone remote MCP service is killed in favor of the Companion, consolidating the AI integration surface onto one host.                                                                                                   |
| 2026-04-23 | Version 1.0.0, status "in implementation". Link checking, PR labeling, reviewer auto-assignment, and stale detection land the same day.                                                                                          |
| 2026-05-16 | The RFC artifact type is added, giving in-initiative technical debate a typed home instead of a comment thread.                                                                                                                  |
| 2026-05-29 | The Companion is promoted to a standalone internal product with its own initiative and proposal backlog.                                                                                                                         |
| 2026-06-26 | The pod-charter model v2 lands: a `pod-charter` type with membership allocation enforcement, so a person cannot be committed past 100%.                                                                                          |
| 2026-07-16 | Repository linkage and identity are normalized. An external ID registry becomes the declaration site for initiative identifiers, with a uniqueness pass behind it, separating the internal directory slug from the external key. |
| 2026-08-25 | Architecture Review Board tooling activates: a system-of-record registry, fitness-function detection, and `apex arch-classify`, which compares accumulated change against an artifact's own architecture declaration.            |

## Derived from the commit log

|                            |                              |
| -------------------------- | ---------------------------- |
| First commit               | {{stats.firstCommitDate}}    |
| Days active                | {{stats.daysActive}}         |
| Commits on the main branch | {{stats.commits}}            |
| Distinct commit authors    | {{stats.contributors}}       |
| Merged pull requests       | {{stats.mergedPullRequests}} |
| Tracked markdown files     | {{stats.trackedMarkdown}}    |

## What the shape of that history shows

The schema arrived on day two and CI enforcement three weeks later. That ordering
is the reason the artifact model held: a convention that is not checked drifts
within a month, and every layer added afterward — templates, skills, the CLI, the
Companion — was written against a contract that already existed and already
failed builds when violated.

The retirements are as informative as the additions. A standalone MCP service and
a documentation site were both built and both removed once something else covered
the same ground. The artifact types added later — `rfc` in May, `pod-charter` in
June — were not planned in advance. Each one arrived after an existing type was
observed being misused for the job.
