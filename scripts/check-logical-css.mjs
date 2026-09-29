#!/usr/bin/env node
// Fails when stylesheets use physical (left/right) properties instead of logical ones.
// The UI flips between RTL and LTR, so every inline-axis rule must be direction-agnostic.
// Append the comment `/* physical-ok */` to a line that intentionally needs a physical value.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = new URL('../src/', import.meta.url).pathname;
const RULES = [
  /\b(margin|padding|border)-(left|right)\b/,
  /(^|[\s;{])(left|right)\s*:/,
  /\btext-align\s*:\s*(left|right)\b/,
  /\bfloat\s*:\s*(left|right)\b/,
  /\bclear\s*:\s*(left|right)\b/,
  /\bborder-(top|bottom)-(left|right)-radius\b/,
];

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) yield* walk(path);
    else if (path.endsWith('.css')) yield path;
  }
}

const problems = [];
for (const file of walk(ROOT)) {
  const lines = readFileSync(file, 'utf8').split('\n');
  lines.forEach((line, i) => {
    if (line.includes('physical-ok')) return;
    const code = line.replace(/\/\*.*?\*\//g, '');
    if (RULES.some((re) => re.test(code))) {
      problems.push(`${relative(process.cwd(), file)}:${i + 1}: ${line.trim()}`);
    }
  });
}

if (problems.length) {
  console.error('Physical CSS properties found (use logical properties such as margin-inline-start):');
  for (const p of problems) console.error('  ' + p);
  process.exit(1);
}
console.log('Logical CSS check passed.');
