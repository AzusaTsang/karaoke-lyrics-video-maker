import sys, json, torch, torchaudio, soundfile as sf, numpy as np, statistics as st
import build_lyrics as J, build_lyrics_fr as F
from torchaudio.pipelines import MMS_FA as B
wavf, srt, outf = 'work/fr_vocals16k.wav', F.J.SRT, 'lyrics_aligned_fr_global.json'
dev='cuda'; model=B.get_model(with_star=False).to(dev).eval(); lid={c:i for i,c in enumerate(B.get_labels())}
wav,sr=sf.read(wavf,dtype='float32'); wav=torch.from_numpy(wav)[None]
with torch.inference_mode(): em=torch.log_softmax(model(wav.to(dev))[0],-1)[0]
fps=em.shape[0]/(wav.shape[1]/16000)
cues=J.parse(); built=[F.build(c['text']) for c in cues]
toks=[]; own=[]                       # 全曲 token，及其所属 (cue, group)
for ci,(units,groups) in enumerate(built):
    for gi,(ix,tk) in enumerate(groups):
        for t in tk: toks.append(lid[t]); own.append((ci,gi))
print('tokens',len(toks),'frames',em.shape[0])
al,sc=torchaudio.functional.forced_align(em[None],torch.tensor([toks],dtype=torch.int32,device=dev),blank=0)
sp=torchaudio.functional.merge_tokens(al[0].cpu(),sc[0].exp().cpu()); assert len(sp)==len(toks)
G0={};G1={};S={}
for (ci,gi),s in zip(own,sp):
    G0.setdefault((ci,gi),s.start/fps); G1[(ci,gi)]=s.end/fps; S.setdefault(ci,[]).append(s.score)
out=[]
for ci,c in enumerate(cues):
    units,groups=built[ci]; rec=dict(c); rec['score']=float(np.mean(S[ci])) if ci in S else None
    gis=[gi for gi in range(len(groups)) if (ci,gi) in G0]; T=[[None,None] for _ in units]
    for n,gi in enumerate(gis):
        nxt=G0[(ci,gis[n+1])] if n+1<len(gis) else None
        e=nxt if (nxt is not None and nxt-G1[(ci,gi)]<0.35) else G1[(ci,gi)]+0.15
        e=max(e,G0[(ci,gi)]+0.04); ix=groups[gi][0]; k=len(ix)
        for j,ui in enumerate(ix): T[ui]=[G0[(ci,gi)]+(e-G0[(ci,gi)])*j/k, G0[(ci,gi)]+(e-G0[(ci,gi)])*(j+1)/k]
    prev=c['start']
    for i in range(len(units)):
        if T[i][0] is None: T[i]=[prev,prev]
        prev=T[i][1]
    rec['units']=[dict(t=d,r=r,t0=round(T[i][0],3),t1=round(T[i][1],3)) for i,(d,r) in enumerate(units)]
    out.append(rec)
json.dump(out,open(outf,'w',encoding='utf-8'),ensure_ascii=False,indent=1)
a=[];b=[]
for r in out:
    us=[u for u in r['units'] if u['t'].strip()]
    a.append(us[0]['t0']-r['start']); b.append(us[-1]['t1']-r['end'])
a=np.array(a);b=np.array(b)
print('全局对齐: 首字-句起 中位 %.2f p10/p90 %.2f/%.2f | 末字-句止 中位 %.2f p10/p90 %.2f/%.2f'%(np.median(a),*np.percentile(a,[10,90]),np.median(b),*np.percentile(b,[10,90])))
print('偏离 SRT 起点>1s 的句:',[(r['id'],round(x,2)) for r,x in zip(out,a) if abs(x)>1])
print('score median',round(st.median([r['score'] for r in out if r['score'] is not None]),3))
