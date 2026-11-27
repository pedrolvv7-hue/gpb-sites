import json, wave, numpy as np, re
P='proc/'
lines=[ # id, speaker, start, text, highlight words
("w01","Z",0.55,"Meu Deus, eu pisquei e já tenho que trabalhar de novo!",["PISQUEI","TRABALHAR"]),
("w02","Z",3.85,"AAAAI! MEU DEDINHO!",["DEDINHO!"]),
("w03","Z",7.45,"E tu, vagabundo, não trabalha não?",["VAGABUNDO,"]),
("f01","L",9.65,"Trabalho, pô! Tô divulgando produtos da Shopee!",["SHOPEE!"]),
("w04","Z",12.35,"Mas tu tem que comprar os produtos, gravar e editar esses vídeos todos?",["COMPRAR","GRAVAR","EDITAR"]),
("f02","L",16.35,"Editar?! Hahaha! Tá maluco? Tenho mais de três mil vídeos prontos!",["TRÊS","MIL","PRONTOS!"]),
("w05","Z",20.05,"TRÊS MIL?!",["TRÊS","MIL?!"]),
("f03","L",22.1,"É simples! Cria uma conta de afiliado na Shopee, espera a aprovação, escolhe um dos mais de três mil vídeos prontos, coloca teu link de afiliado e publica. Depois acompanha os resultados e recebe comissão pelas vendas qualificadas!",["SIMPLES!","AFILIADO","APROVAÇÃO,","VÍDEOS","LINK","PUBLICA.","COMISSÃO"]),
("w06","Z",33.65,"Então eu nem preciso aparecer?",["APARECER?"]),
("f04","L",35.65,"Exatamente!",["EXATAMENTE!"]),
("w07","Z",36.4,"E TU SÓ ME CONTA ISSO AGORA?!",["AGORA?!"]),
("w08","Z",38.65,"Mas quanto custa esse negócio? Uns quinhentos reais?",["QUINHENTOS"]),
("f05","L",42.45,"Quinhentos reais?! São só vinte e quatro e noventa! Mais de três mil vídeos prontos, vídeos narrados, stories, carrosséis, estratégias, atualizações e acesso vitalício. Sem mensalidade!",["VINTE","QUATRO","NOVENTA!","VITALÍCIO.","MENSALIDADE!"]),
("w09","Z",53.25,"VINTE E QUATRO E NOVENTA?!",["VINTE","QUATRO","NOVENTA?!"]),
("w10","Z",56.65,"MANDA ESSE LINK LOGO!",["LINK"]),
("f06","L",58.1,"Você também quer ter acesso aos mais de três mil vídeos prontos pra divulgar produtos da Shopee? Comenta EU QUERO aqui embaixo que eu te mando o link no privado!",["TRÊS","MIL","EU","QUERO","PRIVADO!"]),
]
FPS=30; out={"lines":[],"fps":FPS}
TOTAL=68.5; N=int(TOTAL*FPS)
env={"Z":np.zeros(N),"L":np.zeros(N)}
for lid,sp,st,txt,hl in lines:
    w=wave.open(P+lid+'.wav'); sr=w.getframerate(); a=np.frombuffer(w.readframes(w.getnframes()),np.int16).astype(float)/32768
    dur=len(a)/sr; hop=sr//FPS
    for i in range(0,len(a)//hop):
        r=np.sqrt(np.mean(a[i*hop:(i+1)*hop]**2)); f=int(st*FPS)+i
        if f<N: env[sp][f]=r
    words=txt.split(); wts=[len(x)+2 for x in words]; tot=sum(wts); t=st; ws=[]
    for x,k in zip(words,wts):
        d=dur*k/tot; ws.append([round(t,3),x.upper(), x.upper() in hl]); t+=d
    out["lines"].append({"id":lid,"sp":sp,"start":st,"end":round(st+dur,3),"words":ws})
for k in env:
    e=env[k]; e=np.clip(e/ (np.percentile(e[e>0],90) if (e>0).any() else 1),0,1); env[k]=[round(float(x),2) for x in e]
out["env"]=env; out["total"]=TOTAL
json.dump(out,open('build/timeline.json','w'),ensure_ascii=False)
for l in out["lines"]: print(l["id"],l["start"],l["end"])
