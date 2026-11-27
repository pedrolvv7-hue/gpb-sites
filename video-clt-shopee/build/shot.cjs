const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:1080,height:1920}});
await p.goto('file://'+process.cwd()+'/index.html');await p.waitForTimeout(500);
const ts=process.argv.slice(2).map(Number);
for(const t of ts){await p.evaluate(t=>renderAt(t),t);await p.screenshot({path:`../shots/s_${t}.png`});}
await b.close();})();
