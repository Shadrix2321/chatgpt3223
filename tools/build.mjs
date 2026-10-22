import { build } from 'esbuild';
import { readFile, writeFile, mkdir, copyFile } from 'node:fs/promises';
import { brotliCompressSync, gzipSync, constants } from 'node:zlib';
await build({
  entryPoints: ['src/client.mjs'],
  outfile: 'game-playcanvas.js',
  bundle: true,
  format: 'iife',
  target: ['es2020'],
  platform: 'browser',
  minify: true,
  sourcemap: 'external',
  legalComments: 'linked',
  define: { 'process.env.NODE_ENV': '"production"' },
});
await mkdir('assets', {recursive: true});
await copyFile('node_modules/playcanvas/LICENSE', 'assets/LICENSE-playcanvas.txt');
const bundle = await readFile('game-playcanvas.js', 'utf8');
if (bundle.includes('THREE.REVISION') || bundle.includes('WebGLRenderer:')) throw new Error('Unexpected legacy renderer in browser bundle');
for (const name of ['game-playcanvas.js', 'game.css', 'playcanvas.css']) {
  const bytes = await readFile(name);
  await writeFile(name + '.br', brotliCompressSync(bytes, {params: {[constants.BROTLI_PARAM_QUALITY]: 8}}));
  await writeFile(name + '.gz', gzipSync(bytes, {level: 9}));
}
console.log('PlayCanvas browser bundle built.');
