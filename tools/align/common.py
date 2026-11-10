"""Shared helpers for the forced-alignment tools (separate.py / align.py).

Nothing in this module imports torch at import time, so the pure-Python parts
(SRT parsing, splitting a lyric line into display units + readings, building the
alignment tokens) can be used and tested without a GPU stack.

Output unit format (what the Karaoke Lyrics Studio imports):
    {"t": "字", "r": "じ" | null, "t0": 1.234, "t1": 1.456}
"""
import importlib
import re
import shutil
import sys
import unicodedata

# --------------------------------------------------------------------------
# dependency / environment helpers
# --------------------------------------------------------------------------

def die(msg, code=1):
    print('error: ' + msg, file=sys.stderr)
    sys.exit(code)


def need(module, pip_name=None, why=''):
    """Import `module` or exit with a clear installation hint."""
    try:
        return importlib.import_module(module)
    except ImportError:
        pip_name = pip_name or module
        extra = ' (needed for %s)' % why if why else ''
        die("Python package '%s' is not installed%s.\n"
            "       Install it with:  pip install %s\n"
            "       or everything at once:  pip install -r requirements.txt" % (module, extra, pip_name))


def need_ffmpeg():
    exe = shutil.which('ffmpeg')
    if not exe:
        die("'ffmpeg' was not found on PATH. Install it from https://ffmpeg.org/ and make sure "
            "`ffmpeg -version` works in this terminal.")
    return exe


def pick_device(torch, wanted='auto'):
    """'auto' -> cuda if available, else cpu (with a warning)."""
    if wanted == 'auto':
        if torch.cuda.is_available():
            return 'cuda'
        print('warning: CUDA is not available, running on CPU (much slower). '
              'Install a CUDA build of torch for GPU speed.', file=sys.stderr)
        return 'cpu'
    if wanted == 'cuda' and not torch.cuda.is_available():
        die("--device cuda was requested but torch.cuda.is_available() is False.")
    return wanted


# --------------------------------------------------------------------------
# SRT
# --------------------------------------------------------------------------

_TS = re.compile(r'(\d+):(\d+):(\d+)[,.](\d+)')


def _ts(s):
    m = _TS.search(s)
    if not m:
        raise ValueError('bad SRT timestamp: %r' % s)
    h, mi, sec, frac = m.groups()
    return int(h) * 3600 + int(mi) * 60 + int(sec) + int(frac.ljust(3, '0')[:3]) / 1000


def parse_srt(path):
    """-> [{id, start, end, text}]   (multi-line cues are joined with a space)"""
    try:
        raw = open(path, encoding='utf-8-sig').read()
    except OSError as e:
        die('cannot read SRT file: %s' % e)
    cues = []
    for blk in re.split(r'\n\s*\n', raw.replace('\r\n', '\n').replace('\r', '\n').strip()):
        lines = blk.strip().splitlines()
        if len(lines) < 3 or '-->' not in lines[1]:
            continue
        a, b = lines[1].split('-->')[:2]
        try:
            cid = int(lines[0].strip())
        except ValueError:
            cid = len(cues) + 1
        cues.append(dict(id=cid, start=_ts(a), end=_ts(b), text=' '.join(lines[2:]).strip()))
    if not cues:
        die('no cues found in %s (is it a valid .srt file?)' % path)
    return cues


# --------------------------------------------------------------------------
# character classes / small utilities
# --------------------------------------------------------------------------

def is_kanji(c):
    return '一' <= c <= '鿿' or c in '々〆'


def is_cjk(c):
    return '一' <= c <= '鿿'


def is_kana(c):
    return '぀' <= c <= 'ヿ'


def kata2hira(s):
    return ''.join(chr(ord(c) - 0x60) if 'ァ' <= c <= 'ヶ' else c for c in s)


_kks = None


def kakasi():
    """Lazy pykakasi instance (only Japanese lines need it)."""
    global _kks
    if _kks is None:
        pk = need('pykakasi', 'pykakasi', 'Japanese readings')
        _kks = pk.kakasi()
    return _kks


# --------------------------------------------------------------------------
# Japanese: display units with furigana, then moras -> romaji tokens
# --------------------------------------------------------------------------

