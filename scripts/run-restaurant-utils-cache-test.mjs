import { build } from 'esbuild';
import { rm } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = fileURLToPath(new URL('..', import.meta.url));
const outfile = join(rootDir, 'node_modules/.tmp/restaurantUtils.cache.test.bundle.mjs');

await build({
  entryPoints: [join(rootDir, 'scripts/restaurantUtils.cache.test.ts')],
  bundle: true,
  format: 'esm',
  platform: 'node',
  outfile,
  alias: {
    '@': join(rootDir, 'src'),
  },
  logLevel: 'silent',
});

try {
  await import(`file://${outfile}`);
} finally {
  await rm(outfile, { force: true });
}
