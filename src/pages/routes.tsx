/**
 * Why: Every route on this site renders content the build already produced, so
 * the routes are thin. Keeping them in one file makes the whole site surface
 * readable at once.
 * What: The eight page components behind the site's routes.
 * Test: `npm run build`
 */

import { type ReactNode } from 'react';
import { Link, useParams } from 'react-router-dom';
import { DocPage, Page, Prose } from '../components/Layout.tsx';
import {
  BUILD_DATE,
  docs,
  doc,
  num,
  page,
  schemaTypes,
  stats,
  tooling,
} from '../lib/content.ts';

/* ---------------------------------------------------------------- Home -- */

export function Home(): ReactNode {
  const home = page('home');

  return (
    <>
      <section className="mkt-hero-band">
        {/* Above the fold, so it loads eagerly and index.html preloads it. The
            graph is decoration — its labels were destroyed by
            scripts/prepare-hero-graph.ts and it carries no information a reader
            needs — so it is hidden from assistive technology. */}
        <img
          className="site-hero-graph"
          src="/hero-graph.webp"
          alt=""
          aria-hidden="true"
          loading="eager"
          decoding="async"
        />
        <div className="site-hero-scrim" aria-hidden="true" />
        <div className="mkt-hero-band__inner site-inner">
          <div className="mkt-hero-band__eyebrow">AI Product Execution</div>
          <h1 className="mkt-hero-band__title">Product management, as code.</h1>
          <p className="mkt-hero-band__lead">
            A git-native product development framework. {stats.artifactTypes} schema-validated
            artifact types, status lifecycles enforced in CI, tiered review with auto-merge for
            low-risk changes, and AI agents contributing through the same pull requests as
            everyone else.
          </p>
          <div className="mkt-hero-band__actions">
            <Link className="mkt-btn mkt-btn--primary" to="/how-it-works">
              How it works
            </Link>
            <Link className="mkt-btn mkt-btn--outline" to="/schema">
              The schema
            </Link>
          </div>
          <p className="site-hero-note">
            Running on itself since {stats.firstCommitDate} — {num(stats.commits)} commits,{' '}
            {num(stats.artifactsTotal)} typed artifacts.
          </p>
        </div>
      </section>

      <section className="site-section">
        <div className="site-inner site-measure">
          <Prose html={home.html} />
        </div>
      </section>
    </>
  );
}

/* -------------------------------------------------- Authored copy pages -- */

export function HowItWorks(): ReactNode {
  return (
    <Page
      title="How it works"
      lead="A piece of work enters as an idea and leaves as a retrospective. Every step is a file, a status change, and a pull request."
    >
      <div className="site-measure">
        <Prose html={page('how-its-used').html} />
      </div>
    </Page>
  );
}

export function History(): ReactNode {
  return (
    <Page
      title="History"
      lead="Dated milestones, each one read out of the commit log rather than recalled."
    >
      <div className="site-measure">
        <Prose html={page('history').html} />
      </div>
    </Page>
  );
}

export function Compare(): ReactNode {
  return (
    <Page
      title="Compared"
      lead="Where APEX sits next to Backstage, ADR tooling, RFC processes, docs-as-code, and product-management SaaS — including where each of them is stronger."
    >
      <Prose html={page('compare').html} />
    </Page>
  );
}

