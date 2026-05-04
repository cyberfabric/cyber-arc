const esbuild = require('esbuild');

const watch = process.argv.includes('--watch');

const ctx = {
  entryPoints: ['src/extension.ts'],
  bundle: true,
  outfile: 'dist/extension.js',
  platform: 'node',
  target: 'node18',
  external: ['vscode'],
  format: 'cjs',
  sourcemap: true,
  loader: { '.json': 'json' },
};

(async () => {
  if (watch) {
    const context = await esbuild.context(ctx);
    await context.watch();
    console.log('esbuild watching…');
  } else {
    await esbuild.build(ctx);
    console.log('esbuild build complete');
  }
})().catch((err) => { console.error(err); process.exit(1); });
