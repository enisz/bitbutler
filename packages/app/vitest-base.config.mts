import { defineConfig } from 'vitest/config';

// `gridstack`'s main entry (`dist/gridstack.js`) uses ESM `import` statements without file
// extensions (e.g. `from './gridstack-engine'`). Bundlers (webpack, esbuild, the Angular app
// build) resolve this fine, but Vitest's default dependency discovery is disabled by the Angular
// CLI test builder (`optimizeDeps.noDiscovery: true`), so `gridstack` is never picked up for
// esbuild pre-bundling and Node's strict ESM loader chokes on the missing extension instead
// (`ERR_MODULE_NOT_FOUND`). Explicitly including it here forces Vite to pre-bundle it via esbuild,
// which resolves the extensionless imports correctly.
export default defineConfig({
  test: {
    server: {
      deps: {
        inline: ['gridstack'],
      },
    },
  },
});
