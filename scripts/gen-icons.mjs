#!/usr/bin/env node
// Renders public/favicon.svg into the PNG icons used by the web app manifest (run once; the PNGs are
// committed). Uses Playwright's Chromium, which is already a dev dependency.
import { readFileSync } from 'node:fs';
import { chromium } from '@playwright/test';

const root = new URL('../public/', import.meta.url);
const svg = readFileSync(new URL('favicon.svg', root), 'utf8');
const dataUri = `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;

// [file, size, content scale, background]. Maskable icons keep the artwork inside the central safe
// zone on a full-bleed background.
const ICONS = [
  ['pwa-192.png', 192, 1, null],
  ['pwa-512.png', 512, 1, null],
  ['maskable-512.png', 512, 0.72, '#0f1115'],
  ['apple-touch-icon.png', 180, 0.86, '#0f1115'],
];

const browser = await chromium.launch();
const page = await browser.newPage();
for (const [file, size, scale, background] of ICONS) {
  const inner = Math.round(size * scale);
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(
    `<html><body style="margin:0;display:grid;place-items:center;width:${size}px;height:${size}px;background:${
      background ?? 'transparent'
    }"><img src="${dataUri}" width="${inner}" height="${inner}"></body></html>`,
  );
  await page.screenshot({ path: new URL(file, root).pathname, omitBackground: !background });
  console.log(`wrote public/${file}`);
}
await browser.close();
