import { build } from 'esbuild';
await build({ entryPoints: ['src/plugin.mjs'], outfile: 'com.nerveband.paseodeck.sdPlugin/bin/plugin.mjs', bundle: true, platform: 'node', target: 'node24', format: 'esm', packages: 'bundle', minify: true, sourcemap: false, banner: { js: 'import { createRequire } from "node:module"; const require = createRequire(import.meta.url);' } });
