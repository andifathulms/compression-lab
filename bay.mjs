import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { join, extname } from 'node:path';
const ROOT = process.cwd() + '/dist';
const TYPES = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.woff2':'font/woff2' };
const server = createServer(async (req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]).replace(/^\/compression-lab/, '');
  if (p === '' || p === '/') p = '/index.html';
  const file = join(ROOT, p);
  try { await stat(file); } catch { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' });
  res.end(await readFile(file));
});
await new Promise((r) => server.listen(4188, r));
const b = await chromium.launch();
for (const [name, coder, theme] of [['bay-huffman','Huffman','light'],['bay-arith','Arithmetic','dark'],['bay-lz77','LZ77','light'],['bay-compare','Compare','light']]) {
  const page = await b.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 2 });
  await page.addInitScript((t) => localStorage.setItem('compression-lab:theme', t), theme);
  await page.goto('http://localhost:4188/compression-lab/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);
  await page.getByRole('button', { name: coder, exact: true }).click();
  await page.waitForTimeout(1500);
  await page.addStyleTag({ content: '.app-rail,.app-stair,.app-specimen{position:static!important;max-height:none!important}' });
  await page.waitForTimeout(400);
  const sel = { 'bay-huffman': '.ht', 'bay-arith': '.interval-body', 'bay-lz77': '.sw', 'bay-compare': '.app-bay > section:first-child' }[name];
  await page.locator(sel).first().screenshot({ path: `/tmp/shots/${name}.png` });
  if (name === 'bay-huffman') await page.locator('.waste').screenshot({ path: '/tmp/shots/bay-waste.png' });
  if (name === 'bay-arith') await page.locator('.ledger').screenshot({ path: '/tmp/shots/bay-ledger.png' });
  await page.close();
}
await b.close(); server.close(); console.log('ok');
