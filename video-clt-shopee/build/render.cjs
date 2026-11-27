const {chromium}=require('playwright');const {spawn}=require('child_process');
(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:1080,height:1920}});
await p.goto('file://'+process.cwd()+'/index.html');await p.waitForTimeout(800);
const FPS=30,N=Math.round(68.5*FPS);
const ff=spawn('ffmpeg',['-v','error','-y','-f','image2pipe','-framerate','30','-i','-','-c:v','libx264','-preset','medium','-crf','18','-pix_fmt','yuv420p','../silent.mp4']);
for(let i=0;i<N;i++){await p.evaluate(t=>renderAt(t),i/FPS);const buf=await p.screenshot({type:'jpeg',quality:92});if(!ff.stdin.write(buf))await new Promise(r=>ff.stdin.once('drain',r));if(i%300==0)console.log(i);}
ff.stdin.end();await new Promise(r=>ff.on('close',r));await b.close();console.log('done');})();