def split_units_ja(text):
    """-> [(display, ruby|None)]
    A kanji block gets its reading (hiragana) as ruby; every other character is its own unit.
    Okurigana (kana following a kanji block) is used to anchor where the kanji reading ends.
    Special case: `漢字（カタカナ）` uses the katakana in the brackets as the ruby."""
    kk = kakasi()
    m = re.fullmatch(r'(.*?)([一-鿿々〆]+)（([ァ-ヶー]+)）(.*)', text)
    pre = post = ''
    forced = None
    if m:
        pre, kan, kat, post = m.groups()
        forced = (kan, kat)
    out = []

    def run(s):
        for it in kk.convert(s):
            o, h = it['orig'], it['hira']
            parts = re.findall(r'[一-鿿々〆]+|[^一-鿿々〆]+', o)
            if not any(is_kanji(p[0]) for p in parts):
                out.extend((c, None) for c in o)
                continue
            pat = ''.join('(.+?)' if is_kanji(p[0]) else re.escape(kata2hira(p)) for p in parts)
            mm = re.fullmatch(pat, h)
            if not mm:
                out.append((o, h))
                continue
            g = iter(mm.groups())
            for p in parts:
                if is_kanji(p[0]):
                    out.append((p, next(g)))
                else:
                    out.extend((c, None) for c in p)

    if forced:
        run(pre)
        out.append((forced[0], forced[1]))   # keep the katakana as ruby
        run(post)
    else:
        run(text)
    return out


_SMALL = set('ゃゅょぁぃぅぇぉゎ')


def moras(kana):
    """kana string -> list of moras; small kana join the previous mora; ー/っ/ん are their own."""
    k = kata2hira(kana)
    res = []
    for c in k:
        if c in _SMALL and res:
            res[-1] += c
        else:
            res.append(c)
    return res


def mora_tokens(m, prev_tokens):
    """One mora -> list of romaji letters used as alignment tokens (っ -> none, ー -> repeat previous vowel)."""
    if m == 'っ':
        return []
    if m == 'ー':
        return [prev_tokens[-1]] if prev_tokens else []
    kk = kakasi()
    r = ''.join(i['hepburn'] for i in kk.convert(m)).lower()
    r = re.sub(r'[^a-z]', '', r.replace('ā', 'a').replace('ī', 'i').replace('ū', 'u').replace('ē', 'e').replace('ō', 'o'))
    if m == 'ん':
        r = 'n'
    return list(r)


def build_unit_moras(units):
    """-> (flat [(mora, [tokens])], span [(first_mora_idx, end_mora_idx)] per unit)"""
    flat = []
    span = []
    for disp, ruby in units:
        if ruby:
            ms = moras(ruby)
        elif re.fullmatch(r'[ぁ-んァ-ヶー]', disp):
            ms = moras(disp)
        elif re.fullmatch(r'[A-Za-z]', disp):
            ms = [disp.lower()]
        else:
            ms = []
        s = len(flat)
        for m in ms:
            if re.fullmatch(r'[a-z]', m):
                toks = [m]
            else:
                toks = mora_tokens(m, flat[-1][1] if flat else [])
            flat.append((m, toks))
        span.append((s, len(flat)))
    return flat, span


# --------------------------------------------------------------------------
# Other languages: Latin / Cyrillic words, Chinese via pinyin
# --------------------------------------------------------------------------

_CYR = dict(zip('абвгдежзийклмнопрстуфхцчшщъыьэюяё',
                ['a', 'b', 'v', 'g', 'd', 'e', 'zh', 'z', 'i', 'y', 'k', 'l', 'm', 'n', 'o', 'p', 'r', 's', 't', 'u',
                 'f', 'kh', 'ts', 'ch', 'sh', 'sch', '', 'y', '', 'e', 'yu', 'ya', 'yo']))


def roman(ch):
    """One character -> romanised letters a-z (accents stripped, Cyrillic transliterated)."""
    c = ch.lower()
    c = {'œ': 'oe', 'æ': 'ae', 'ß': 'ss'}.get(c, c)
    if c in _CYR:
        return _CYR[c]
    n = ''.join(x for x in unicodedata.normalize('NFKD', c) if not unicodedata.combining(x))
    return re.sub('[^a-z]', '', n)


# --------------------------------------------------------------------------
# One lyric line -> a "plan": display units + alignment tokens
# --------------------------------------------------------------------------

class Plan:
    """units:  [(display, ruby|None)]
    kind:   'mora' (Japanese: tokens belong to moras) or 'word' (tokens belong to word/char groups)
    tokens: [(key, letter)]  key = mora index ('mora') or group index ('word')
    mora kind: moras = flat mora list, span = per-unit (first, end) mora indices
    word kind: groups = [([unit indices], [letters])]"""

    def __init__(self, units, kind, tokens, moras=None, span=None, groups=None):
        self.units, self.kind, self.tokens = units, kind, tokens
        self.moras, self.span, self.groups = moras, span, groups


