# Vendored `@duettoresearch/marketing-ds`

These files are a build output of the Duetto marketing design system, copied in
rather than installed.

## Why vendored

The package is not published to GitHub Packages. Installing
`@duettoresearch/marketing-ds` from `https://npm.pkg.github.com` returns:

```
npm error 404 Not Found - GET https://npm.pkg.github.com/@duettoresearch%2fmarketing-ds
npm error 404  npm package "marketing-ds" does not exist under owner "duettoresearch"
```

That is a publishing gap, not an authentication one — the token used had
`read:packages` through `repo` scope and the same registry resolves other
`@duettoresearch` packages.

## Provenance

| | |
|---|---|
| Source repository | `duettoresearch/internal-tools-ds` |
| Path in that repository | `packages/marketing-ds` |
| Commit | `ad81396096c97ac40351436eff4d7e08e95e96c4` |
| Commit date | 2026-07-12 |
| Package version | `0.1.0` |
| Built with | `npm install` in `packages/marketing-ds` (its `prepare` script runs `scripts/build.mjs`) |
| Copied | 2026-08-27 |

## What is here

| File | Origin |
|---|---|
| `bundle.css` | `dist/bundle.css` — fonts, `@duettoresearch/core` brand primitives, tokens, and the `.mkt-*` components, concatenated and minified |
| `tokens.json` | `dist/tokens.json` — the token values for both brand variants, kept for reference |
| `fonts/Sora-VariableFont_wght.ttf` | `dist/fonts/` — self-hosted, referenced by a relative `url()` inside `bundle.css` |

## Replacing this with the real package

Once `@duettoresearch/marketing-ds` is published:

1. `npm install @duettoresearch/marketing-ds` with `NODE_AUTH_TOKEN` set (the
   repository's `.npmrc` already points the `@duettoresearch` scope at GitHub
   Packages).
2. In `src/main.tsx`, change the stylesheet import from
   `./vendor/marketing-ds/bundle.css` to `@duettoresearch/marketing-ds/bundle.css`.
3. Delete this directory.

No other change is needed: the site uses the design system through its `.mkt-*`
classes and CSS custom properties, never through a JavaScript import.
