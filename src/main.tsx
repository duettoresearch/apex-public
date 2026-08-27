/**
 * Why: The design system's stylesheet must load before the site layer so the
 * site layer's overrides win on equal specificity. Import order here is what
 * guarantees that.
 * What: Mounts the app under a browser-history router.
 * Test: `npm run build`
 */

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import './vendor/marketing-ds/bundle.css';
import './styles/site.css';
import App from './App.tsx';

const container = document.getElementById('root');
if (!container) throw new Error('#root is missing from index.html');

createRoot(container).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
);
