/**
 * Why: Every page needs the same header, footer, and prose treatment, and the
 * header is the only interactive element on the site. Keeping all of it here
 * means a route file contains content and nothing else.
 * What: The site chrome (nav, footer), plus the two primitives every content
 * route uses — a sanitized HTML block and a document page with its table of
 * contents.
 * Test: `npm run build` (the routes are static; there is no runtime data path)
 */

import { useState, type ReactNode } from 'react';
import { Link, NavLink } from 'react-router-dom';
import type { Doc, TocEntry } from '../lib/content.ts';

const NAV: readonly { to: string; label: string }[] = [
  { to: '/how-it-works', label: 'How it works' },
  { to: '/schema', label: 'Schema' },
  { to: '/tooling', label: 'Tooling' },
  { to: '/compare', label: 'Compared' },
  { to: '/stats', label: 'Statistics' },
  { to: '/history', label: 'History' },
];

export function Header(): ReactNode {
  const [open, setOpen] = useState(false);

  return (
    <header className="mkt-header">
      <div className="mkt-header__left">
        <Link to="/" aria-label="APEX home">
          <img className="site-logo" src="/duetto-logo_blk.svg" alt="Duetto" />
          <span className="site-wordmark">APEX</span>
        </Link>
      </div>

      <button
        className="site-nav-toggle"
        type="button"
        aria-expanded={open}
        aria-controls="site-nav"
        onClick={() => setOpen((v) => !v)}
      >
        Menu
      </button>

      <nav className="mkt-nav" id="site-nav" data-open={open} aria-label="Primary">
        {NAV.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className="mkt-nav__link"
            onClick={() => setOpen(false)}
          >
            {item.label}
          </NavLink>
        ))}
      </nav>
    </header>
  );
}

export function Footer(): ReactNode {
  return (
    <footer className="mkt-footer">
      <div className="site-footer__inner">
        <div>
          <img className="site-footer__logo" src="/duetto-logo_blk.svg" alt="Duetto" />
          <p className="site-footer__note">
            © Duetto. APEX is an internal product development framework.
          </p>
        </div>
        <div className="site-footer__links">
          <Link to="/">Home</Link>
          <Link to="/how-it-works">How it works</Link>
          <Link to="/schema">Schema</Link>
          <Link to="/tooling">Tooling</Link>
          <a href="https://duetto.com" target="_blank" rel="noreferrer noopener">
            duetto.com
          </a>
        </div>
      </div>
    </footer>
  );
}

/**
 * Renders pipeline output as HTML.
 *
 * The string was sanitized at build time by `rehype-sanitize` and then scanned
 * by the leak gate, and no user input reaches this component — the site has no
 * inputs. Both facts are what make `dangerouslySetInnerHTML` correct here.
 */
export function Prose({ html }: { html: string }): ReactNode {
  return <div className="prose" dangerouslySetInnerHTML={{ __html: html }} />;
}

function Toc({ entries }: { entries: readonly TocEntry[] }): ReactNode {
  if (entries.length < 3) return null;
  return (
    <nav className="doc-toc" aria-label="On this page">
      <div className="doc-toc__heading">On this page</div>
      <ol>
        {entries.map((e) => (
          <li key={e.id} data-depth={e.depth}>
            <a href={`#${e.id}`}>{e.text}</a>
          </li>
        ))}
      </ol>
    </nav>
  );
}

/** A content page with a heading, optional lead, and body. */
export function Page({
  title,
  lead,
  children,
}: {
  title: string;
  lead?: string;
  children: ReactNode;
}): ReactNode {
  return (
    <section className="site-section">
      <div className="site-inner">
        <h1 className="mkt-h1" style={{ margin: '0 0 var(--space-4)' }}>
          {title}
        </h1>
        {lead ? (
          <p
            className="site-measure"
            style={{ color: 'var(--fg-secondary)', fontSize: 'var(--fs-page-body)' }}
          >
            {lead}
          </p>
        ) : null}
        <div style={{ marginTop: 'var(--space-7)' }}>{children}</div>
      </div>
    </section>
  );
}

/** A full document rendered beside its table of contents. */
export function DocPage({ doc, note }: { doc: Doc; note?: ReactNode }): ReactNode {
  return (
    <section className="site-section">
      <div className="site-inner doc-layout">
        <article>
          <Prose html={doc.html} />
          {note ? <div className="doc-source">{note}</div> : null}
        </article>
        <Toc entries={doc.toc} />
      </div>
    </section>
  );
}
