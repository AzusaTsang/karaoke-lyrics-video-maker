/* 数据模型 / 撤销重做 / 事件 / 工程读写 */
(function () {
  const K = (window.K = {});

  K.DEF = {
    font: "'Yu Gothic UI', 'Meiryo', 'Microsoft YaHei', sans-serif", weight: 'bold',
    size: 84, rubyRatio: 0.42, rubyGap: 6, spacing: 0, lineGap: 0.35,
    baseFill: '#ffffff', baseStroke: '#1b3a8a', highFill: '#ffd84d', highStroke: '#a14a00',
    rubyFill: '#ffffff', rubyStroke: '#1b3a8a', rubyHighFill: '#ffd84d', rubyHighStroke: '#a14a00',
    strokeW: 8, rubyStrokeW: 4, glow: 0, glowColor: '#4aa3ff',
    W: 1920, H: 1080, posY: 0.7, maxW: 0.92, layout: 'duet', marginX: 0.06, rows: 2, preShow: 6,
    dots: true, paraGap: 4, dotsDur: 3, dotSize: 0.36, dotFill: '', dotHighFill: '', dotPos: 'top', wrapGap: 0.3,
    lead: 0.6, hold: 0.5, fadeIn: 0.2, fadeOut: 0.25, offset: 0,
    bgMode: 'transparent', bgColor: '#101820', keyColor: '#00ff00', useVideoBg: false, fps: 60,
  };

  /* 设置项的合法范围 / 取值（读工程文件、界面输入时都用它清洗，未知项丢弃） */
  K.RANGE = {
    size: [4, 1000], rubyRatio: [0, 2], rubyGap: [-500, 500], spacing: [-200, 500], lineGap: [-1, 5],
    strokeW: [0, 200], rubyStrokeW: [0, 200], glow: [0, 500], W: [16, 7680, 1], H: [16, 7680, 1], posY: [-1, 2], maxW: [0.05, 1],
    marginX: [0, 0.5], preShow: [0, 60], paraGap: [0, 120], dotsDur: [0, 30], dotSize: [0.01, 3], wrapGap: [-0.5, 5],
    lead: [0, 30], hold: [0, 30], fadeIn: [0, 10], fadeOut: [0, 10], offset: [-60, 60],
  };
  K.ENUM = { weight: ['normal', 'bold', '900'], layout: ['duet', 'stack'], bgMode: ['transparent', 'color'], dotPos: ['top', 'left'], rows: [1, 2, 3], fps: [24, 25, 30, 50, 60] };
  const COLOR_RE = /^#[0-9a-f]{6}$/i;
  /* 可以留空的颜色（'' = 跟随歌词颜色）：预备点的未唱 / 正在倒数颜色 */
  const OPT_COLOR = new Set(['dotFill', 'dotHighFill']);
  /* 返回清洗后的值；不合法时返回 undefined（调用方回退默认值） */
  K.cleanSetting = (k, v) => {
    const d = K.DEF[k];
    if (d === undefined) return undefined;
    if (K.ENUM[k]) { const e = K.ENUM[k].find((x) => String(x) === String(v)); return e; }
    if (OPT_COLOR.has(k)) return v === '' ? '' : typeof v === 'string' && COLOR_RE.test(v) ? v.toLowerCase() : undefined;
    if (typeof d === 'boolean') return typeof v === 'string' ? v === 'true' || v === '1' : !!v;
    if (typeof d === 'number') {
      v = typeof v === 'string' && v.trim() !== '' ? +v : v;
      if (typeof v !== 'number' || !isFinite(v)) return undefined;
      const r = K.RANGE[k]; if (r) { v = Math.max(r[0], Math.min(r[1], v)); if (r[2]) v = Math.round(v); }
      return v;
    }
    if (COLOR_RE.test(d)) return typeof v === 'string' && COLOR_RE.test(v) ? v.toLowerCase() : undefined;
    if (k === 'font') { if (typeof v !== 'string') return undefined; v = v.replace(/[\u0000-\u001f<>{};\\]/g, '').slice(0, 300).trim(); return v || undefined; }
    return typeof v === 'string' ? v : undefined;
  };
  K.cleanSettings = (src) => {
    const S = Object.assign({}, K.DEF);
    if (src && typeof src === 'object') Object.keys(K.DEF).forEach((k) => { if (Object.prototype.hasOwnProperty.call(src, k)) { const v = K.cleanSetting(k, src[k]); if (v !== undefined) S[k] = v; } });
    return S;
  };
  /* ---------- 行的局部属性：l.o = { 键: 值 }，没写的键 = 用全局设置 ----------
     LSTYLE：可以按行覆盖的全局设置（字体 / 字号 / 颜色 / 描边 / 注音 / 最大宽度 / 行内换行间距 / 预备点）；
     LPOS：只属于行的位置属性：dx / dy = 位置偏移（画布宽 / 高的比例，换画布尺寸也不走样），grow = 换行后的多行往哪边长 */
  K.LSTYLE = ['font', 'weight', 'size', 'spacing', 'maxW', 'wrapGap', 'strokeW', 'glow', 'glowColor', 'baseFill', 'highFill', 'baseStroke', 'highStroke',
    'rubyRatio', 'rubyGap', 'rubyFill', 'rubyHighFill', 'rubyStroke', 'rubyHighStroke', 'rubyStrokeW', 'dotsDur', 'dotSize', 'dotFill', 'dotHighFill', 'dotPos'];
  K.LPOS = ['dx', 'dy', 'grow'];
  K.LKEYS = K.LSTYLE.concat(K.LPOS);
  K.LDEF = { dx: 0, dy: 0, grow: 'auto' };
  K.GROW = ['auto', 'up', 'down', 'center'];
  /* 清洗一个行属性；undefined = 不合法或等于“不覆盖”（dx / dy 为 0、grow 为 auto） */
  K.cleanLineSetting = (k, v) => {
    if (k === 'dx' || k === 'dy') { v = typeof v === 'string' && v.trim() !== '' ? +v : v; return typeof v === 'number' && isFinite(v) && v !== 0 ? Math.max(-1, Math.min(1, v)) : undefined; }
    if (k === 'grow') return K.GROW.includes(v) && v !== 'auto' ? v : undefined;
    return K.LSTYLE.includes(k) ? K.cleanSetting(k, v) : undefined;
  };
  /* 清洗整个覆盖对象：未知键、不合法的值丢掉，键按 LKEYS 的顺序（读写往返一致）；什么都不剩返回 null */
  K.cleanOverrides = (src) => {
    if (!src || typeof src !== 'object' || Array.isArray(src)) return null;
    const o = {};
    K.LKEYS.forEach((k) => { if (Object.prototype.hasOwnProperty.call(src, k)) { const v = K.cleanLineSetting(k, src[k]); if (v !== undefined) o[k] = v; } });
    return Object.keys(o).length ? o : null;
  };
  /* 设 / 清（v == null）一个行属性；空了就把 l.o 整个删掉。不 commit */
  K.setOv = (l, k, v) => {
    const o = Object.assign({}, l.o); if (v == null) delete o[k]; else o[k] = v;
    const c = K.cleanOverrides(o); if (c) l.o = c; else delete l.o;
  };
  K.hasOv = (l) => !!(l && l.o && Object.keys(l.o).length);
  /* 一行的有效设置：没有覆盖时就是全局设置对象本身（和以前完全一样）；有覆盖时按 K.rev 缓存合并结果（含 LDEF） */
  const lsCache = new WeakMap();
  K.LS = (l) => {
    if (!K.hasOv(l)) return K.S();
    const c = lsCache.get(l); if (c && c.rev === K.rev && c.S === K.project.settings && c.o === l.o) return c.E;
    const E = Object.assign({}, K.LDEF, K.S(), l.o); lsCache.set(l, { rev: K.rev, S: K.project.settings, o: l.o, E }); return E;
  };
  /* HTML 转义：所有拼进 innerHTML 的值（包括属性值）都要过一遍 */
  K.esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));

  K.project = null;
  K.rev = 0;               // 任何改动都会 +1，用于失效缓存
  K.inv = 0;               // 不改数据、但画面需要重画时 +1（语言、媒体帧、波形…）
  K.invalidate = () => { K.inv++; };
  K.dirty = false;
  K.ui = { sel: null, tool: 'retime', tapIdx: 0 };
  K.S = () => K.project.settings;

  /* ---------- 事件 ---------- */
  /* K.on 返回取消订阅函数；也可以 K.off(事件, 同一个函数)。emit 时先复制列表，回调里取消订阅也安全 */
  const handlers = {};
  K.off = (e, f) => { const a = handlers[e], i = a ? a.indexOf(f) : -1; if (i >= 0) a.splice(i, 1); };
  K.on = (e, f) => { (handlers[e] = handlers[e] || []).push(f); return () => K.off(e, f); };
  K.emit = (e, a) => (handlers[e] || []).slice().forEach((f) => f(a));

  /* 界面偏好（工具、缩放、时间线高度、速度、标签页、音量…）：和工程数据分开存；读出来的值不可信，使用处自行校验 */
  const PK = 'karaoke-studio:prefs';
  K.prefs = (() => { try { const j = JSON.parse(localStorage.getItem(PK) || '{}'); return j && typeof j === 'object' && !Array.isArray(j) ? j : {}; } catch (e) { return {}; } })();
  K.pref = (k, v) => { if (v === undefined) return K.prefs[k]; K.prefs[k] = v; try { localStorage.setItem(PK, JSON.stringify(K.prefs)); } catch (e) {} return v; };
  K.prefNum = (k, lo, hi, d) => { const v = K.prefs[k]; return typeof v === 'number' && isFinite(v) ? Math.max(lo, Math.min(hi, v)) : d; };

  /* ---------- 行 / 单元 ---------- */
  let idSeq = 1;
  K.newId = () => 'L' + Date.now().toString(36) + (idSeq++).toString(36);
  K.ls = (l) => (l.units.length ? l.units[0].s : l.end);          // 行开始（第一个字开始唱）
  /* 一个字一直擦到下一个字开始（最后一个字擦到行结束），长音会慢慢滑过去 */
  K.unitEnd = (l, i) => {
    const u = l.units[i], n = l.units[i + 1];
    return Math.max(n ? n.s : l.end, u.s + 0.02);
  };
  /* 注音按“拍”细分：小假名并入前一拍。带注音的字可以按拍单独定时（u.m = 第 2 拍起各拍的开始时间） */
  K.moras = (r) => { const out = []; for (const c of r || '') { if (/[ゃゅょぁぃぅぇぉゎャュョァィゥェォヮ]/.test(c) && out.length) out[out.length - 1] += c; else out.push(c); } return out; };
  K.nMora = (u) => (u.r ? Math.max(1, K.moras(u.r).length) : 1);
  /* 一个字内部的时间节点：[开始, 第2拍, …, 结束]，没有手动定时就平均分 */
  K.subTimes = (l, i) => {
    const u = l.units[i], n = K.nMora(u), e = K.unitEnd(l, i), T = [u.s];
    for (let j = 1; j < n; j++) T.push(u.m && u.m.length === n - 1 ? Math.min(e, Math.max(u.s, u.m[j - 1])) : u.s + ((e - u.s) * j) / n);
    T.push(e); return T;
  };
  /* ---------- 定时组：拉丁 / 西里尔 / 希腊字母按音节，其余（假名、汉字、带注音的字…）一个字一组 ----------
     词 = 连续的字母 / 数字单元（无注音），词中间的 ' ’ - 也算；词后面的空格、标点跟着词的最后一个音节走（不单独定时）。
     组：{i: 第一个单元, c: 音节字母的结尾, e: 含尾随空格标点的结尾, w: 是否字母音节, f: 是否词的第一个音节} */
  const sounding = (u) => /[^\s\p{P}]/u.test(u.t);
  const AL = '\\p{Script=Latin}\\p{Script=Cyrillic}\\p{Script=Greek}\\p{Nd}';
  const ALPHA = new RegExp(`^[${AL}][${AL}\\p{M}]*$`, 'u'), MARK = /^\p{M}+$/u, JOIN = /^['’‐‑-]$/, HYPH = /^[‐‑-]$/;
  const isA = (u) => !!u && !u.r && ALPHA.test(u.t), isM = (u) => !!u && !u.r && MARK.test(u.t), isJ = (u) => !!u && !u.r && JOIN.test(u.t);
  K.isLetter = isA;
  /* i 开始的词的结尾（不含尾随空格标点）；i 不是词的开头返回 0。行内换行（u.n）处词一定断开 = 强制新音节 */
  const wordEnd = (U, i) => {
    if (!isA(U[i])) return 0;
    let j = i + 1;
    for (;;) { if (U[j] && U[j].n) return j; if (isA(U[j]) || isM(U[j])) j++; else if (isJ(U[j]) && isA(U[j + 1]) && !U[j + 1].n) j += 2; else return j; }
  };
  const VOW = 'aeiouyæœøɑəɛɔɪʊаеёиоуыэюяіїєαεηιουω';
  const ONSET = new Set('bl br cl cr dr fl fr gl gr kl kr pl pr tr vr ch ph th sh gh gn qu wh kh zh бр бл вр гр гл др кр кл пр пл тр фр фл хр хл πρ τρ κρ γρ βρ δρ φρ θρ χρ πλ κλ γλ βλ φλ χλ'.split(' '));
  const base = (ch) => (/[йў]/.test(ch) ? ch : ch.normalize('NFD').replace(/\p{M}/gu, '')[0] || ch);
  /* 自动分音节：元音连在一起 = 一个音节核；两个核之间一个辅音归后一个音节，多个辅音时最后一个归后面（辅音+l/r、ch、ph、th、gn、qu、sh… 这些不拆开）；
     ' 跟着前面的字母，- 结束一个音节；没有元音的部分并进相邻部分；数字一串算一组。返回音节开头的单元下标（raw = 不看手动覆盖 u.k） */
  const sylStarts = (U, a, b, raw) => {
    const L = [], K0 = [];
    for (let x = a; x < b; x++) {
      const u = U[x], t = u.t.toLowerCase();
      const c = isJ(u) ? (HYPH.test(u.t) ? 'H' : 'J') : isM(u) ? 'M' : /^\p{Nd}/u.test(t) ? 'D' : [...t].some((ch) => VOW.includes(base(ch))) ? 'V' : 'C';
      L.push(c); K0.push(base([...t][0]));
    }
    const nb = (x, d) => { for (x += d; x >= 0 && x < L.length && L[x] === 'M'; x += d); return x; };
    for (let x = 0; x < L.length; x++) if (K0[x] === 'u' && L[x] === 'V' && K0[nb(x, -1)] === 'q') L[x] = 'C';            // qu
    const yv = L.map((c, x) => c === 'V' && K0[x] === 'y' && [nb(x, -1), nb(x, 1)].some((q) => L[q] === 'V' && K0[q] !== 'y'));
    yv.forEach((v, x) => { if (v) L[x] = 'C'; });                                                                        // y 挨着元音 = 辅音
    /* 按连字符、字母 / 数字的交界切成几段 */
    const parts = []; let ps = 0, kind = null;
    for (let x = 0; x < L.length; x++) {
      const k = L[x] === 'D' ? 'D' : L[x] === 'V' || L[x] === 'C' ? 'A' : null;
      if (x > ps && (L[x - 1] === 'H' || (k && kind && k !== kind))) { parts.push([ps, x, kind]); ps = x; kind = null; }
      if (k && !kind) kind = k;
    }
    parts.push([ps, L.length, kind]);
    const st = [];
    parts.forEach(([p, q, k]) => {
      const S = [p];
      if (k === 'A') {
        const nuc = []; let x = p;
        while (x < q) { if (L[x] !== 'V') { x++; continue; } let y = x + 1; while (y < q && (L[y] === 'V' || L[y] === 'M')) y++; nuc.push([x, y]); x = y; }
        if (!nuc.length) S.vowelless = true;
        for (let n = 1; n < nuc.length; n++) {
          const cs = []; for (let y = nuc[n - 1][1]; y < nuc[n][0]; y++) if (L[y] === 'C') cs.push(y);
          let br = nuc[n][0];
          if (cs.length === 1) br = cs[0];
          else if (cs.length > 1) { const c1 = cs[cs.length - 2], c2 = cs[cs.length - 1]; br = nb(c1, 1) === c2 && ONSET.has(K0[c1] + K0[c2]) ? c1 : c2; }
          S.push(br);
        }
      }
      st.push(S);
    });
    /* 没有元音的字母段不能单独成音节：并进后一段（最后一段并进前一段） */
    for (let n = 0; n < st.length && st.length > 1; n++) if (st[n].vowelless) { if (n + 1 < st.length) st[n + 1][0] = st[n][0]; else st[n - 1].push(...st[n].slice(1)); st.splice(n, 1); n--; }
    const set = new Set(st.flat().map((x) => x + a));
    if (!raw) for (let x = a + 1; x < b; x++) { const k = U[x].k; if (k === 1) set.add(x); else if (k === 0) set.delete(x); }
    set.add(a);
    return [...set].sort((p, q) => p - q);
  };
  K.groups = (l, raw) => {
    const U = l.units, n = U.length, G = []; let i = 0;
    while (i < n) {
      const w = wordEnd(U, i);
      if (!w) { G.push({ i, c: i + 1, e: i + 1, w: 0, f: 0 }); i++; continue; }
      let e = w; while (e < n && !U[e].n && !U[e].r && !sounding(U[e])) e++;          // 尾随空格标点不越过换行
      const st = sylStarts(U, i, w, raw);
      st.forEach((s, x) => { const nx = st[x + 1]; G.push({ i: s, c: nx || w, e: nx || e, w: 1, f: x ? 0 : 1 }); });
      i = e;
    }
    return G;
  };
  K.gText = (l, g) => l.units.slice(g.i, g.c).map((u) => u.t).join('');
  /* 边界的显示名：字 / 「拍」/ 音节（附上整个词，音节之间用 · 隔开） */
  K.boundName = (l, b) => {
    const un = l.units[b.i];
    if (b.j) return K.t('tip.charMora', { c: un.t, n: b.j + 1, m: K.moras(un.r)[b.j] || '' });
    const G = K.groups(l), x = G.findIndex((g) => g.i === b.i), g = G[x];
    if (!g || !g.w) return K.t('tip.char', { c: un.t });
    let a = x; while (!G[a].f) a--;
    let z = x + 1; while (z < G.length && G[z].w && !G[z].f) z++;
    return z - a > 1 ? K.t('tip.syl', { s: K.gText(l, g), w: G.slice(a, z).map((q) => K.gText(l, q)).join('·') }) : K.t('tip.char', { c: K.gText(l, g) });
  };
  /* 所有可定时的边界：[{i: 组的第一个单元, j: 字内第几拍}]。字母按音节，带注音的字按拍 */
  K.bounds = (l) => { const B = []; K.groups(l).forEach((g) => { for (let j = 0, n = g.w ? 1 : K.nMora(l.units[g.i]); j < n; j++) B.push({ i: g.i, j }); }); return B; };
  K.boundTime = (l, b) => K.subTimes(l, b.i)[b.j];
  /* 把组 g 内部的单元（音节里第 2 个起的字母、词后的空格标点）在 [S, N] 内按“有发音的字”平均分配；行尾那组的尾随标点也占一份 */
  const spread = (l, g, S, N, last) => {
    const U = l.units; let n = 0;
    for (let x = g.i; x < g.e; x++) if (sounding(U[x])) n++;
    if (last && !sounding(U[g.e - 1])) n++;
    const d = (N - S) / Math.max(1, n); let k = 0;
    for (let x = g.i; x < g.e; x++) { if (x > g.i) U[x].s = S + k * d; if (sounding(U[x])) k++; }
  };
  /* 行尾那组：内部单元至少比行结束早 0.05 秒（fixLine 的规则），否则按比例收进去，免得行结束被顶后 */
  const fitLast = (l, g) => {
    const U = l.units, S = U[g.i].s, lim = l.end - 0.05, lst = U[g.e - 1].s;
    if (g.e - g.i > 1 && lst > lim && lst > S) { const f = Math.max(0, lim - S) / (lst - S); for (let x = g.i + 1; x < g.e; x++) U[x].s = S + (U[x].s - S) * f; }
  };
  const GAP = 0.03;
  /* 行结束离最后一组开头至少多远：0.05 秒；最后一组里还有别的字母 / 标点时再留一个 GAP 给它们 */
  const tailGap = (l, G) => { const g = G[G.length - 1]; return g && g.e - g.i > 1 ? 0.05 + GAP : 0.05; };          // 被硬推的组至少留这么长（在行首 / 行尾之间还有空间的时候）
  /* 把某个边界定在时间 T（i = 单元数 表示行结束）。
     被越过的边界按 GAP 依次推开（空间不够就在可用范围内平均挤），字母音节内部的字母和尾随空格标点按比例跟着新的组区间缩放 */
  K.setBoundary = (l, i, j, T) => {
    const U = l.units, n = U.length, G = K.groups(l), isEnd = i >= n;
    if (!isEnd) { const g = G.find((q) => i >= q.i && i < q.e); if (g && g.i !== i) { i = g.i; j = 0; } }
    const u = U[i];
    if (!isEnd && j > 0) u.m = K.subTimes(l, i).slice(1, K.nMora(u));
    const span = G.map((g, x) => [U[g.i].s, x + 1 < G.length ? U[G[x + 1].i].s : l.end]), olds = U.map((v) => v.s);
    /* 骨架：每组开头 + 有手动拍时间的字的各拍 + 行结束（没手动定过的拍跟着字平均分，不参与推挤） */
    const sk = [];
    G.forEach((g) => { const v = U[g.i]; sk.push({ i: g.i, j: 0 }); if (v.m && !g.w) v.m.forEach((t, q) => sk.push({ i: g.i, j: q + 1 })); });
    sk.push({ i: n, j: 0 });
    const ob = sk.map((x) => (x.i >= n ? l.end : x.j ? K.subTimes(l, x.i)[x.j] : U[x.i].s)), m = sk.length, k = sk.findIndex((x) => x.i === i && x.j === j);
    if (k < 0) return;
    const nt = ob.slice(); nt[k] = T;
    /* 左边：越过 T 的边界往前推 */
    const g0 = isEnd ? tailGap(l, G) : 0;
    if (k > 0 && (isEnd ? ob[k - 1] > T - g0 + 1e-9 : ob[k - 1] >= T - 1e-9)) {
      const c = []; c[k] = T; let p = k;
      for (let q = k - 1; q >= 0; q--) { c[q] = q === k - 1 ? T - Math.max(GAP, g0) : c[q + 1] - GAP; if (q < k - 1 && !(ob[q] > c[q] + 1e-9)) break; p = q; }
      if (p > 0) for (let q = p; q < k; q++) nt[q] = c[q];
      else {                                 // 连行首都要越过：行首不再往前，挤在 [行首, T] 里平均分
        const E = T - g0, F = Math.min(ob[0], E), d = isEnd ? k - 1 : k;
        for (let q = 0; q < k; q++) nt[q] = d ? F + ((E - F) * q) / d : F;
      }
    }
    /* 右边：越过 T 的边界往后推；行结束最多延到 T + 0.05（和以前一样），不够就挤 */
    if (!isEnd) {
      nt[m - 1] = Math.max(ob[m - 1], T + 0.05);
      if (k + 1 < m - 1 && ob[k + 1] <= T + 1e-9) {
        const c = []; c[k] = T; let r = k;
        for (let q = k + 1; q < m - 1; q++) { c[q] = c[q - 1] + GAP; if (q > k + 1 && !(ob[q] < c[q] - 1e-9)) break; r = q; }
        if (r < m - 2 || c[r] + 0.05 <= nt[m - 1] + 1e-9) for (let q = k + 1; q <= r; q++) nt[q] = c[q];
        else { const C = nt[m - 1] - 0.05, d = m - 2 - k; for (let q = k + 1; q <= r; q++) nt[q] = T + ((C - T) * (q - k)) / d; }
      }
    }
    sk.forEach((x, q) => { if (x.i >= n) l.end = nt[q]; else if (x.j) U[x.i].m[x.j - 1] = nt[q]; else U[x.i].s = nt[q]; });
    /* 字母音节内部按比例缩放；原来全挤在一个时刻（或区间短到毫秒分不开）就平均分 */
    G.forEach((g, x) => {
      if (g.e - g.i < 2) return;
      const [oS, oN] = span[x], nS = U[g.i].s, nN = x + 1 < G.length ? U[G[x + 1].i].s : l.end;
      if (Math.abs(oS - nS) < 1e-9 && Math.abs(oN - nN) < 1e-9) return;
      const ins = olds.slice(g.i + 1, g.e), same = ins.every((v) => Math.abs(v - ins[0]) < 1e-6);
      if (oN - oS < 0.001 * (g.e - g.i) || (same && (ins.length > 1 || ins[0] <= oS + 1e-6))) spread(l, g, nS, nN, x === G.length - 1);
      else for (let y = g.i + 1; y < g.e; y++) U[y].s = nS + ((olds[y] - oS) * (nN - nS)) / (oN - oS);
      if (x === G.length - 1) fitLast(l, g);
    });
    K.fixLine(l);
  };
  K.setEnd = (l, T) => K.setBoundary(l, l.units.length, 0, T);
  /* 行结束最早能拖到哪：最后一组开始之后 0.05 秒 */
  K.minEnd = (l) => { const G = K.groups(l); return G.length ? l.units[G[G.length - 1].i].s + tailGap(l, G) : l.end; };
  /* 修复：字母音节内的字母在“音节开头 → 下一组开头”之间平均分（音节开头不动）；
     词里几个音节开头挤在同一时刻时，先把这几个音节在词里按字母数摊开。返回是否有改动 */
  K.evenSyllables = (l) => {
    const U = l.units, before = JSON.stringify(U), G = K.groups(l), st = (x) => (x < G.length ? U[G[x].i].s : l.end);
    const letters = (g) => { let c = 0; for (let x = g.i; x < g.c; x++) if (sounding(U[x])) c++; return Math.max(1, c); };
    for (let a = 0; a < G.length; a++) {
      if (!G[a].w || !G[a].f) continue;
      let z = a + 1; while (z < G.length && G[z].w && !G[z].f) z++;
      const ts = []; for (let x = a; x < z; x++) ts.push(st(x));
      const N = st(z);
      for (let x = 1; x < ts.length;) {
        if (ts[x] > ts[x - 1] + 1e-6) { x++; continue; }
        let p = x - 1, q = x; while (q + 1 < ts.length && ts[q + 1] <= ts[p] + 1e-6) q++;
        const B = q + 1 < ts.length ? ts[q + 1] : N;
        if (B <= ts[p] + 1e-6 && p > 0) p--;
        const A = ts[p], w = []; for (let y = p; y <= q; y++) w.push(letters(G[a + y]));
        const tot = w.reduce((s, v) => s + v, 0); let acc = 0;
        if (B > A + 1e-6) for (let y = p; y <= q; y++) { ts[y] = A + ((B - A) * acc) / tot; acc += w[y - p]; }
        x = q + 1;
      }
      ts.forEach((t, y) => (U[G[a + y].i].s = t));
    }
    G.forEach((g, x) => { if (g.w && g.e - g.i > 1) { spread(l, g, st(x), st(x + 1), x === G.length - 1); if (x === G.length - 1) fitLast(l, g); } });
    K.fixLine(l);
    return JSON.stringify(U) !== before;
  };
  K.lineText = (l) => l.units.map((u) => u.t).join('');
  /* 带行内换行的纯文本：换行处插入 sep；soft = 换行旁边已经有空白时不再插（LRC 用空格代替换行） */
  K.lineJoin = (l, sep, soft) => l.units.map((u, i) => {
    if (!u.n || !i) return u.t;
    return soft && (/\s$/.test(l.units[i - 1].t) || /^\s/.test(u.t)) ? u.t : sep + u.t;
  }).join('');
  K.lineLabel = (l) => K.lineJoin(l, ' ⏎ ');                     // 列表 / 时间线上显示的文字：换行标成 ⏎
  K.nRows = (l) => 1 + l.units.filter((u, i) => i && u.n).length;
  K.r3 = (x) => Math.round(x * 1000) / 1000;
  K.line = (id) => K.project.lines.find((l) => l.id === id) || null;
  K.sel = () => (K.ui.sel ? K.line(K.ui.sel) : null);
  K.select = (id) => { if (K.ui.sel !== id) { K.ui.sel = id; K.ui.tapIdx = 0; K.emit('select'); } };

  /* 保证一行内时间单调、结束时间不早于最后一个字 */
  K.fixLine = (l) => {
    let p = -Infinity;
    l.units.forEach((u) => {
      if (!(u.s >= p)) u.s = p === -Infinity ? 0 : p;
      u.s = K.r3(u.s); p = u.s; delete u.e;
    });
    const last = l.units[l.units.length - 1];
    l.end = K.r3(Math.max(l.end, last ? last.s + 0.05 : l.end));
    /* u.n（行内换行：这个单元开始新的一排）：第一个单元上没有意义；换行两边那一排都要有看得见的字，否则去掉 */
    const vis = (u) => !!(u.r || u.t.trim()), cand = [];
    l.units.forEach((u, i) => { if (!('n' in u)) return; const v = u.n; delete u.n; if ((v === 1 || v === true) && i > 0) cand.push(i); });
    let ks = 0;
    cand.forEach((i, x) => {
      const nx = x + 1 < cand.length ? cand[x + 1] : l.units.length;
      if (l.units.slice(ks, i).some(vis) && l.units.slice(i, nx).some(vis)) { l.units[i].n = 1; ks = i; }
    });
    /* u.k（手动音节：1 = 这里开始新音节，0 = 这里不分）只对词里第 2 个起的字母有意义；放在最后一个键，读写往返时键顺序一致 */
    const U = l.units, inWord = new Set();
    for (let i = 0; i < U.length;) { const w = wordEnd(U, i); if (!w) { i++; continue; } for (let x = i + 1; x < w; x++) if (isA(U[x])) inWord.add(x); i = w; }
    U.forEach((u, i) => { if (!('k' in u)) return; const k = u.k; delete u.k; if ((k === 0 || k === 1) && inWord.has(i)) u.k = k; });
    l.units.forEach((u, i) => {
      if (!u.m) return;
      if (u.m.length !== K.nMora(u) - 1 || !u.m.length) { delete u.m; return; }
      const e = K.unitEnd(l, i); let q = u.s;
      u.m = u.m.map((v) => (q = K.r3(Math.min(e, Math.max(q, v)))));
    });
  };
  K.newLine = (o) => Object.assign({ id: K.newId(), units: [], end: 0, row: null, align: null, newPara: null, dots: null, showAt: null, hideAt: null }, o);

  /* ---------- 文本 <-> 单元（注音语法：漢字{かんじ}；音节分隔：两个字母之间的 | ，如 Fon|taine，不显示；
     行内换行：真正的换行，或者写成两个字符 \n。换行记在下一排第一个单元上：u.n = 1） ---------- */
  const RUBY_RE = /([々〆ヶ一-鿿]+)\{([^{}]*)\}|([\s\S])/gu, ALPHA1 = new RegExp(`^[${AL}]`, 'u');
  K.parseText = (str) => {
    const out = []; let m, brk = false, nl = false; RUBY_RE.lastIndex = 0; str = String(str == null ? '' : str);
    const push = (u) => { if (nl && out.length) u.n = 1; nl = false; out.push(u); };
    while ((m = RUBY_RE.exec(str))) {
      if (m[1]) { push({ t: m[1], r: m[2] || null }); brk = false; continue; }
      const c = m[3];
      if (c === '\n' || (c === '\\' && str[RUBY_RE.lastIndex] === 'n')) { if (c === '\\') RUBY_RE.lastIndex++; nl = true; brk = false; continue; }
      if (c === '\r') continue;
      const pv = out[out.length - 1];
      if (c === '|' && (isA(pv) || isJ(pv) || isM(pv)) && ALPHA1.test(str.slice(RUBY_RE.lastIndex, RUBY_RE.lastIndex + 2))) { brk = true; continue; }
      const u = { t: c, r: null }; if (brk) u.k = 1; brk = false; push(u);
    }
    return out;
  };
  K.unitsToText = (units) => units.map((u, i) => (u.n && i ? '\n' : '') + (u.k === 1 ? '|' : '') + u.t + (u.r ? '{' + u.r + '}' : '')).join('');
  /* 把一行的时间在 [s,e] 内按“有发音的字”平均分配 */
  K.evenSplit = (l, s, e) => {
    s = s == null ? K.ls(l) : s; e = e == null ? l.end : e;
    const n = l.units.filter(sounding).length || 1, d = (e - s) / n; let k = 0;
    l.units.forEach((u) => { u.s = K.r3(s + k * d); delete u.e; delete u.m; if (sounding(u)) k++; });
    l.end = K.r3(e);
  };
  /* 修改文本后尽量保留原有时间：前后缀相同的字保留，中间重新平均 */
  K.retext = (l, str) => {
    const nu = K.parseText(str), old = l.units;
    if (!nu.length) return false;
    const s0 = K.ls(l);
    /* 手动音节：1 写在文本里（|），以文本为准；0（不分）文本表示不了，没改动的字保留 */
    const keep0 = (u, o) => { if (o.k === 0 && o.t === u.t && u.k == null) u.k = 0; };
    if (nu.length === old.length) nu.forEach((u, i) => { u.s = old[i].s; if (old[i].m && old[i].r === u.r) u.m = old[i].m; keep0(u, old[i]); });
    else {
      let p = 0; while (p < nu.length && p < old.length && nu[p].t === old[p].t) p++;
      let q = 0; while (q < nu.length - p && q < old.length - p && nu[nu.length - 1 - q].t === old[old.length - 1 - q].t) q++;
      for (let i = 0; i < p; i++) { nu[i].s = old[i].s; keep0(nu[i], old[i]); }
      for (let i = 0; i < q; i++) { nu[nu.length - 1 - i].s = old[old.length - 1 - i].s; keep0(nu[nu.length - 1 - i], old[old.length - 1 - i]); }
      const a = p < old.length ? old[p].s : l.end, b = q > 0 ? old[old.length - q].s : l.end;
      const mid = nu.length - p - q, lo = p ? Math.max(a, nu[p - 1].s) : s0;
      for (let i = 0; i < mid; i++) nu[p + i].s = lo + ((Math.max(b, lo) - lo) * i) / mid;
    }
    l.units = nu; K.fixLine(l); return true;
  };

  /* ---------- 工程 ---------- */
  /* youtube：YouTube 视频 ID（11 位），用作播放时钟的另一种来源；'' = 没有 */
  K.blank = () => ({ app: 'karaoke-studio', version: 1, title: K.t ? K.t('untitled') : '未命名', duration: 60, mediaName: '', youtube: '', settings: Object.assign({}, K.DEF), lines: [] });
  /* 从 YouTube 链接（watch / youtu.be / shorts / embed / live / music，含 nocookie）或 11 位 ID 取出视频 ID；认不出返回 '' */
  const YT_ID = /^[A-Za-z0-9_-]{11}$/;
  K.ytId = (s) => {
    s = typeof s === 'string' ? s.trim() : '';
    if (YT_ID.test(s)) return s;
    let u; try { u = new URL(/^[a-z][a-z0-9+.-]*:/i.test(s) ? s : 'https://' + s); } catch (e) { return ''; }
    const h = u.hostname.toLowerCase().replace(/^(www|m|music)\./, ''), seg = u.pathname.split('/').filter(Boolean);
    let id = '';
    if (h === 'youtu.be') id = seg[0];
    else if (h === 'youtube.com' || h === 'youtube-nocookie.com') id = seg[0] === 'watch' || !seg.length ? u.searchParams.get('v') : ['embed', 'shorts', 'live', 'v', 'e'].includes(seg[0]) ? seg[1] : '';
    return id && YT_ID.test(id) ? id : '';
  };
  K.sortLines = () => K.project.lines.sort((a, b) => K.ls(a) - K.ls(b));

  /* 工程文件不可信：逐项校验 / 转换类型 */
  const num = (v, d) => { v = typeof v === 'string' && v.trim() !== '' ? +v : v; return typeof v === 'number' && isFinite(v) ? v : d; };
  const str = (v, max) => (typeof v === 'string' || typeof v === 'number' ? String(v).replace(/[\u0000-\u001f\u007f]/g, '').slice(0, max) : '');
  const tri = (v) => (v == null ? null : typeof v === 'string' ? v === 'true' || v === '1' : !!v);
  const ID_RE = /^[A-Za-z0-9_-]{1,40}$/;
  /* 接受：工程文件 / 对齐脚本输出的数组 [{start,end,text,units:[{t,r,t0,t1}]}] */
  K.normalizeProject = (j) => {
    const p = K.blank();
    if (Array.isArray(j)) j = { lines: j };
    if (!j || typeof j !== 'object') j = {};
    if (str(j.title, 200).trim()) p.title = str(j.title, 200);
    p.mediaName = str(j.mediaName, 260);
    p.youtube = K.ytId(j.youtube);
    p.settings = K.cleanSettings(j.settings);
    let maxEnd = 0; const ids = new Set();
    (Array.isArray(j.lines) ? j.lines : []).forEach((c) => {
      if (!c || typeof c !== 'object') return;
      const start = Math.max(0, num(c.start, 0)), cend = num(c.end, 0);
      const l = K.newLine({ id: typeof c.id === 'string' && ID_RE.test(c.id) && !ids.has(c.id) ? c.id : K.newId() });
      ids.add(l.id);
      const row = num(c.row, null); if (row != null) l.row = Math.max(0, Math.min(5, Math.round(row)));
      if (['left', 'center', 'right'].includes(c.align)) l.align = c.align;
      l.newPara = tri(c.newPara); l.dots = tri(c.dots);
      l.showAt = num(c.showAt, null); l.hideAt = num(c.hideAt, null);
      let prev = null;
      (Array.isArray(c.units) ? c.units : []).forEach((u) => {
        if (Array.isArray(u)) u = { t: u[0], r: u[1], t0: u[2], t1: u[3] };
        if (!u || typeof u !== 'object') return;
        const n = { t: str(u.t, 64), r: str(u.r, 64) || null };
        if (!n.t) return;
        const fb = prev ? (prev._t1 != null ? prev._t1 : prev.s) : start;
        if (u.s != null) {
          n.s = num(u.s, fb);
          if (Array.isArray(u.m)) { const m = u.m.map((v) => num(v, NaN)); if (m.every(isFinite)) n.m = m; }
        } else {
          n.s = num(u.t0, fb);
          n._t1 = num(u.t1, n.s);
        }
        if (u.n === 1 || u.n === true) n.n = 1;                                        // 行内换行（位置由 fixLine 再校验）
        if (u.k === 0 || u.k === 1 || typeof u.k === 'boolean') n.k = +u.k;        // 手动音节（位置由 fixLine 再校验）
        l.units.push(n); prev = n;
      });
      /* text（SRT / 粘贴的歌词）里的换行 = 行内换行，所以这里保留 \n，其余控制字符去掉 */
      const text = typeof c.text === 'string' ? c.text.replace(/\r\n?/g, '\n').replace(/[\u0000-\u0009\u000b-\u001f\u007f]/g, '').slice(0, 2000) : str(c.text, 2000), fromText = !l.units.length && !!text;
      if (fromText) { l.units = K.parseText(text); l.units.forEach((u) => (u.s = start)); K.evenSplit(l, start, cend > start ? cend : start + 3); }
      const last = l.units[l.units.length - 1];
      if (!fromText) l.end = last && last._t1 != null ? Math.max(last._t1 + 0.08, cend) : cend;   // 对齐数据用最后一个字的结束；工程文件用自带的 end；SRT 用 evenSplit 的结束
      l.units.forEach((u) => delete u._t1);
      if (!l.units.length) return;
      const o = K.cleanOverrides(c.o); if (o) l.o = o;                              // 行的局部属性：和全局设置同一套校验
      K.fixLine(l); p.lines.push(l); maxEnd = Math.max(maxEnd, l.end);
    });
    const dur = num(j.duration, 0);
    p.duration = dur > 0 ? Math.min(dur, 86400) : Math.ceil(maxEnd + 5);
    return p;
  };

  /* ---------- 撤销 / 重做 ----------
     每一步记下“做了什么”（u.* 翻译 key 的后缀），撤销 / 重做按钮的提示里显示 */
  let undo = [], ptr = -1;
  const snap = () => JSON.stringify(K.project);
  K.resetHistory = () => { undo = [{ s: snap(), why: '' }]; ptr = 0; };
  K.touch = () => { K.rev++; K.emit('change'); };          // 拖动过程中的实时刷新（不入历史）
  let saveTimer = null;
  K.commit = (why) => {
    K.sortLines(); K.rev++;
    undo.length = ptr + 1; undo.push({ s: snap(), why: why || '' }); ptr++;
    if (undo.length > 150) { undo.shift(); ptr--; }
    K.dirty = true; K.emit('change');
    clearTimeout(saveTimer); saveTimer = setTimeout(K.autosave, 400);
  };
  const restore = () => { K.project = JSON.parse(undo[ptr].s); K.rev++; K.dirty = true; if (!K.line(K.ui.sel)) K.ui.sel = null; K.emit('load'); K.emit('change'); K.emit('select'); K.autosave(); };
  K.undo = () => { if (ptr > 0) { ptr--; restore(); } };
  K.redo = () => { if (ptr < undo.length - 1) { ptr++; restore(); } };
  K.canUndo = () => ptr > 0;
  K.canRedo = () => ptr < undo.length - 1;
  K.undoWhy = () => (ptr > 0 ? undo[ptr].why : null);
  K.redoWhy = () => (ptr < undo.length - 1 ? undo[ptr + 1].why : null);

  /* 自动保存：工程本身 + 元信息（是否有未存进文件的修改、来源、关联文件名），刷新后保存状态提示仍然准确 */
  const AK = 'karaoke-studio:autosave', MK = 'karaoke-studio:autosave-meta';
  const SRC = ['new', 'sample', 'file', 'import', 'download'];
  K.doc = { src: 'new', name: '' };        // 来源：new / sample / file（打开的工程）/ import（SRT 等）/ download（另存为下载）；name = 关联的文件名
  K.autosaveOk = true;
  K.autosave = () => {
    try { localStorage.setItem(AK, JSON.stringify(K.project)); localStorage.setItem(MK, JSON.stringify({ dirty: K.dirty, src: K.doc.src, name: K.doc.name })); K.autosaveOk = true; }
    catch (e) { K.autosaveOk = false; }
  };
  K.loadAutosave = () => { try { const j = JSON.parse(localStorage.getItem(AK) || 'null'); return j && j.lines ? j : null; } catch (e) { return null; } };
  K.loadAutosaveMeta = () => {
    let m = null; try { m = JSON.parse(localStorage.getItem(MK) || 'null'); } catch (e) {}
    m = m && typeof m === 'object' ? m : {};
    return { dirty: m.dirty === true, src: SRC.includes(m.src) ? m.src : 'new', name: str(m.name, 260) };
  };
  /* 写进文件之后调用：清掉未保存标记，并同步元信息 */
  K.markSaved = (name, src) => { K.dirty = false; K.doc = { src: src || 'file', name: name || '' }; K.autosave(); K.emit('saved'); };

  /* doc：{src, name}，说明这个工程从哪来（保存状态提示用） */
  K.setProject = (p, keepDirty, doc) => {
    K.project = p; K.ui.sel = null; K.rev++; K.dirty = !!keepDirty; K.resetHistory();
    K.doc = Object.assign({ src: 'new', name: '' }, doc);
    K.emit('load', 'project'); K.emit('change'); K.emit('select'); K.autosave();
  };
})();
