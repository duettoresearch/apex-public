/**
 * Why: The header and footer carried a hand-inlined copy of the retired
 * lowercase wordmark — geometry transcribed from an old export, with the
 * chevron glyph the brand no longer uses. It had drifted from current Duetto
 * branding, and a transcribed path set drifts again on the next rebrand.
 * What: The current white Duetto lockup (unicorn mark plus wordmark) as a
 * single asset under `public/`, referenced by path. Serving the real brand file
 * means a future rebrand is a file swap, not a path-data edit.
 * Test: `npm run build` (the asset is copied into `dist/` and the reference
 * resolves), `npm run leak-check` (the OCR pass reads `public/`)
 *
 * The asset is white-only, so every call site must sit on a dark ground. Both
 * do: `.mkt-header` paints `--bg-header` and `.mkt-footer` paints
 * `--bg-dark-ink`. A light-background caller would need its own dark panel —
 * there is no dark variant of this file.
 */

import type { ReactNode } from 'react';

/** Intrinsic pixel size of `public/duetto-logo-white.webp`, for aspect ratio. */
const INTRINSIC_WIDTH = 600;
const INTRINSIC_HEIGHT = 129;

/**
 * The Duetto lockup at a caller-supplied class.
 *
 * `alt=""` because every call site already labels the link it sits in;
 * announcing "Duetto" twice would be the only effect of alt text here.
 */
export function DuettoLogo({ className }: { className: string }): ReactNode {
  return (
    <img
      className={className}
      src="/duetto-logo-white.webp"
      width={INTRINSIC_WIDTH}
      height={INTRINSIC_HEIGHT}
      alt=""
      decoding="async"
    />
  );
}
