import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { join, extname } from 'node:path';
const ROOT=process.cwd()+'/dist';
const T={'.html':'text/html','.js':'text/javascript','.css':'text/css','.woff2':'font/woff2','.svg':'image/svg+xml','.png':'image/png'};
const server=createServer(async(req,res)=>{let p=decodeURIComponent(req.url.split('?')[0]).replace(/^\/compression-lab/,'');if(p===''||p==='/')p='/index.html';const f=join(ROOT,p);try{await stat(f);}catch{res.writeHead(404);res.end();return;}res.writeHead(200,{'content-type':T[extname(f)]??'application/octet-stream'});res.end(await readFile(f));});
await new Promise(r=>server.listen(4220,r));
const b=await chromium.launch(); const U='http://localhost:4220/compression-lab/';

const p=await b.newPage({viewport:{width:1440,height:900}});
await p.goto(U,{waitUntil:'networkidle'}); await p.waitForTimeout(1500);
// F1: tab stops
let n=0, tiny=0, treeStops=0; const smalls=[];
for(;n<400;n++){ await p.keyboard.press('Tab');
  const s=await p.evaluate(()=>{const e=document.activeElement; if(!e||e===document.body||e.tagName==='HTML')return null;
    const r=e.getBoundingClientRect(); return {cls:((e.className.baseVal??e.className??'')+'').split(' ')[0], w:Math.round(r.width),h:Math.round(r.height)};});
  if(!s) break;
  if(s.cls.startsWith('ht-node')) treeStops++;
  if(s.w<24||s.h<24){ tiny++; smalls.push(s.cls+' '+s.w+'x'+s.h); }
}
console.log('F1 total tab stops:',n,' tree stops:',treeStops,' under 24px:',tiny);
const tally={}; smalls.forEach(x=>{const k=x.split(' ')[0]||'(none)'; tally[k]=(tally[k]||0)+1;});
console.log('small target classes:', JSON.stringify(tally));
console.log('samples:', JSON.stringify(smalls.slice(0,6)));
// F3: switch name
console.log('F3 switch name:', await p.evaluate(()=>{const i=document.querySelector('input[type=checkbox]');
  const lb=i.getAttribute('aria-labelledby'); const db=i.getAttribute('aria-describedby');
  return {name:document.getElementById(lb)?.textContent.trim(), desc:document.getElementById(db)?.textContent.trim().slice(0,30)};}));
// F2: live region and announcement after a coder switch
await p.getByRole('button',{name:'LZ77',exact:true}).click(); await p.waitForTimeout(1100);
console.log('F2 announced:', JSON.stringify(await p.evaluate(()=>document.querySelector('.rail [aria-live]')?.textContent.trim())));
// F5/F6
console.log('F5 stray aria-labels:', await p.evaluate(()=>[...document.querySelectorAll('[aria-label]')]
  .filter(e=>!e.getAttribute('role')&&!['A','BUTTON','INPUT','SELECT','TEXTAREA','SECTION','NAV','SVG','svg'].includes(e.tagName)).map(e=>e.tagName)));
console.log('F6 region names:', await p.evaluate(()=>[...document.querySelectorAll('section[aria-labelledby],section[aria-label]')]
  .map(e=>e.getAttribute('aria-label')??document.getElementById(e.getAttribute('aria-labelledby'))?.textContent.trim())));
await p.close();
// F4: 320px reflow
const z=await b.newPage({viewport:{width:320,height:800}});
await z.goto(U,{waitUntil:'networkidle'}); await z.waitForTimeout(1400);
console.log('F4 320px:', await z.evaluate(()=>({scrollW:document.documentElement.scrollWidth, clientW:document.documentElement.clientWidth, horizontal:document.documentElement.scrollWidth>document.documentElement.clientWidth+1})));
await z.close();
await b.close(); server.close();
