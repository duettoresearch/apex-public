/**
 * Why: The site is a static SPA served with a catch-all rewrite, so the router
 * owns every URL including the ones Vercel hands back as `/index.html`.
 * What: The route table, the scroll-restoration behaviour, and the page chrome.
 * Test: `npm run build`
 */

import { useEffect, type ReactNode } from 'react';
import { Route, Routes, useLocation } from 'react-router-dom';
import { Footer, Header } from './components/Layout.tsx';
import {
  Compare,
  DocIndex,
  DocRoute,
  History,
  Home,
  HowItWorks,
  NotFound,
  Schema,
  Stats,
  Tooling,
} from './pages/routes.tsx';

/**
 * A client-side navigation keeps the previous scroll position, which lands a
 * reader halfway down a page they have not read. Navigating to an anchor is the
 * one case where the browser's own behaviour is correct.
 */
function ScrollToTop(): null {
  const { pathname, hash } = useLocation();

  useEffect(() => {
    if (hash) return;
    window.scrollTo(0, 0);
  }, [pathname, hash]);

  return null;
}

export default function App(): ReactNode {
  return (
    <>
      <a className="site-skip" href="#main">
        Skip to content
      </a>
      <ScrollToTop />
      <Header />
      <main id="main">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/how-it-works" element={<HowItWorks />} />
          <Route path="/history" element={<History />} />
          <Route path="/stats" element={<Stats />} />
          <Route path="/compare" element={<Compare />} />
          <Route path="/schema" element={<Schema />} />
          <Route path="/tooling" element={<Tooling />} />
          <Route path="/docs" element={<DocIndex />} />
          <Route path="/docs/:slug" element={<DocRoute />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
      <Footer />
    </>
  );
}
