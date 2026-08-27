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
