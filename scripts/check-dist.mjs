#!/usr/bin/env node
// Sanity checks on the production build: fonts must be separate WOFF2 files (never inlined as
// base64, never duplicated as WOFF) and the default font must be present.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const dist = new URL('../dist/', import.meta.url).pathname;
const files = [];
(function walk(dir) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path);
    else files.push(path);
  }
})(dist);

const problems = [];
const css = files.filter((f) => f.endsWith('.css'));
for (const file of css) {
  if (readFileSync(file, 'utf8').includes('data:font')) problems.push(`${file}: font inlined as data URI`);
}
const woff = files.filter((f) => f.endsWith('.woff'));
if (woff.length) problems.push(`${woff.length} .woff files in dist (only .woff2 expected)`);
if (!files.some((f) => /cairo-arabic-wght-normal.*\.woff2$/.test(f)))
  problems.push('default Cairo Arabic font missing');

const size = (list) => list.reduce((sum, f) => sum + statSync(f).size, 0);
const mb = (bytes) => `${(bytes / 1024 / 1024).toFixed(1)} MB`;
const fonts = files.filter((f) => f.endsWith('.woff2'));
const code = files.filter((f) => /\.(js|css|html)$/.test(f));
console.log(`dist: ${files.length} files, ${mb(size(files))} total`);
console.log(`  code/html/css: ${mb(size(code))}, fonts: ${fonts.length} woff2 files, ${mb(size(fonts))}`);

if (problems.length) {
  console.error('dist check failed:\n  ' + problems.join('\n  '));
  process.exit(1);
}
console.log('dist check passed.');
