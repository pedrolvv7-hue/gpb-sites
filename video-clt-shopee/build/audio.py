import numpy as np, wave, json
SR=44100; T=68.5; N=int(SR*T)
rng=np.random.default_rng(7)
def sec(d): return np.arange(int(SR*d))/SR
def add(buf,t,x,g=1.0):
    i=int(t*SR); j=min(N,i+len(x)); buf[i:j]+=x[:j-i]*g
def envl(x,a=0.005,r=None):
    n=len(x); e=np.ones(n); na=int(a*SR); e[:na]=np.linspace(0,1,na)
    if r: e*=np.exp(-np.arange(n)/SR/r)
    return x*e
def beep(f,d): s=sec(d); return envl(np.sign(np.sin(2*np.pi*f*s))*0.5,0.002)
def boom(d=1.4,f0=70):
    s=sec(d); f=f0*np.exp(-s*1.2); ph=2*np.pi*np.cumsum(f)/SR
    return np.tanh(3*np.sin(ph)*np.exp(-s*2.2))*0.9
def thump(): s=sec(.35); return envl(np.sin(2*np.pi*(120*np.exp(-s*8))*s)*1+rng.normal(0,.4,len(s))*np.exp(-s*25),0.001,0.09)
def whoosh(d=.45):
    n=rng.normal(0,1,int(SR*d)); s=sec(d); e=np.sin(np.pi*s/d)**2
    # simple lowpass sweep via cumulative filter
    out=np.zeros_like(n); y=0
    for i in range(len(n)): a=0.02+0.25*(i/len(n)); y+=a*(n[i]-y); out[i]=y
    return out*e*2.2
def ding(f=1320,d=.8): s=sec(d); return envl(np.sin(2*np.pi*f*s)*.5+np.sin(2*np.pi*f*2.01*s)*.2,0.002,0.25)
def pop(): s=sec(.12); return envl(np.sin(2*np.pi*(900*np.exp(-s*30)+300)*s),0.001,0.03)*0.9
def boing(): s=sec(.6); f=300+180*np.sin(2*np.pi*9*s)*np.exp(-s*4); return envl(np.sin(2*np.pi*np.cumsum(f)/SR),0.003,0.25)*.6
def scratch(): s=sec(.4); f=600+500*np.sin(2*np.pi*5*s); return envl((np.sin(2*np.pi*np.cumsum(f)/SR)*.4+rng.normal(0,.25,len(s))),0.002,0.2)
def whistle_down(d=1.1): s=sec(d); f=1800*np.exp(-s*1.3); return envl(np.sin(2*np.pi*np.cumsum(f)/SR)*.35,0.01)
def crash(): s=sec(.7); return envl(rng.normal(0,.7,len(s)),0.001,0.12)+thump()[:len(s)] if False else envl(rng.normal(0,.7,len(s)),0.001,0.12)
def click(): s=sec(.03); return envl(rng.normal(0,.6,len(s)),0.0005,0.006)
def cash(): return np.concatenate([ding(2093,.15)*.6,ding(2637,.9)])
def riser(d=.8): s=sec(d); f=200+1200*(s/d)**2; return np.sin(2*np.pi*np.cumsum(f)/SR)*(s/d)*.25
def horn(): s=sec(.5); return envl(np.tanh(2*np.sin(2*np.pi*233*s)+np.sin(2*np.pi*311*s)),0.01,0.3)*.4

sfx=np.zeros(N)
for k in range(10): add(sfx,k*0.22,beep(2200,0.11),0.25)
for k in range(4): add(sfx,3.0+k*0.18,beep(2200,0.09),0.25)
add(sfx,3.78,thump(),0.9); add(sfx,3.78,pop(),0.5)
add(sfx,6.33,whoosh(),0.6); add(sfx,7.33,whoosh(.3),0.5)
add(sfx,9.6,whoosh(.3),0.4); add(sfx,12.3,scratch(),0.5)
add(sfx,16.3,boing(),0.6); add(sfx,19.45,riser(.5),0.7); add(sfx,19.95,boom(),0.9)
add(sfx,22.05,whoosh(),0.6)
for st in [22.1,24.6,26.2,28.4,29.6,30.4]: add(sfx,st,ding(1568,.5),0.35)
for k in range(7): add(sfx,22.1+1.6*k+1.2,whoosh(.25),0.25)
add(sfx,33.6,pop(),0.6); add(sfx,35.6,ding(1760),0.5); add(sfx,36.35,boom(1.0,60),0.8)
add(sfx,39.8,pop(),0.6); add(sfx,43.25,scratch(),0.6); add(sfx,44.45,cash(),0.6)
for i in range(7): add(sfx,42.45+3.6+i*0.95,pop(),0.35)
add(sfx,53.2,boom(),0.9); add(sfx,54.45,whistle_down(),0.6); add(sfx,55.6,crash(),0.6)
add(sfx,56.6,horn(),0.6); add(sfx,62.55,boing(),0.5); add(sfx,62.3,pop(),0.5)
t=64.45
while t<66.2: add(sfx,t,click(),0.6); t+=0.045+rng.random()*0.04
for i in range(6): add(sfx,65.15+i*0.32,pop(),0.5)
add(sfx,67.2,ding(2093,1.0),0.4)

# music: bouncy loop 118 bpm
bpm=118; beat=60/bpm; mus=np.zeros(N)
prog=[(130.81,[261.63,329.63,392.0]),(110.0,[220.0,261.63,329.63]),(87.31,[174.61,220.0,261.63]),(98.0,[196.0,246.94,293.66])]
def pluck(f,d=.25): s=sec(d); return envl(np.sin(2*np.pi*f*s)+.3*np.sin(4*np.pi*f*s),0.002,0.08)
nb=int(T/beat)
for b in range(nb):
    bar=(b//4)%4; root,ch=prog[bar]; tb=b*beat
    add(mus,tb,pluck(root,.3),0.5)
    if b%2==1: 
        for f in ch: add(mus,tb,pluck(f,.2),0.18)
    add(mus,tb+beat/2,pluck(ch[(b)%3]*2,.15),0.12)
    # hat
    add(mus,tb+beat/2,click(),0.15)
    if b%4 in (1,3): add(mus,tb,envl(rng.normal(0,.5,int(SR*.12)),0.001,0.04),0.35)
    if b%4 in (0,2): add(mus,tb,thump(),0.35)
# voices
voc=np.zeros(N); TL=json.load(open('build/timeline.json'))
for l in TL['lines']:
    w=wave.open('proc/%s.wav'%l['id']); a=np.frombuffer(w.readframes(w.getnframes()),np.int16).astype(float)/32768
    a=a/ (np.max(np.abs(a))+1e-9)*0.9
    add(voc,l['start'],a)
# ducking
act=np.convolve(np.abs(voc),np.ones(2205)/2205,'same'); duck=np.where(act>0.01,0.35,1.0)
duck=np.convolve(duck,np.ones(4410)/4410,'same')
# music fades out under final cards a bit, stops at end
mix=voc*1.0 + sfx*0.55 + mus*0.22*duck
fade=np.ones(N); fade[-int(SR*0.6):]=np.linspace(1,0,int(SR*0.6)); mix*=fade
mix=np.tanh(mix*1.1)*0.95
w=wave.open('build/mix.wav','wb'); w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR); w.writeframes((mix*32767).astype(np.int16).tobytes()); w.close()
print('ok', np.max(np.abs(mix)))
