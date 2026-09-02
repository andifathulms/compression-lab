import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { join, extname } from 'node:path';

const ROOT = process.cwd() + '/dist';
const TYPES = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.woff2':'font/woff2', '.txt':'text/plain', '.svg':'image/svg+xml' };
const server = createServer(async (req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]).replace(/^\/compression-lab/, '');
  if (p === '' || p === '/') p = '/index.html';
  const file = join(ROOT, p);
  try { await stat(file); } catch { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' });
  res.end(await readFile(file));
});
await new Promise((r) => server.listen(4187, r));

const browser = await chromium.launch();
const errors = [];
async function open(theme, w, h) {
  const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 2 });
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.addInitScript((t) => localStorage.setItem('compression-lab:theme', t), theme);
  await page.goto('http://localhost:4187/compression-lab/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  return page;
}
const targets = process.argv.slice(2);
const want = (n) => targets.length === 0 || targets.includes(n);

for (const [name, w, h, theme] of [['desktop-light',1440,900,'light'],['desktop-dark',1440,900,'dark'],['mobile-light',430,932,'light']]) {
  if (!want(name)) continue;
  const page = await open(theme, w, h);
  await page.screenshot({ path: `/tmp/shots/${name}.png` });
  await page.close();
}
for (const [name, coder, theme] of [['arithmetic-dark','Arithmetic','dark'],['lz77-light','LZ77','light'],['compare-light','Compare','light'],['steps-light','__steps','light']]) {
  if (!want(name)) continue;
  const page = await open(theme, 1440, 900);
  if (coder === '__steps') {
    await page.getByRole('button', { name: 'The steps', exact: true }).click();
    await page.waitForTimeout(600);
    await page.screenshot({ path: `/tmp/shots/${name}.png` });
    await page.close();
    continue;
  }
  await page.getByRole('button', { name: coder, exact: true }).click({ timeout: 8000, force: true }).catch((e) => errors.push(`${name}: ${e.message.split('\n').slice(0,6).join(' / ')}`));
  await page.waitForTimeout(1200);
  await page.evaluate(() => window.scrollTo(0, 420));
  await page.waitForTimeout(400);
  await page.screenshot({ path: `/tmp/shots/${name}.png` });
  await page.close();
}
await browser.close();
server.close();
console.log(errors.length ? 'ERRORS:\n' + [...new Set(errors)].join('\n') : 'clean');
