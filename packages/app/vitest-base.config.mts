import { defineConfig } from 'vitest/config';

// `gridstack`'s main entry (`dist/gridstack.js`) uses ESM `import` statements without file
// extensions (e.g. `from './gridstack-engine'`). Bundlers (webpack, esbuild, the Angular app
// build) resolve this fine, but Vitest otherwise treats it as a pure-ESM package and hands it
// straight to Node's native ESM loader, which requires explicit extensions and fails with
// `ERR_MODULE_NOT_FOUND`. Marking it as an inlined server dep forces Vite to transform it
// through its own resolution pipeline instead, which resolves the extensionless imports correctly.
export default defineConfig({
  test: {
    server: {
      deps: {
        inline: ['gridstack'],
      },
    },
  },
});
