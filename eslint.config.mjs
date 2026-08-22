// @ts-check
import angular from 'angular-eslint';
import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/dist-electron/**',
      '**/out/**',
      '**/coverage/**',
      '**/.release/**',
      '**/*.min.js',
    ],
  },
  {
    files: ['packages/app/src/**/*.ts'],
    extends: [...angular.configs.tsRecommended, eslintPluginPrettierRecommended],
  },
  {
    files: ['packages/app/src/**/*.html'],
    extends: [...angular.configs.templateRecommended, eslintPluginPrettierRecommended],
  },
  {
    files: ['packages/electron/src/**/*.ts'],
    languageOptions: {
      parser: tseslint.parser,
      ecmaVersion: 'latest',
      sourceType: 'module',
    },
    extends: [eslintPluginPrettierRecommended],
  },
  {
    files: ['packages/shared/src/**/*.ts'],
    languageOptions: {
      parser: tseslint.parser,
      ecmaVersion: 'latest',
      sourceType: 'module',
    },
    extends: [eslintPluginPrettierRecommended],
  },
  {
    files: ['packages/docs/docs/.vitepress/**/*.ts'],
    languageOptions: {
      parser: tseslint.parser,
      ecmaVersion: 'latest',
      sourceType: 'module',
    },
    extends: [eslintPluginPrettierRecommended],
  },
);
