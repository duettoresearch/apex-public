APEX overlaps with several established categories without fitting neatly into
any one of them. This comparison shows where APEX differs, where established
alternatives are stronger, and what tradeoffs a team should expect.

## At a glance

|                                                        | Scope                            | Storage                                       | Schema enforcement                                 | Lifecycle enforced in CI                                 | AI-agent write path                                           | Review / merge automation                                 |
| ------------------------------------------------------ | -------------------------------- | --------------------------------------------- | -------------------------------------------------- | -------------------------------------------------------- | ------------------------------------------------------------- | --------------------------------------------------------- |
| **APEX**                                               | Both product and engineering     | Git (Markdown + YAML frontmatter)             | JSON Schema, per-type, blocking                    | Yes — status is a validated field with legal transitions | Yes — skills and an MCP server, writing through pull requests | Yes — per-file tier classifier with auto-merge for Tier 0 |
| **Backstage**                                          | Engineering (catalog + TechDocs) | Git for docs; a catalog database for entities | Yes, for catalog entities (`catalog-info.yaml`)    | No — entities have no product lifecycle                  | Via the catalog API; not a docs-authoring path                | No — merges are ordinary repo policy                      |
| **ADR tooling** (adr-tools, log4brains)                | Engineering decisions only       | Git (Markdown)                                | No — a filename and heading convention             | Status is a heading, not a checked field                 | No                                                            | No                                                        |
| **RFC processes** (Rust RFCs, IETF, Uber/Stripe-style) | Proposals only                   | Git or a document store                       | Template conformance by review                     | By human process, not by tooling                         | No                                                            | Human review, occasionally bot-assisted                   |
| **Docs-as-code** (Docusaurus, MkDocs)                  | Documentation only               | Git (Markdown)                                | Frontmatter for navigation, not for a domain model | No                                                       | No                                                            | No                                                        |
| **Shape Up**                                           | Product method                   | Method — no storage prescribed                | No                                                 | No — it is a method, not a system                        | No                                                            | No                                                        |
| **Amazon PR/FAQ**                                      | Product framing                  | Documents                                     | No                                                 | No                                                       | No                                                            | No                                                        |
| **Productboard / Aha! / Jira Product Discovery**       | Product                          | SaaS database                                 | Yes, per their own object models                   | Workflow states enforced in the product                  | Via API and vendor AI features                                | Vendor workflow rules, not code review                    |
| **Notion / Confluence wikis**                          | Both, loosely                    | SaaS wiki                                     | Templates and database properties                  | No                                                       | Via API and vendor AI features                                | Page approvals; not diff-based                            |

## Where each comparator is stronger

**Backstage** owns the service catalog, and APEX has nothing like it. A Backstage
entity graph knows which service owns which API, what depends on what at runtime,
and who is on call. APEX links artifacts to repositories through a manifest file
but does not model runtime topology, and it has no plugin ecosystem, no
scaffolder, and no developer portal UI at Backstage's level. A team that needs a
software catalog needs Backstage; APEX does not replace it.

**ADR tooling** is far lighter to adopt. `adr-tools` is a shell script.
log4brains gives a browsable decision log from a directory of Markdown with
almost no configuration. APEX's decision records carry more contract — a
validated status, an ID pattern, an architecture declaration — and that contract
costs setup that a team wanting only decision records should not pay.

**RFC processes** have something APEX's proposal path does not: a genuinely open
and often external constituency, with the social conventions to match. The Rust
RFC process works because the discussion norms, the shepherding, and the final
comment period are the substance. APEX gives the proposal a file and a review
gate; it does not give it a community.

**Docs-as-code sites** are stronger publishing tools. Docusaurus and MkDocs
produce fast, searchable, versioned documentation sites with navigation and
stable URLs out of the box. APEX's repository is a source of truth, not a reading
experience. The Companion app exists because raw Markdown in a private
repository is a poor consumption surface. APEX retired its own Docusaurus site
rather than maintain two publishing systems.

**Shape Up** is a method, and methods travel where systems do not. Appetite,
betting tables, and fixed time with variable scope are ideas a team can adopt
without any tooling. APEX takes no position on how work is scoped or selected;
an initiative's hypothesis field can hold a Shape Up pitch as readily as any
other framing.

**Amazon's PR/FAQ** forces a specific and useful discipline — write the launch
announcement first, then the objections — that no schema can require. APEX can
hold a PR/FAQ as an artifact. It cannot make the thinking happen.

**Productboard, Aha!, and Jira Product Discovery** excel where a database excels:
prioritization across hundreds of items, high-volume customer feedback ingestion,
roadmap views for people who will never open a terminal, and ready-made
integrations. APEX's aggregate views are generated reports, and its
prioritization is whatever a person records in a field.

**Notion and Confluence** win on authoring: real-time collaborative editing,
comments anchored to a paragraph, embeds, and a zero-friction entry point for
someone who has never used Git. APEX's Companion app gives non-technical
contributors a narrower surface than a full wiki.

## Where APEX is different

Two related design choices distinguish APEX.

**The contract is machine-checked, and the check blocks the merge.** A wiki
template is a suggestion. A SaaS object model is enforced but lives in a vendor's
database. APEX's contract is a JSON Schema in the same repository as the
artifacts. A contract change and the migration of every artifact to match it can
arrive in one reviewable pull request; until they do, CI blocks the merge.

**An AI agent and a person write through the same path.** Vendor AI features write
into a product's database through its API, with the vendor's audit trail. An APEX
agent writes a Markdown file, opens a pull request, and gets tiered review like
anyone else. The output is a diff, reviewable line by line, revertible with
`git revert`, and subject to the same schema validation. That is less
convenient than an API write and considerably easier to trust.

## The tradeoffs

Git is the entry barrier. Every strength above assumes contributors who are
comfortable with branches, pull requests, and merge conflicts — which product
managers, designers, and executives frequently are not. The Companion app narrows
that gap and does not close it.

The contract also requires maintenance. With {{stats.artifactTypes}} artifact
types, a change to one can propagate through the schema, templates, skills,
handbook, and validator. APEX's own specification tracks discrepancies when a
change reaches one layer but not the others, making the cost visible rather than
pretending it does not exist.
