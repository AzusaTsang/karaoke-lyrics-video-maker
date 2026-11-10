import re, json, sys, torch, torchaudio, soundfile as sf, pykakasi
from torchaudio.pipelines import MMS_FA as B
SRT = r'V:\Adobe\focalors_inmu_king_1440p_srt.mp4.srt'
isk  = lambda c: '\u4e00'<=c<='\u9fff' or c in '々〆'
kata2hira = lambda s: ''.join(chr(ord(c)-0x60) if 'ァ'<=c<='ヶ' else c for c in s)
kk = pykakasi.kakasi()

def ts(s):  h,m,r = s.split(':'); sec,ms = r.split(','); return int(h)*3600+int(m)*60+int(sec)+int(ms)/1000
def parse():
    cues=[]
    for blk in re.split(r'\n\s*\n', open(SRT,encoding='utf-8-sig').read().strip()):
        L=blk.strip().splitlines()
        if len(L)<3: continue
        a,b = L[1].split(' --> '); cues.append(dict(id=int(L[0]), start=ts(a), end=ts(b), text=' '.join(L[2:]).strip()))
    return cues

def split_units(text):
    """→ [(display, ruby|None)]  汉字块带读音(平假名)，其余逐字符一个单元"""
    # 特例：漢字（カタカナ）= 汉字块用括号里的片假名当注音
    m = re.fullmatch(r'(.*?)([\u4e00-\u9fff々〆]+)（([ァ-ヶー]+)）(.*)', text)
    pre = post = ''; forced = None
    if m: pre, kan, kat, post = m.groups(); forced = (kan, kat)
    out=[]
    def run(s):
        for it in kk.convert(s):
            o, h = it['orig'], it['hira']
            parts = re.findall(r'[\u4e00-\u9fff々〆]+|[^\u4e00-\u9fff々〆]+', o)
            if not any(isk(p[0]) for p in parts):
                out.extend((c,None) for c in o); continue
            pat = ''.join('(.+?)' if isk(p[0]) else re.escape(kata2hira(p)) for p in parts)
            mm = re.fullmatch(pat, h)
            if not mm: out.append((o,h)); continue
            g = iter(mm.groups())
            for p in parts:
                if isk(p[0]): out.append((p,next(g)))
                else: out.extend((c,None) for c in p)
    if forced:
        run(pre); out.append((forced[0], forced[1])); run(post)   # ruby 保留片假名
    else: run(text)
    return out

SMALL = set('ゃゅょぁぃぅぇぉゎ')
def moras(kana):
    """平/片假名串 → mora 列表；ー/っ/ん 单独成拍"""
    k = kata2hira(kana); res=[]
    for c in k:
        if c in SMALL and res: res[-1]+=c
        else: res.append(c)
    return res
def mora_tokens(m, prev_tokens):
    if m=='っ': return []
    if m=='ー': return [prev_tokens[-1]] if prev_tokens else []
    r = ''.join(i['hepburn'] for i in kk.convert(m)).lower()
    r = re.sub(r'[^a-z]', '', r.replace('ā','a').replace('ī','i').replace('ū','u').replace('ē','e').replace('ō','o'))
    if m=='ん': r='n'
    return list(r)

def build_unit_moras(units):
    """给每个单元生成 [(mora, [tokens])]；返回平铺列表 + 单元→mora 索引区间"""
    flat=[]; span=[]
    for disp, ruby in units:
        if ruby: ms = moras(ruby)
        elif re.fullmatch(r'[ぁ-んァ-ヶー]', disp): ms = moras(disp)
        elif re.fullmatch(r'[A-Za-z]', disp): ms=[disp.lower()]
        else: ms=[]
        s=len(flat)
        for m in ms:
            if re.fullmatch(r'[a-z]', m): toks=[m]
            else: toks = mora_tokens(m, flat[-1][1] if flat else [])
            flat.append((m, toks))
        span.append((s, len(flat)))
    return flat, span

if __name__=='__main__':
    dev='cuda'
    model = B.get_model(with_star=False).to(dev).eval(); labels=B.get_labels(); lid={c:i for i,c in enumerate(labels)}
    wav, sr = sf.read('work/vocals16k.wav', dtype='float32'); assert sr==16000
    wav = torch.from_numpy(wav)[None]
    with torch.inference_mode():
        em,_ = model(wav.to(dev)); em = torch.log_softmax(em,-1)[0].cpu()    # (T, C)
    fps = em.shape[0] / (wav.shape[1]/16000)            # 约 50 帧/秒
    cues = parse(); outc=[]
    for c in cues:
        units = split_units(c['text'])
        flat, span = build_unit_moras(units)
        toks=[(mi,t) for mi,(m,ts_) in enumerate(flat) for t in ts_]
        pad=0.35; f0=max(0,int((c['start']-pad)*fps)); f1=min(em.shape[0], int((c['end']+pad)*fps)+1)
        rec=dict(c); rec['units']=[]; rec['score']=None
        if toks and f1-f0 > len(toks):
            tgt = torch.tensor([[lid[t] for _,t in toks]], dtype=torch.int32)
            try:
                al, sc = torchaudio.functional.forced_align(em[f0:f1][None], tgt, blank=0)
                al, sc = al[0], sc[0].exp()
                # 展开每个 token 的起止帧
                spans = torchaudio.functional.merge_tokens(al, sc)
                assert len(spans)==len(toks)
                m_t0={}; m_t1={}
                for (mi,_),s in zip(toks,spans):
                    m_t0.setdefault(mi,(f0+s.start)/fps); m_t1[mi]=(f0+s.end)/fps
                rec['score']=float(sum(s.score for s in spans)/len(spans))
                # 无 token 的拍（っ/ー 无前音）：挂到邻拍边界
                for mi in range(len(flat)):
                    if mi not in m_t0:
                        pv = m_t1.get(mi-1); nx = m_t0.get(mi+1, pv)
                        m_t0[mi]=m_t1[mi]=pv if pv is not None else nx
                for (disp,ruby),(a,b) in zip(units,span):
                    if b>a: rec['units'].append(dict(t=disp, r=ruby, t0=round(m_t0[a],3), t1=round(m_t1[b-1],3)))
                    else:   rec['units'].append(dict(t=disp, r=ruby, t0=None, t1=None))
            except Exception as e:
                rec['err']=repr(e)[:120]
        if not rec['units']:     # 兜底：整句等分
            n=len(units); d=(c['end']-c['start'])/max(n,1)
            rec['units']=[dict(t=u[0], r=u[1], t0=round(c['start']+i*d,3), t1=round(c['start']+(i+1)*d,3)) for i,u in enumerate(units)]
            rec['fallback']=True
        outc.append(rec)
    json.dump(outc, open('lyrics_aligned.json','w',encoding='utf-8'), ensure_ascii=False, indent=1)
    bad=[(r['id'],r['text'],r.get('score'),r.get('err')) for r in outc if r.get('fallback') or (r['score'] or 0)<0.5]
    print(len(outc),'cues; low/fallback:',len(bad))
    for b in bad: print(b)
