// Starts the dev app (`npm start`) with BB_WINDOW_MODE set, without needing cross-env.
// Usage: node scripts/start-mode.cjs <phone|tablet|desktop>
const { spawnSync } = require('node:child_process');

const mode = process.argv[2];
if (!['phone', 'tablet', 'desktop'].includes(mode)) {
  console.error('Usage: node scripts/start-mode.cjs <phone|tablet|desktop>');
  process.exit(1);
}

const result = spawnSync('npm', ['start'], {
  stdio: 'inherit',
  shell: true,
  env: { ...process.env, BB_WINDOW_MODE: mode },
});
process.exit(result.status ?? 1);
