/**
 * Why: The site has to say how fresh its numbers are, and that date used to
 * live in the generated snapshot — which made a refresh run that found no new
 * content still rewrite a file and open a pull request. Stamping the date at
 * build time keeps the claim honest and keeps the committed content free of
 * anything that moves on its own.
 * What: Defines `import.meta.env.VITE_BUILD_TIME` as the UTC instant of this
 * build. Vercel builds on every merge to `main`, so it tracks the deploy.
 * Test: `npm run build`, then `/stats` states a build date
 */
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  define: {
    'import.meta.env.VITE_BUILD_TIME': JSON.stringify(new Date().toISOString()),
  },
  plugins: [react()],
});
