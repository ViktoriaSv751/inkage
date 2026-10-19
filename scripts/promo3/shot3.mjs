import { chromium } from 'playwright';
const F={ios:[430,932,3],ios63:[402,874,3],play:[405,720,2.6667]};
const [,, fmts='ios', langs='en', slides='1,2,3,4,5,6,7,8', out='out'] = process.argv;
const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'}).catch(()=>chromium.launch());
for(const f of fmts.split(',')) for(const l of langs.split(',')){
  const [w,h,d]=F[f]; const p=await b.newPage({viewport:{width:w,height:h},deviceScaleFactor:d});
  for(const s of slides.split(',')){
    await p.goto(`file://${process.cwd()}/${process.env.R||"render.html"}?s=${s}&l=${l}&f=${f}`); await p.waitForSelector('body[data-ready]'); await p.waitForTimeout(150);
    await p.screenshot({path:`${out}/${f}-${l}-${s}.png`});
  }
  await p.close();
}
await b.close();