def lang_of(text, lang='auto'):
    """'ja' | 'zh' | 'other' for one cue. lang='ja' forces Japanese, lang='other' never picks Japanese."""
    if lang == 'ja':
        return 'ja'
    if lang == 'auto' and any(is_kana(c) for c in text):
        return 'ja'
    if any(is_cjk(c) for c in text):
        return 'zh'
    return 'other'


def plan_cue(text, lang='auto'):
    kind = lang_of(text, lang)
    if kind == 'ja':
        units = split_units_ja(text)
        flat, span = build_unit_moras(units)
        toks = [(mi, t) for mi, (_m, tk) in enumerate(flat) for t in tk]
        return Plan(units, 'mora', toks, moras=flat, span=span)
    if kind == 'zh':
        pp = need('pypinyin', 'pypinyin', 'Chinese lines')
        units = [(c, None) for c in text]        # no ruby for Chinese; pinyin is only used for alignment
        groups = []
        for i, c in enumerate(text):
            if is_cjk(c):
                groups.append(([i], list(re.sub('[^a-z]', '', pp.lazy_pinyin(c)[0].replace('ü', 'u')))))
    else:                                         # French / English / Russian ...: one group per word
        units = []
        groups = []
        for w in re.split(r'( +)', text):
            if not w:
                continue
            idx = list(range(len(units), len(units) + len(w)))
            units += [(c, None) for c in w]
            if w.strip():
                toks = [t for c in w for t in roman(c)]
                if toks:
                    groups.append((idx, toks))
    toks = [(gi, t) for gi, (_ix, tk) in enumerate(groups) for t in tk]
    return Plan(units, 'word', toks, groups=groups)


# --------------------------------------------------------------------------
# aligned token times -> per-unit times
# --------------------------------------------------------------------------

def units_from_alignment(plan, toks, spans, cue_start):
    """toks: the (key, letter) list that was actually aligned; spans: [(t0, t1, score)] in seconds, same length.
    -> (units [{t, r, t0, t1}], mean score)"""
    k0, k1 = {}, {}
    for (key, _), (a, b, _s) in zip(toks, spans):
        k0.setdefault(key, a)
        k1[key] = b
    score = float(sum(s for _a, _b, s in spans) / len(spans))
    out = []
    if plan.kind == 'mora':
        # moras without a token (っ, leading ー) are attached to the boundary of the neighbouring mora
        for mi in range(len(plan.moras)):
            if mi not in k0:
                pv = k1.get(mi - 1)
                nx = k0.get(mi + 1, pv)
                v = pv if pv is not None else nx
                k0[mi] = k1[mi] = v if v is not None else cue_start
        for (disp, ruby), (a, b) in zip(plan.units, plan.span):
            if b > a:
                out.append(dict(t=disp, r=ruby, t0=round(k0[a], 3), t1=round(k1[b - 1], 3)))
            else:
                out.append(dict(t=disp, r=ruby, t0=None, t1=None))
        return out, score
    # word kind: a word ends where the next one starts (if close), otherwise a short tail after its last letter;
    # its characters share the span evenly
    T = [[None, None] for _ in plan.units]
    gis = sorted(k0)
    for n, gi in enumerate(gis):
        nxt = k0[gis[n + 1]] if n + 1 < len(gis) else None
        e = nxt if (nxt is not None and nxt - k1[gi] < 0.35) else k1[gi] + 0.15
        e = max(e, k0[gi] + 0.04)
        ix = plan.groups[gi][0]
        k = len(ix)
        for j, ui in enumerate(ix):
            T[ui] = [k0[gi] + (e - k0[gi]) * j / k, k0[gi] + (e - k0[gi]) * (j + 1) / k]
    prev = cue_start
    for i in range(len(plan.units)):
        if T[i][0] is None:
            T[i] = [prev, prev]
        prev = T[i][1]
    return [dict(t=d, r=r, t0=round(T[i][0], 3), t1=round(T[i][1], 3)) for i, (d, r) in enumerate(plan.units)], score


def even_split(plan, cue):
    """Last-resort timing: spread the units evenly over the SRT cue time."""
    n = len(plan.units)
    d = (cue['end'] - cue['start']) / max(n, 1)
    return [dict(t=u[0], r=u[1], t0=round(cue['start'] + i * d, 3), t1=round(cue['start'] + (i + 1) * d, 3))
            for i, u in enumerate(plan.units)]


def first_onset_offset(rec):
    """Aligned start of the first visible unit minus the SRT start (None if it has no timed unit)."""
    for u in rec['units']:
        if u['t'].strip() and u['t0'] is not None:
            return u['t0'] - rec['start']
    return None
