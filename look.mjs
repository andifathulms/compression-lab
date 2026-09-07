import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { join, extname } from 'node:path';
const ROOT=process.cwd()+'/dist';
const T={'.html':'text/html','.js':'text/javascript','.css':'text/css','.woff2':'font/woff2','.svg':'image/svg+xml','.png':'image/png'};
const server=createServer(async(req,res)=>{let p=decodeURIComponent(req.url.split('?')[0]).replace(/^\/compression-lab/,'');if(p===''||p==='/')p='/index.html';const f=join(ROOT,p);try{await stat(f);}catch{res.writeHead(404);res.end();return;}res.writeHead(200,{'content-type':T[extname(f)]??'application/octet-stream'});res.end(await readFile(f));});
await new Promise(r=>server.listen(4230,r));
const b=await chromium.launch();
const p=await b.newPage({viewport:{width:1440,height:1000},deviceScaleFactor:2});
const errs=[]; p.on('pageerror',e=>errs.push(String(e)));
await p.addInitScript(()=>localStorage.setItem('compression-lab:theme','light'));
await p.goto('http://localhost:4230/compression-lab/',{waitUntil:'networkidle'}); await p.waitForTimeout(1700);
console.log(JSON.stringify(await p.evaluate(()=>{
  const h=s=>{const e=document.querySelector(s);return e?Math.round(e.getBoundingClientRect().height):null};
  return {specimen:h('.app-specimen'), head:h('.specimen-head'), deriv:h('.deriv'), ts:h('.ts'), readout:h('.specimen-readout')};
})));
const d=await p.$('.deriv');
if(d){ await d.scrollIntoViewIfNeeded(); await p.waitForTimeout(400); await d.screenshot({path:'/tmp/shots/deriv.png'});
  console.log('text:', (await d.innerText()).replace(/\n+/g,' | ').slice(0,600)); }
else console.log('NO .deriv');
await b.close(); server.close();
console.log(errs.length?'ERRORS '+errs.join('|'):'clean');
