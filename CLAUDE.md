# apex-public

The public marketing site for APEX (AI Product Execution), Duetto's git-native
product development framework. Deploys to `apex.duetto.ai`. Vite + React SPA, no
authentication, no backend, no runtime data fetching — every page renders from a
JSON snapshot committed under `src/generated/`.

## Hard rules

These are not style preferences. APEX lives in a **private** repository holding
customer names, employee names, internal hostnames, and live ticket keys.

1. **Content is read only from the allowlist in `content.config.ts`.** The
   pipeline reads a file's body if and only if that file is listed there. To
   publish a new document, add it to `ALLOWLIST` with its strip rules — never by
   widening a read path.

2. **Never read `products/`, `proposals/`, `policies/`, `guides/`, `wiki/`,
   `docs/decisions/`, `teams/`, `guilds/`, `meetings/`, or `archive/`.** They are
   listed in `NEVER_READ_TREES` and the source layer throws on any attempt.
   `products/` is aggregate-counted only — directory and file counts from the
   tree listing, never a body, never a name.

3. **The leak gate must pass before any commit.** Run `npm run leak-check`. It
   scans finished output for the generic patterns, the private denylist,
   ticket-shaped keys outside a vetted allowlist, and concrete product paths. If
   it fires, fix the leak at its source with a strip rule — do not silence the
   gate. Adding a token to `ALLOWED_TICKET_TOKENS` requires vetting it and
   saying in a comment why it is safe.

4. **This repository is public, so the denylist is split in two.** Generic SHAPE
   patterns live in `scripts/lib/forbidden.ts` and are committed, because a
   shape discloses nothing. The specific instances load at runtime from
   `LEAK_DENYLIST` or a gitignored `.leak-denylist.local`, and must never be
   committed anywhere — not in the scanner, not in a test fixture, not in this
   file. Writing the list down in the repository publishes exactly what it
   exists to suppress.

   **A content refresh is not valid unless the private denylist is loaded.**
   `npm run content` and `npm run sync` fail without it (override:
   `LEAK_DENYLIST_OPTIONAL=1`, which you should understand before using).
   `npm test` and `npm run build` run on generic patterns alone, which is
   correct — they validate a snapshot generated on a machine that had the full
   list. The scanner always prints which tier it ran with; read that line.

5. **Categories that must never reach published output.** Internal hostnames,
   chat channel ids, personal code-host handles, people's names, internal
   project or product codenames, links into the private source repositories
   (such a link is both a 404 and a disclosure), and live ticket keys. When you
   write documentation about this rule, name the CATEGORY — never an instance.

6. **`src/generated/` is generated.** Never hand-edit it. Run `npm run content`.

## Commands

| Command              | What it does                                                  |
| -------------------- | ------------------------------------------------------------- |
| `npm run dev`        | Dev server against the committed snapshot                     |
| `npm run build`      | Refresh content if configured, typecheck, build, scan `dist/` |
| `npm run content`    | Regenerate `src/generated/` from a configured APEX source     |
| `npm run sync`       | `content` → `leak-check` → `test` → `build`                   |
| `npm run leak-check` | Scan `src/generated/` and `public/`                           |
| `npm test`           | Vitest, including the leak gate                               |
| `npm run lint`       | ESLint + Prettier check                                       |
| `npm run typecheck`  | `tsc -b`                                                      |

## Environment

All optional — the site builds from the committed snapshot with none of them set.

- `APEX_REPO_PATH` — local checkout of `duettoresearch/APEX`
- `APEX_REF` — ref to read it at, default `origin/main`
- `APEX_COMPANION_REPO_PATH` — local checkout of `duettoresearch/apex-companion`
- `GITHUB_TOKEN` — fallback; the pipeline clones both repositories itself
- `NODE_AUTH_TOKEN` — only for installing the design system from GitHub Packages

Required for `npm run content` and `npm run sync`:

- `LEAK_DENYLIST` — the private tokens, newline- or comma-separated, **or** a
  gitignored `.leak-denylist.local` at the repo root, one token per line. Both
  are merged. `LEAK_DENYLIST_FILE` overrides the file path.

## Design system

`@duettoresearch/marketing-ds` — CSS only, `.mkt-*` classes plus tokens. It is
**vendored** at `src/vendor/marketing-ds/` because the package is not published;
that directory's README records the source commit and how to swap in the real
package. `.npmrc` already scopes `@duettoresearch` to GitHub Packages, so once it
is published, `NODE_AUTH_TOKEN=$(gh auth token) npm install` is enough.

Use design-system classes and tokens. Do not introduce a parallel palette:
`src/styles/site.css` declares no color literal. Teal (`--dt-teal`) is the
functional/interactive color; chartreuse (`--dt-lucent`) is brand and hero only,
never a focus ring, link, or state indicator.

## Refreshing content

Follow [`.claude/skills/apex-public-sync/SKILL.md`](.claude/skills/apex-public-sync/SKILL.md).
It covers fetching both sources, regenerating, running the gate, reading the diff,
deciding which authored copy has gone stale, and opening the pull request.

## Automation

Two workflows run this repository. `.github/workflows/ci.yml` runs lint,
typecheck, test, and build on every pull request and every push to `main`; its
job is named `ci` because branch protection requires that exact check name, and
its build step ends in the leak scan over `dist/`. `.github/workflows/content-refresh.yml`
runs Mondays at 06:00 UTC and on demand: it clones both private sources, runs
`npm run content`, the gate, the tests and the build, then opens or updates one
pull request on `content/auto-refresh`. It needs two repository secrets,
`APEX_READ_TOKEN` (fine-grained, Contents: read on the two source repositories)
and `LEAK_DENYLIST` (the private token list), and fails on its first step naming
whichever is missing. It never sets `LEAK_DENYLIST_OPTIONAL` — a snapshot
generated without the private denylist is the failure this whole design prevents.
Dependabot proposes grouped npm and actions updates weekly. Operating details,
including how to review a refresh pull request and how to rotate the token, are
in the README under "Operating this site".
