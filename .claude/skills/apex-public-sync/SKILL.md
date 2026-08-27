---
name: apex-public-sync
description: Refresh the apex-public marketing site's content snapshot from the private APEX and apex-companion repositories, run the leak gate, review what changed, and open a pull request. Use when APEX has moved and the public site is behind, or on a scheduled content refresh.
---

# apex-public-sync

Refreshes `src/generated/` from the private source repositories, proves nothing
leaked, and opens a reviewable pull request.

## Two rules that govern everything below

**Never read outside the allowlist.** `content.config.ts` declares every source
file the pipeline may open. `products/`, `proposals/`, `policies/`, `guides/`,
`wiki/`, `docs/decisions/`, `teams/`, `guilds/`, `meetings/`, and `archive/` are
listed in `NEVER_READ_TREES` and are never opened for any reason — `products/` is
aggregate-counted from the tree listing only, never from a file body. If a new
document should be published, add it to `ALLOWLIST` with strip rules; do not
widen a read path.

**The leak gate is the release gate.** It scans finished output, not input,
because a strip rule that stops matching after an upstream rewrite fails
silently. If it fires, fix the leak at its source with a strip rule. Adding a
token to `ALLOWED_TICKET_TOKENS` is allowed only after vetting it and recording
in a comment why it is safe. Never widen the gate to make a build pass.

**A content refresh is NOT valid unless the private denylist is loaded.** This
repository is public, so the gate is split in two: generic SHAPE patterns are
committed in `scripts/lib/forbidden.ts`, and the specific instances — people,
internal project and product codenames, exact chat channel ids, personal handles
— load at runtime from `LEAK_DENYLIST` or a gitignored `.leak-denylist.local`.
Generating a snapshot with only half the gate is how one of those reaches the
public site, so `npm run content` and `npm run sync` refuse to run without it.

Before step 2, confirm the private tier is available:

```bash
test -s .leak-denylist.local || echo "set LEAK_DENYLIST instead"
```

Every scanner run prints which tier it used. Read that line — do not assume it:

```
[leak-check] private denylist: 8 tokens loaded
[leak-check] WARNING: no private denylist loaded — generic patterns only
```

A run that printed the WARNING has not validated the refresh. `LEAK_DENYLIST_OPTIONAL=1`
suppresses the failure and is not appropriate for a sync — it exists for
debugging. **Never** write a specific person, codename, handle, or channel id
into a committed file to make the gate see it.

## Procedure

### 1. Fetch the latest sources

With local checkouts:

```bash
git -C "$APEX_REPO_PATH" fetch origin
git -C "$APEX_COMPANION_REPO_PATH" fetch origin
```

The pipeline reads `origin/main` (override with `APEX_REF`), so no checkout needs
to be on any particular branch and nothing needs to be pulled.

Without local checkouts, export `GITHUB_TOKEN` instead — the pipeline clones both
repositories into temporary directories with full history, which the commit and
contributor counts require.

Record the source SHAs; step 5 needs the previous snapshot's date.

```bash
git -C "$APEX_REPO_PATH" rev-parse origin/main
```

### 2. Regenerate

```bash
npm run content
```

Read the log. It names every file it rendered and every schema field it redacted.
A file you did not expect, or a redaction that stopped firing, is a finding.

### 3. Run the leak gate

```bash
npm run leak-check
```

Must print `clean`. If it does not, stop and fix — see the rules above. A finding
is one of three kinds:

- **`private-denylist`** — a person, an internal codename, an exact chat channel
  id, or a personal handle. The finding is redacted in the log by design; find
  it by searching the generated file for the token from your local denylist. Add
  or repair a strip rule in `content.config.ts`.
- **a generic-pattern rule** (`company-host`, `issue-tracker-host`, `chat-host`,
  `artifact-host`, `chat-channel-id`, `org-handle`) — the matched text is shown.
  Add or repair a strip rule in `content.config.ts`.
- **`ticket-key`** — something shaped like a tracker key. Decide whether it is a
  real ticket (strip it) or APEX's own artifact-ID vocabulary (vet it and add it
  to `ALLOWED_TICKET_TOKENS` with a comment).
- **`product-path`** — a concrete `products/<domain>/<product>/…` path. Replace it
  with the path template.

### 4. Review the diff and summarize it

```bash
git diff --stat src/generated/
git diff src/generated/stats.json
```

Report, in the pull request body:

- **New or removed artifact types** — `schema-types.json` changed. The
  republished schema in `public/schema/` changed with it; confirm the redaction
  still applied.
- **Statistic deltas** — commits, artifacts, initiatives, contributors. Large or
  implausible jumps mean the pipeline read a different ref than intended.
- **New CI workflows** — `tooling.json` `workflows[]` grew.
- **New skills** — `tooling.json` `skills[]` grew. A skill with no category
  produces a build warning; add it to `SKILL_CATEGORIES` in
  `scripts/build-content.ts`.
- **Changed documents** — a large `docs.json` diff usually means a spec was
  rewritten upstream. Skim the rendered page before shipping it.

### 5. Check the authored copy for stale facts

`content/*.md` is hand-written and states facts that can go stale. Nothing here
is auto-written — the step produces a list for a human.

Find candidate framework changes since the previous snapshot's `generatedAt`:

```bash
git -C "$APEX_REPO_PATH" log origin/main \
  --since=<previous generatedAt> --format='%ad %s' --date=short -- \
  schemas/ docs/spec/ .github/workflows/ packages/apex-tools/
```

Then check each authored page against it:

- **`content/history.md`** — the milestone table. **Never auto-write a
  milestone.** List the candidate commits for the human to judge; a milestone is
  an editorial decision about significance, not a log entry. Every existing row
  was verified against the commit log and must stay that way.
- **`content/tooling.md`** — CLI commands, validation passes, the retired list.
  A new `add_parser` in the CLI or a new validation pass belongs here.
- **`content/how-its-used.md`** — the review-tier table and branch prefixes. A
  change to the tier classifier or the prefix table upstream lands here.
- **`content/compare.md`** — restate a comparator's capability only when it has
  actually changed. These claims are checkable by a reader; do not let them rot.
- **`content/home.md`** — mostly `{{stats.*}}` placeholders, which update
  themselves.

Statistics in the copy are placeholders (`{{stats.commits}}`) and need no edit. A
placeholder naming a key the pipeline no longer emits fails the build, which is
the intended behaviour.

### 6. Verify

```bash
npm test && npm run build
```

`build` re-runs the leak gate against `dist/`, which is the last check before the
bundle ships. Both must pass. Do not commit on a red gate.

### 7. Commit and open the pull request

```bash
git checkout -b content/sync-$(date +%Y%m%d)
git add src/generated public/schema content
git commit
gh pr create
```

The commit message and pull request body carry the step-4 summary. Use a
conventional commit:

```
content: sync from APEX <short-sha>

- stats: commits 1401 → 1428, artifacts 3463 → 3491
- schema: no type changes
- tooling: +1 workflow (…)
- authored copy: no stale facts found
```

Commit `src/generated/` and `public/schema/frontmatter.schema.json` together —
they are one snapshot, and splitting them leaves the schema page describing a
schema the site does not serve.

## Shortcut

`npm run sync` runs steps 2, 3, and 6 in order. Steps 1, 4, 5, and 7 need
judgment and stay manual.