export function Tooling(): ReactNode {
  const t = tooling;

  return (
    <Page
      title="Tooling"
      lead="A command-line validator, a set of CI workflows, a library of skills, and a companion app that fronts the repository."
    >
      <div className="site-measure">
        <Prose html={page('tooling').html} />
      </div>

      <h2 className="mkt-h2" style={{ marginTop: 'var(--space-8)' }}>
        Skills by category
      </h2>
      <div className="site-scroll-x">
        <table className="site-table">
          <thead>
            <tr>
              <th>Category</th>
              <th>Skills</th>
            </tr>
          </thead>
          <tbody>
            {t.skillCategories.map((c) => (
              <tr key={c.category}>
                <td>{c.category}</td>
                <td>
                  {c.skills.map((s) => (
                    <code className="tag" key={s}>
                      /{s}
                    </code>
                  ))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 className="mkt-h2" style={{ marginTop: 'var(--space-8)' }}>
        CI workflows
      </h2>
      <div className="site-scroll-x">
        <table className="site-table">
          <thead>
            <tr>
              <th>File</th>
              <th>Name</th>
            </tr>
          </thead>
          <tbody>
            {t.workflows.map((w) => (
              <tr key={w.file}>
                <td>
                  <code>{w.file}</code>
                </td>
                <td>{w.name}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Page>
  );
}

/* -------------------------------------------------------------- Stats -- */

function StatTile({ value, label }: { value: string; label: string }): ReactNode {
  return (
    <div className="site-stat">
      <div className="site-stat__value">{value}</div>
      <div className="site-stat__label">{label}</div>
    </div>
  );
}

export function Stats(): ReactNode {
  const byType = Object.entries(stats.artifactsByType)
    .filter(([type]) => schemaTypes.some((t) => t.type === type))
    .sort((a, b) => b[1] - a[1]);

  const byStatus = Object.entries(stats.initiativesByStatus).sort((a, b) => b[1] - a[1]);

  return (
    <Page
      title="Statistics"
      lead="Every number here is computed from the repository when this site is built. Nothing is entered by hand."
    >
      <div className="site-stat-grid">
        <StatTile value={num(stats.artifactsTotal)} label="Typed artifacts" />
        <StatTile value={num(stats.initiatives)} label="Initiatives" />
        <StatTile value={num(stats.artifactTypes)} label="Artifact types in the schema" />
        <StatTile value={num(stats.trackedMarkdown)} label="Tracked markdown files" />
        <StatTile value={num(stats.commits)} label="Commits" />
        {stats.mergedPullRequests !== undefined ? (
          <StatTile value={num(stats.mergedPullRequests)} label="Merged pull requests" />
        ) : null}
        <StatTile value={num(stats.contributors)} label="Distinct commit authors" />
        <StatTile value={num(stats.daysActive)} label="Days active" />
        <StatTile value={num(stats.domains)} label="Domains" />
        <StatTile value={num(stats.products)} label="Products" />
        <StatTile value={num(stats.skills)} label="Skills" />
        <StatTile value={num(stats.workflows)} label="CI workflows" />
      </div>

      <h2 className="mkt-h2" style={{ marginTop: 'var(--space-8)' }}>
        Artifacts by type
      </h2>
      <p style={{ color: 'var(--fg-secondary)' }}>
        Counted by the <code>type:</code> field across every tracked markdown file.
      </p>
      <div className="site-scroll-x">
        <table className="site-table">
          <thead>
            <tr>
              <th>Type</th>
              <th>Count</th>
            </tr>
          </thead>
          <tbody>
            {byType.map(([type, count]) => (
              <tr key={type}>
                <td>
                  <code>{type}</code>
                </td>
                <td>{num(count)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 className="mkt-h2" style={{ marginTop: 'var(--space-8)' }}>
        Initiatives by status
      </h2>
      <div className="site-scroll-x">
        <table className="site-table">
          <thead>
            <tr>
              <th>Status</th>
              <th>Count</th>
            </tr>
          </thead>
          <tbody>
            {byStatus.map(([status, count]) => (
              <tr key={status}>
                <td>
                  <code>{status}</code>
                </td>
                <td>{num(count)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 className="mkt-h2" style={{ marginTop: 'var(--space-8)' }}>
        Standing records
      </h2>
      <div className="site-stat-grid">
        <StatTile value={num(stats.decisions)} label="Decision records" />
        <StatTile value={num(stats.proposals)} label="Open proposals" />
        <StatTile value={num(stats.templates)} label="Artifact templates" />
        {stats.companionMcpTools !== undefined ? (
          <StatTile value={num(stats.companionMcpTools)} label="MCP tools on the Companion" />
        ) : null}
      </div>

      <p
        style={{
          marginTop: 'var(--space-7)',
          color: 'var(--fg-secondary)',
          fontSize: 'var(--fs-body-sm)',
        }}
      >
        Snapshot of <code>{stats.sourceRef}</code>
        {BUILD_DATE ? `, built ${BUILD_DATE}` : ''}.
      </p>
    </Page>
  );
}

/* ------------------------------------------------------------- Schema -- */

function TypeDetail({ t }: { t: (typeof schemaTypes)[number] }): ReactNode {
  return (
    <div className="schema-type" id={`type-${t.type}`}>
      <h3 className="schema-type__name">{t.type}</h3>
      <p className="schema-type__desc">{t.description}</p>

      <dl className="schema-grid">
        <dt>ID pattern</dt>
        <dd>
          {t.idPattern ? (
            <code className="tag">{t.idPattern}</code>
          ) : (
            <span className="tag tag--muted">path-scoped</span>
          )}
        </dd>

        {t.pathTemplate ? (
          <>
            <dt>Location</dt>
            <dd>
              <code className="tag">{t.pathTemplate}</code>
            </dd>
          </>
        ) : null}

        {t.statuses.length > 0 ? (
          <>
            <dt>Status</dt>
            <dd>
              {t.statuses.map((s) => (
                <span
                  key={s}
                  className={`tag ${t.terminalStatuses.includes(s) ? 'tag--accent' : ''}`}
                >
                  {s}
                </span>
              ))}
            </dd>
          </>
        ) : null}

        <dt>Required</dt>
        <dd>
          {t.required.length > 0 ? (
            t.required.map((f) => (
              <span className="tag" key={f}>
                {f}
              </span>
            ))
          ) : (
            <span className="tag tag--muted">none</span>
          )}
        </dd>

        {t.linkage.length > 0 ? (
          <>
            <dt>Linkage</dt>
            <dd>
              {t.linkage.map((l) => (
                <span
                  className="tag"
                  key={l.field}
                  title={`${l.resolution} → ${l.targetType}`}
                >
                  {l.field} → {l.targetType}
                </span>
              ))}
            </dd>
          </>
        ) : null}
      </dl>
    </div>
  );
}

export function Schema(): ReactNode {
  return (
    <Page
      title="The artifact schema"
      lead={`Every APEX artifact is validated against one JSON Schema. It defines ${stats.artifactTypes} types, each with an ID pattern, a status lifecycle, a set of required fields, and the references it may make to other artifacts.`}
    >
      <p>
        <a className="mkt-btn mkt-btn--outline-light" href="/schema/frontmatter.schema.json">
          View the raw schema
        </a>
      </p>
      <p style={{ color: 'var(--fg-secondary)', fontSize: 'var(--fs-body-sm)' }}>
        One field is redacted in the published copy — the enum of internal product slugs.
        Everything else is verbatim.
      </p>

      <div className="site-scroll-x" style={{ marginTop: 'var(--space-7)' }}>
        <table className="site-table">
          <thead>
            <tr>
              <th>Type</th>
              <th>Purpose</th>
              <th>ID pattern</th>
              <th>Statuses</th>
            </tr>
          </thead>
          <tbody>
            {schemaTypes.map((t) => (
              <tr key={t.type}>
                <td>
                  <a href={`#type-${t.type}`}>
                    <code>{t.type}</code>
                  </a>
                </td>
                <td>{t.description}</td>
                <td>
                  {t.idPattern ? (
                    <code style={{ fontSize: '0.8em' }}>{t.idPattern}</code>
                  ) : (
                    <span style={{ color: 'var(--fg-muted)' }}>path-scoped</span>
                  )}
                </td>
                <td>{t.statuses.length > 0 ? t.statuses.length : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 className="mkt-h2" style={{ marginTop: 'var(--space-8)' }}>
        Per-type detail
      </h2>
      {schemaTypes.map((t) => (
        <TypeDetail key={t.type} t={t} />
      ))}
    </Page>
  );
}

/* --------------------------------------------------------------- Docs -- */

export function DocIndex(): ReactNode {
  return (
    <Page
      title="Specification"
      lead="The framework's own normative documentation, published as written. These are the documents the rest of this site summarizes."
    >
      <div className="site-card-grid">
        {docs.map((d) => (
          <Link className="site-card" key={d.slug} to={`/docs/${d.slug}`}>
            <div className="site-card__title">{d.title}</div>
            <div className="site-card__body">{d.blurb}</div>
          </Link>
        ))}
      </div>
    </Page>
  );
}

export function DocRoute(): ReactNode {
  const { slug } = useParams<{ slug: string }>();
  const found = slug ? doc(slug) : undefined;

  if (!found) return <NotFound />;

  return (
    <DocPage
      doc={found}
      note={
        <>
          Published from <code>{found.sourcePath}</code> in the APEX repository.{' '}
          <Link to="/docs">All documents</Link>
        </>
      }
    />
  );
}

export function NotFound(): ReactNode {
  return (
    <Page title="Not found" lead="That page does not exist on this site.">
      <p>
        <Link to="/">Back to the home page</Link>
      </p>
    </Page>
  );
}
