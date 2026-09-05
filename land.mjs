import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { join, extname } from 'node:path';
const ROOT=process.cwd()+'/dist';
const T={'.html':'text/html','.js':'text/javascript','.css':'text/css','.woff2':'font/woff2','.svg':'image/svg+xml','.png':'image/png'};
const server=createServer(async(req,res)=>{let p=decodeURIComponent(req.url.split('?')[0]).replace(/^\/compression-lab/,'');if(p===''||p==='/')p='/index.html';const f=join(ROOT,p);try{await stat(f);}catch{res.writeHead(404);res.end();return;}res.writeHead(200,{'content-type':T[extname(f)]??'application/octet-stream'});res.end(await readFile(f));});
await new Promise(r=>server.listen(4196,r));
const b=await chromium.launch();
const shots=process.argv.slice(2);
const want=n=>shots.length===0||shots.includes(n);
async function page(w,h,theme){const p=await b.newPage({viewport:{width:w,height:h},deviceScaleFactor:2});await p.addInitScript(t=>localStorage.setItem('compression-lab:theme',t),theme);await p.goto('http://localhost:4196/compression-lab/',{waitUntil:'networkidle'});await p.waitForTimeout(1400);return p;}
if(want('desktop')){const p=await page(1440,900,'light');
 console.log('DESKTOP',await p.evaluate(()=>{const h=s=>{const e=document.querySelector(s);return e?Math.round(e.getBoundingClientRect().height):null};
  return{masthead:h('.masthead'),rail:h('.app-rail'),noteSize:getComputedStyle(document.querySelector('.note')).fontSize}}));
 await p.screenshot({path:'/tmp/shots/n-desktop.png'});await p.close();}
if(want('mobile')){const p=await page(390,844,'light');
 console.log('MOBILE',await p.evaluate(()=>{const t=s=>{const e=document.querySelector(s);return e?Math.round(e.getBoundingClientRect().top):null};
  return{viewport:innerHeight,mastheadH:Math.round(document.querySelector('.masthead').getBoundingClientRect().height),railBottom:Math.round(document.querySelector('.app-rail').getBoundingClientRect().bottom),firstProse:t('.ts-layer')}}));
 await p.screenshot({path:'/tmp/shots/n-mobile.png'});await p.close();}
if(want('dark')){const p=await page(1440,900,'dark');await p.screenshot({path:'/tmp/shots/n-dark.png'});await p.close();}
await b.close();server.close();console.log('ok');
