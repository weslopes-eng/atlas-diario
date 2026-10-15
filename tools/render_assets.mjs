import { chromium } from 'playwright';
import fs from 'node:fs';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1200, height: 630 } });
await p.goto('file://' + process.cwd() + '/og.html'); await p.waitForTimeout(300);
await p.screenshot({ path: '../site/og.jpg', type: 'jpeg', quality: 86 });
const svg = fs.readFileSync('../site/icons/favicon.svg', 'utf8');
for (const [n, s] of [['favicon-32.png', 32], ['apple-touch-icon.png', 180], ['icon-192.png', 192], ['icon-512.png', 512]]) {
  const q = await b.newPage({ viewport: { width: s, height: s } });
  await q.setContent(`<style>body{margin:0}svg{width:${s}px;height:${s}px;display:block}</style>${svg}`);
  await q.screenshot({ path: '../site/icons/' + n, omitBackground: true }); await q.close();
}
await b.close();
