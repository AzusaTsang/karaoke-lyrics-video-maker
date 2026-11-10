import re, json, unicodedata, torch, torchaudio, soundfile as sf
import build_lyrics as J                         # 复用日语：split_units / build_unit_moras / parse
from pypinyin import lazy_pinyin
from torchaudio.pipelines import MMS_FA as B
J.SRT = r'V:\Adobe\focalors_inmu_king_fr.mp3.srt'

CYR = dict(zip('абвгдежзийклмнопрстуфхцчшщъыьэюяё',
  ['a','b','v','g','d','e','zh','z','i','y','k','l','m','n','o','p','r','s','t','u','f','kh','ts','ch','sh','sch','','y','','e','yu','ya','yo']))
def roman(ch):
    c=ch.lower(); c={'œ':'oe','æ':'ae','ß':'ss'}.get(c,c)
    if c in CYR: return CYR[c]
    n=''.join(x for x in unicodedata.normalize('NFKD',c) if not unicodedata.combining(x))
    return re.sub('[^a-z]','',n)
isCJK=lambda c:'\u4e00'<=c<='\u9fff'
isKana=lambda c:'\u3040'<=c<='\u30ff'

def build(text):
    """→ units[(显示字符, 注音|None)], groups[(单元下标列表, 对齐用字母列表)]"""
    if any(isKana(c) for c in text):                                   # 日语：假名注音 + 逐拍
        units=J.split_units(text); flat,span=J.build_unit_moras(units)
        return units,[([i],[t for m,tk in flat[a:b] for t in tk]) for i,(a,b) in enumerate(span) if b>a]
    if any(isCJK(c) for c in text):                                    # 中文：不加注音，仅借拼音对齐
        units=[(c,None) for c in text]; groups=[]
        for i,c in enumerate(text):
            if isCJK(c): groups.append(([i],list(re.sub('[^a-z]','',lazy_pinyin(c)[0].replace('ü','u')))))
        return units,groups
    units=[]; groups=[]                                                 # 法/英/俄：按词
    for w in re.split(r'( +)',text):
        if not w: continue
        idx=list(range(len(units),len(units)+len(w))); units+= [(c,None) for c in w]
        if w.strip():
            toks=[t for c in w for t in roman(c)]
            if toks: groups.append((idx,toks))
    return units,groups

def main():
    dev='cuda'; model=B.get_model(with_star=False).to(dev).eval(); lid={c:i for i,c in enumerate(B.get_labels())}
    wav,sr=sf.read('work/fr_vocals16k.wav',dtype='float32'); wav=torch.from_numpy(wav)[None]
    with torch.inference_mode():
        em=torch.log_softmax(model(wav.to(dev))[0],-1)[0].cpu()
    fps=em.shape[0]/(wav.shape[1]/16000); out=[]
    for c in J.parse():
        units,groups=build(c['text']); rec=dict(c); rec['score']=None; rec['units']=[]
        toks=[(gi,t) for gi,(ix,tk) in enumerate(groups) for t in tk]
        pad=0.35; f0=max(0,int((c['start']-pad)*fps)); f1=min(em.shape[0],int((c['end']+pad)*fps)+1)
        ok=False
        if toks and f1-f0>len(toks)*1.2:
            try:
                tgt=torch.tensor([[lid[t] for _,t in toks]],dtype=torch.int32)
                al,sc=torchaudio.functional.forced_align(em[f0:f1][None],tgt,blank=0)
                sp=torchaudio.functional.merge_tokens(al[0],sc[0].exp()); assert len(sp)==len(toks)
                g0={};g1={}
                for (gi,_),s in zip(toks,sp):
                    g0.setdefault(gi,(f0+s.start)/fps); g1[gi]=(f0+s.end)/fps
                rec['score']=float(sum(s.score for s in sp)/len(sp))
                T=[[None,None] for _ in units]; gis=sorted(g0)
                for n,gi in enumerate(gis):
                    nxt=g0[gis[n+1]] if n+1<len(gis) else None
                    e=nxt if (nxt is not None and nxt-g1[gi]<0.35) else g1[gi]+0.15
                    e=max(e,g0[gi]+0.04); ix=groups[gi][0]; k=len(ix)
                    for j,ui in enumerate(ix):
                        T[ui]=[g0[gi]+(e-g0[gi])*j/k, g0[gi]+(e-g0[gi])*(j+1)/k]
                prev=c['start']
                for i,(d,r) in enumerate(units):
                    if T[i][0] is None: T[i]=[prev,prev]
                    prev=T[i][1]
                rec['units']=[dict(t=d,r=r,t0=round(T[i][0],3),t1=round(T[i][1],3)) for i,(d,r) in enumerate(units)]; ok=True
            except Exception as ex: rec['err']=repr(ex)[:100]
        if not ok:
            n=len(units); d=(c['end']-c['start'])/max(n,1); rec['fallback']=True
            rec['units']=[dict(t=u[0],r=u[1],t0=round(c['start']+i*d,3),t1=round(c['start']+(i+1)*d,3)) for i,u in enumerate(units)]
        out.append(rec)
    json.dump(out,open('lyrics_aligned_fr.json','w',encoding='utf-8'),ensure_ascii=False,indent=1)
    import statistics as st; sc=[r['score'] for r in out if r['score'] is not None]
    print(len(out),'cues; fallback',sum(1 for r in out if r.get('fallback')),'median',round(st.median(sc),3),'<0.1:',sum(s<0.1 for s in sc),'>=0.3:',sum(s>=0.3 for s in sc))
    for r in out:
        if r.get('fallback') or (r['score'] or 0)<0.1: print(' low',r['id'],r['text'][:50],r['score'],r.get('err'))
if __name__=='__main__': main()
