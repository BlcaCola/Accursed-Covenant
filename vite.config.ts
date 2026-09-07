import { defineConfig } from 'vite';

// Relative assets allow the same dist/ to be hosted at / or /games/accursed-covenant/.
export default defineConfig({
  base: './',
  build: { target: 'es2022', chunkSizeWarningLimit: 1600 },
  // Playwright writes screenshots under the repository root. Ignore generated
  // QA and release files so those writes cannot reload a running game mid-test.
  server: { port: 5173, strictPort: true, watch: { ignored: ['**/test-results/**', '**/release/**'] } },
});
