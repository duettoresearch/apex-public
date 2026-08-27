# apex-public

The public marketing site for **APEX** (AI Product Execution), Duetto's git-native
product development framework. Target domain: `apex.duetto.ai`.

Public, no authentication, information only. It exists to explain what APEX is to
people outside the company.

## How it works

APEX itself lives in a **private** repository. This site never reads that
repository at request time and never links into it. Instead, a build-time
pipeline reads a fixed allowlist of source files, sanitizes them, and writes a
JSON snapshot into `src/generated/`.

**That snapshot is committed.** `npm run dev` and `npm run build` work with no
credentials and no access to the private repo — which is what lets the site build
on Vercel.

```
duettoresearch/APEX ──▶ scripts/build-content.ts ──▶ src/generated/*.json ──▶ Vite ──▶ dist/
   (allowlist only)          (sanitize)                  (committed)
                                  │
                                  └──▶ scripts/leak-check.ts  (fails the build on a leak)
```

## Commands

| Command              | What it does                                                                   |
| -------------------- | ------------------------------------------------------------------------------ |
| `npm run dev`        | Vite dev server against the committed snapshot                                 |
| `npm run build`      | Refresh content if a source is configured, typecheck, build, then scan `dist/` |
| `npm run content`    | Regenerate `src/generated/` from a configured APEX source                      |
| `npm run leak-check` | Scan `src/generated/` and `public/` for forbidden strings                      |
| `npm run sync`       | `content` → `leak-check` → `test` → `build`                                    |
| `npm test`           | Vitest, including the leak gate                                                |
| `npm run lint`       | ESLint + Prettier check                                                        |
| `npm run typecheck`  | `tsc -b` over the app and the scripts                                          |
| `npm run format`     | Prettier write                                                                 |

## Environment

