import angular from '@analogjs/vite-plugin-angular';
import { fileURLToPath } from 'url';
import { defineConfig } from 'vite';
import tsconfigPaths from 'vite-tsconfig-paths';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  plugins: [angular(), tsconfigPaths()],
  base: process.env['VITE_BASE_HREF'] ?? './',
  build: {
    outDir: 'dist',
  },
  css: {
    preprocessorOptions: {
      scss: {
        includePaths: [`${__dirname}../app/src/styles`, `${__dirname}../../node_modules`],
      },
    },
  },
});
