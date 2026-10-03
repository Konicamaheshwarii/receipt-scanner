// Renders the demo receipts in src/app/core/demo/samples.ts to JPEG photos in public/samples.
// Needs Node 22.18+ (TypeScript type stripping) and puppeteer:
//   npx -p puppeteer node scripts/render-samples.mts
// Set PUPPETEER_MODULE to a puppeteer install path and CHROME_PATH to use a local Chrome.
import { mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SAMPLES, type SampleReceipt } from '../src/app/core/demo/samples.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const puppeteer = require(process.env['PUPPETEER_MODULE'] ?? 'puppeteer');

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');

const FONTS: Record<SampleReceipt['style'], string> = {
  thermal: "'Courier New', Consolas, monospace",
  bistro: "Georgia, 'Times New Roman', serif",
  cafe: "'Segoe UI', Helvetica, Arial, sans-serif",
};

function html(s: SampleReceipt, tilt: number): string {
  const p = s.printed;
  const lines = p.lines.map((l) => `
    <div class="line"><span>${esc(l.text)}</span><span>${esc(l.amount)}</span></div>
    ${l.detail ? `<div class="detail">${esc(l.detail)}</div>` : ''}`).join('');
  const totals = p.totals.map(([k, v], i) => `
    <div class="line ${i === p.totals.length - 1 || /total/i.test(k) && !/sub/i.test(k) ? 'grand' : ''}"><span>${esc(k)}</span><span>${esc(v)}</span></div>`).join('');
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    body { margin: 0; }
    .table { width: 420px; padding: 36px 40px 44px; background:
      radial-gradient(circle at 30% 20%, #8a7a66 0, #6f604f 55%, #5d5043 100%); }
    .paper { background: #fbfaf6; color: #2b2a28; padding: 26px 22px 30px; font-family: ${FONTS[s.style]};
      font-size: 14px; line-height: 1.45; transform: rotate(${tilt}deg);
      box-shadow: 0 14px 30px rgba(0,0,0,.35), 0 2px 4px rgba(0,0,0,.2);
      background-image: linear-gradient(180deg, rgba(0,0,0,.025), rgba(0,0,0,0) 30%, rgba(0,0,0,.03));
      -webkit-mask: radial-gradient(circle 5px at 50% 100%, transparent 98%, #000) 0 0 / 14px 100%; }
    h1 { font-size: ${s.style === 'thermal' ? 19 : 24}px; text-align: center; margin: 0 0 4px; letter-spacing: ${s.style === 'thermal' ? '1px' : '0'};
      font-style: ${s.style === 'bistro' ? 'italic' : 'normal'}; }
    .center { text-align: center; color: #555; font-size: 12.5px; }
    .meta { margin: 12px 0 8px; font-size: 12.5px; color: #444; text-align: center; }
    hr { border: 0; border-top: 1.5px dashed #999; margin: 10px 0; }
    .line { display: flex; justify-content: space-between; gap: 16px; }
    .detail { font-size: 12px; color: #666; padding-left: 12px; margin-top: -2px; }
    .grand { font-weight: 700; font-size: 16px; margin-top: 4px; }
    .footer { margin-top: 14px; text-align: center; font-size: 12.5px; color: #444; }
    .barcode { height: 34px; margin: 14px auto 0; width: 72%;
      background: repeating-linear-gradient(90deg, #333 0 2px, transparent 2px 4px, #333 4px 5px, transparent 5px 8px, #333 8px 11px, transparent 11px 12px); }
  </style></head><body><div class="table"><div class="paper">
    <h1>${esc(p.title)}</h1>
    ${p.header.map((h) => `<div class="center">${esc(h)}</div>`).join('')}
    <div class="meta">${p.meta.map(esc).join('<br>')}</div>
    <hr>${lines}<hr>${totals}<hr>
    <div class="footer">${p.footer.map(esc).join('<br>')}</div>
    ${s.style === 'thermal' ? '<div class="barcode"></div>' : ''}
  </div></div></body></html>`;
}

const outDir = join(root, 'public', 'samples');
mkdirSync(outDir, { recursive: true });
const browser = await puppeteer.launch({ executablePath: process.env['CHROME_PATH'] || undefined });
const page = await browser.newPage();
await page.setViewport({ width: 500, height: 1200, deviceScaleFactor: 1.5 });
const tilts = [-1.2, 0.9, -0.6, 1.1, -0.9, 0.7];
for (const [i, s] of SAMPLES.entries()) {
  await page.setContent(html(s, tilts[i % tilts.length]), { waitUntil: 'load' });
  const el = await page.$('.table');
  await el.screenshot({ path: join(root, 'public', s.file), type: 'jpeg', quality: 80 });
  console.log('wrote', s.file);
}
await browser.close();