None of these are needed to run or build the site. They are needed only to
_refresh_ the content snapshot — and a refresh additionally requires the private
leak-gate denylist, see [The leak gate](#the-leak-gate).

| Variable                   | Purpose                                                              |
| -------------------------- | -------------------------------------------------------------------- |
| `APEX_REPO_PATH`           | Absolute path to a local checkout of `duettoresearch/APEX`           |
| `APEX_REF`                 | Git ref to read that checkout at. Defaults to `origin/main`          |
| `APEX_COMPANION_REPO_PATH` | Absolute path to a local checkout of `duettoresearch/apex-companion` |
| `GITHUB_TOKEN`             | Fallback: the pipeline clones both repositories itself               |
| `NODE_AUTH_TOKEN`          | Only for installing the design system from GitHub Packages           |
| `LEAK_DENYLIST`            | Private leak-gate tokens, newline- or comma-separated                |
| `LEAK_DENYLIST_FILE`       | Path to the private token file. Default `.leak-denylist.local`       |
| `LEAK_DENYLIST_OPTIONAL`   | `1` generates without the private tier. Know what you lose           |

Reading from a local checkout uses an explicit git ref rather than the working
tree, so a stale or feature-branch `HEAD` cannot change the output.

```bash
APEX_REPO_PATH=~/repos/APEX \
APEX_COMPANION_REPO_PATH=~/repos/apex-companion \
npm run content
```

## The leak gate

The APEX repository contains customer names, employee names, internal hostnames,
and live ticket keys. Two mechanisms keep them out:

1. **The allowlist** (`content.config.ts`) — the pipeline reads a file's body if
   and only if it is listed there. Whole trees (`products/`, `proposals/`,
   `policies/`, `guides/`, `wiki/`, `docs/decisions/`, `teams/`, `guilds/`,
   `meetings/`, `archive/`) are unreachable to the build. `products/` is
   aggregate-counted only: directory and file counts, never a body.

2. **The leak gate** (`scripts/leak-check.ts`) — scans _finished output_ for
   forbidden literals, ticket-shaped keys outside a vetted allowlist, and
   concrete product paths. It runs standalone, inside `npm run build` against
   `dist/`, and as a Vitest suite so `npm test` fails on a leak too.

The gate scans output rather than input on purpose: a strip rule that stops
matching after an upstream rewrite fails silently, and the gate does not.

If the gate fires, **do not** widen the allowlist to make it pass. Either add a
strip rule that removes the leak at its source, or vet the token and add it to
`ALLOWED_TICKET_TOKENS` with a comment saying why it is safe.

## Design system

The site is styled with `@duettoresearch/marketing-ds` — a CSS-only marketing
design system (`.mkt-*` classes plus CSS custom properties).

**It is currently vendored, not installed.** The package is not published to
GitHub Packages; the files under `src/vendor/marketing-ds/` are a build output of
`duettoresearch/internal-tools-ds`. See
[`src/vendor/marketing-ds/README.md`](src/vendor/marketing-ds/README.md) for the
source commit and the steps to swap in the real package once it ships.

`.npmrc` already points the `@duettoresearch` scope at GitHub Packages. When the
package exists, install it with a token that has `read:packages`:

```bash
NODE_AUTH_TOKEN=$(gh auth token) npm install
```

`src/styles/site.css` adds what the design system does not cover — long-form
prose typography and responsive behaviour — using only design-system tokens. It
declares no color literal, so the palette has exactly one definition. The
functional/interactive color is teal (`--dt-teal`); chartreuse (`--dt-lucent`) is
brand and hero only, never a focus ring or a link.

## Deploying to Vercel

| Setting          | Value           |
| ---------------- | --------------- |
| Framework preset | Vite            |
| Build command    | `npm run build` |
| Output directory | `dist`          |
| Install command  | `npm install`   |
| Node version     | 20+             |

`vercel.json` rewrites every path to `/index.html` so the browser-history router
handles deep links.

Environment variables are **optional**. Set `GITHUB_TOKEN` (and `NODE_AUTH_TOKEN`
once the design system is published) only if you want the deployment to refresh
content from the private repository rather than build the committed snapshot.
Leaving them unset is the safer default: the build then cannot reach the private
repository at all.

## Refreshing content

Use the [`apex-public-sync`](.claude/skills/apex-public-sync/SKILL.md) skill. It
fetches both source repositories, regenerates, runs the leak gate, summarizes what
changed, flags authored copy whose facts have gone stale, and opens a pull request.

## Layout

```
content/              Authored marketing copy (committed, rendered by the pipeline)
public/               Logos and the redacted, republished frontmatter schema
scripts/
  build-content.ts    The pipeline
  leak-check.ts       The leak gate
  lib/                Source access, markdown rendering, schema parsing, stats
src/
  generated/          The committed content snapshot — regenerated, never hand-edited
  vendor/             Vendored design system + its provenance record
  components/         Site chrome
  pages/              Route components
  lib/content.ts      Typed accessors over the snapshot
  styles/site.css     The site layer over the design system
  tests/              The leak gate as a test
content.config.ts     The source allowlist and its strip rules
```

## Operating this site

Everything from here down is what a maintainer needs after handoff.

### The two workflows

| Workflow          | File                                    | Trigger                                  | Needs   |
| ----------------- | --------------------------------------- | ---------------------------------------- | ------- |
| `ci`              | `.github/workflows/ci.yml`              | every pull request, every push to `main` | nothing |
| `content-refresh` | `.github/workflows/content-refresh.yml` | Mondays 06:00 UTC, or **Run workflow**   | secrets |

`ci` runs `npm ci`, `npm run lint`, `npm run typecheck`, `npm test`, and
`npm run build` on Node 20 — the same five commands you run locally. The build
ends in the leak scan over `dist/`, so a leak fails the check. The job is named
`ci` because branch protection requires that exact check name.

`content-refresh` clones both private sources with a read-only token,
regenerates `src/generated/` and `public/schema/`, runs the gate, the tests and
the build, then opens or updates one pull request on the branch
`content/auto-refresh`. When the snapshot did not change it logs
`no content changes` and stops — nothing in `src/generated/` records when the
run happened, so a week in which APEX did not move produces no pull request at
all. The site states its own freshness from a build-time constant instead
(`VITE_BUILD_TIME`, defined in `vite.config.ts`).

### The secrets the refresh needs

Add them under **Settings → Secrets and variables → Actions → New repository
secret**. Until they exist, `content-refresh` fails on its first step and names
what is missing.

A read credential for the two private sources, either form:

| Secret                                 | What it is                                      | Scope                                                                                                                                                                                                                                                                 |
| -------------------------------------- | ----------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `APEX_APP_ID` + `APEX_APP_PRIVATE_KEY` | A GitHub App — preferred                        | Installed on `duettoresearch/APEX` and `duettoresearch/apex-companion` with **Contents: read**, and on this repository with **Contents: write** and **Pull requests: write** — the same token opens the pull request. The workflow mints a short-lived token per run. |
| `APEX_READ_TOKEN`                      | A fine-grained personal access token — fallback | Repository access limited to the same two repositories; permission **Contents: read**. Nothing else.                                                                                                                                                                  |

Prefer the app: its token expires when the run ends and it belongs to no
person. The workflow uses the app pair when both secrets are set and falls back
to `APEX_READ_TOKEN` otherwise, and logs which one it used.

And the denylist, required either way:

| Secret          | What it is                            | Scope                                                                                                                                                                                                                |
| --------------- | ------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `LEAK_DENYLIST` | The private half of the leak denylist | Not a credential — the token list itself, newline- or comma-separated. Paste a local `.leak-denylist.local` verbatim: blank lines and `#` comments are dropped from both forms, so both report the same token count. |

`npm run content` refuses to run when `LEAK_DENYLIST` is empty, and the workflow
never sets `LEAK_DENYLIST_OPTIONAL`. That refusal is the safeguard: a snapshot
generated with the generic patterns alone is how a name reaches the site.

The refresh also passes the resolved credential to the content step as
`GH_TOKEN`, so the pipeline can read the merged-pull-request count. An app token
qualifies when the app has **Pull requests: read** or **Contents: read**. If the
count comes back empty the pipeline omits that one statistic rather than
guessing it, and its tile disappears from `/stats`.

### Reviewing a refresh pull request

1. Read the `src/generated/` diff. Numbers moving is expected. A new document
   body, a new path, or a name appearing anywhere in it is not — treat that as a
   gate failure and fix it with a strip rule in `content.config.ts`.
2. Open the workflow run and find the `[leak-check]` lines. The first one names
   the tier that ran. It must report tokens loaded, not `WARNING`.
3. Check the authored copy under `content/` against any number that moved. The
   pipeline updates the statistics; it does not update prose that quotes them.
4. Merge. Vercel deploys `main`.

`ci` runs on a refresh pull request like on any other, because the app token
opens it. A pull request opened with the default `GITHUB_TOKEN` starts no other
workflow, so the refresh branch would carry no `ci` check and could never
satisfy the required check.

That limitation still stands on a `APEX_READ_TOKEN`-only setup: the app is what
opens the pull request, and without it the workflow falls back to
`GITHUB_TOKEN`, logs a warning saying so, and the fallback is to close and
reopen the pull request — which starts `ci` on the branch.

### Running a refresh locally

You need checkouts of both private repositories and the private denylist.

```bash
cp .env.example .env                 # then fill in the two *_REPO_PATH values
printf '%s\n' token-one token-two > .leak-denylist.local   # gitignored
npm run sync                         # content → leak-check → test → build
```

`npm run sync` is the local equivalent of the workflow. Read the
`[leak-check] private denylist: N tokens loaded` line before trusting the run.

### Rotating the read credential

A GitHub App has nothing to rotate on a schedule — its per-run token expires by
itself. Rotate its private key only when you have reason to: generate a new key
on the app, update `APEX_APP_PRIVATE_KEY`, then run `content-refresh` with
**Run workflow** and delete the old key once the run is green.

For the `APEX_READ_TOKEN` fallback:

1. Mint a replacement fine-grained token with the same two repositories and
   **Contents: read**, and an expiry you will actually remember.
2. Update the `APEX_READ_TOKEN` repository secret with the new value.
3. Run `content-refresh` from the Actions tab with **Run workflow**. A green run
   proves the new token works. The first log line of the resolve step names
   which credential the run used.
4. Revoke the old token.

Do the replacement before the revocation. A revoked token makes the clone step
fail, and the failure looks identical to the secret being absent.

### Swapping the vendored design system for the package

`src/vendor/marketing-ds/` is a copy, not a dependency, because
`@duettoresearch/marketing-ds` is not published yet.
[`src/vendor/marketing-ds/README.md`](src/vendor/marketing-ds/README.md) records
the source commit and the exact swap steps. `.npmrc` already points the
`@duettoresearch` scope at GitHub Packages, so the short version is: install with
a `read:packages` token, change the two imports in `src/main.tsx`, delete the
vendored directory, then run the five commands.

### Adding a page

1. Export a component from `src/pages/routes.tsx`.
2. Add its `<Route>` to the table in `src/App.tsx`.
3. Add it to `NAV` in `src/components/Layout.tsx` if it belongs in the header.
4. Style it with `.mkt-*` classes and design-system tokens. Do not add a color
   literal to `src/styles/site.css` — the palette has exactly one definition.

A page that renders APEX content reads it through `src/lib/content.ts`, never by
importing `src/generated/*.json` directly. Publishing a document that is not yet
in the snapshot means adding it to `ALLOWLIST` in `content.config.ts` with its
strip rules, then regenerating.

### What the leak gate covers, and what it does not

It covers the text of `src/generated/`, `public/`, and `dist/`: the generic shape
patterns in `scripts/lib/forbidden.ts`, the private token list, ticket-shaped
keys outside a vetted allowlist, and concrete product paths. It also reads the
images in `public/` with Tesseract and reports any word it can make out.

It does not cover:

- **Images, reliably.** The OCR pass warns; it never fails the build, and it
  skips itself where Tesseract is not installed, saying so in its output. A name
  legible in a PNG can therefore still ship. The real defence for a picture is
  `scripts/prepare-hero-graph.ts`, which destroys the label pixels and refuses
  to write a file while OCR can still read one. Read every image before
  committing it; that is the second checkbox on the pull request template.
- **Authored prose.** Anything you write in `content/`, in a route file, or in
  this README is scanned for the same patterns only once it reaches
  `src/generated/` or `dist/`. Prose that describes an internal thing in words
  the patterns do not match passes the gate and still discloses it.
- **Fonts and other non-text assets**, by the same reasoning as images.
- **Judgement.** The gate catches shapes. Whether a number, a count, or a
  paraphrase is safe to publish is a decision only a person makes.

### Vercel

| Fact                  | Value                                                |
| --------------------- | ---------------------------------------------------- |
| Team                  | `duetto`                                             |
| Project               | `apex-public`                                        |
| Production domain     | `apex.duetto.ai`                                     |
| Deployment protection | **Off, deliberately** — the site is public by design |
| Build command         | `npm run build`                                      |
| Output directory      | `dist`                                               |

Deployment protection stays off. Turning it on puts an authentication wall in
front of a site whose entire purpose is to be readable by people outside the
company. It is not a leak control; the leak gate is.

Set no environment variables on the Vercel project. With none set, the build
cannot reach the private repositories at all — it renders the committed
snapshot, which is the safe default and the reason the snapshot is committed.

### Branch rule

`main` takes pull requests only. The required check is `ci`. `.github/CODEOWNERS`
assigns every path to `@duettoresearch/technical-services`; a personal handle
must never appear there, because a personal code-host handle is one of the
categories the gate exists to keep out of a public repository.
