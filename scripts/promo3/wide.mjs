import { chromium } from 'playwright';
const D={feature:[1024,500,2],header:[1280,549.6667,3],search:[1280,853.3333,3]};
const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
for(const [m,[w,h,d]] of Object.entries(D)) for(const l of ['en','hu']){
  const p=await b.newPage({viewport:{width:Math.round(w),height:Math.round(h)},deviceScaleFactor:d});
  await p.goto(`file://${process.cwd()}/wide3.html?m=${m}&l=${l}`); await p.waitForSelector('body[data-ready]');
  await p.screenshot({path:`out3/${m}-${l}.png`}); await p.close();
}
await b.close();
