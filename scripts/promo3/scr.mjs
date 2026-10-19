import { chromium } from 'playwright';
const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
const p=await b.newPage({viewport:{width:393,height:847},deviceScaleFactor:4});
for(const l of ['en','hu']) for(const s of [2,3,4,5,6,7,8]){
  await p.goto(`file://${process.cwd()}/render.html?s=${s}&l=${l}&scr=1`); await p.waitForSelector('body[data-ready]'); await p.waitForTimeout(100);
  await p.screenshot({path:`a/scr-${l}-${s}.png`});
}
await b.close();
