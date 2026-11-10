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
    dots: true, paraGap: 4, dotsDur: 3, dotSize: 0.36,
    lead: 0.6, hold: 0.5, fadeIn: 0.2, fadeOut: 0.25, offset: 0,
    bgMode: 'transparent', bgColor: '#101820', keyColor: '#00ff00', useVideoBg: false, fps: 60,
  };

  /* 设置项的合法范围 / 取值（读工程文件、界面输入时都用它清洗，未知项丢弃） */
  K.RANGE = {
    size: [4, 1000], rubyRatio: [0, 2], rubyGap: [-500, 500], spacing: [-200, 500], lineGap: [-1, 5],
    strokeW: [0, 200], rubyStrokeW: [0, 200], glow: [0, 500], W: [16, 7680, 1], H: [16, 7680, 1], posY: [-1, 2], maxW: [0.05, 1],
    marginX: [0, 0.5], preShow: [0, 60], paraGap: [0, 120], dotsDur: [0, 30], dotSize: [0.01, 3],
    lead: [0, 30], hold: [0, 30], fadeIn: [0, 10], fadeOut: [0, 10], offset: [-60, 60],
  };
  K.ENUM = { weight: ['normal', 'bold', '900'], layout: ['duet', 'stack'], bgMode: ['transparent', 'color'], rows: [1, 2, 3], fps: [24, 25, 30, 50, 60] };
  const COLOR_RE = /^#[0-9a-f]{6}$/i;
  /* 返回清洗后的值；不合法时返回 undefined（调用方回退默认值） */
  K.cleanSetting = (k, v) => {
    const d = K.DEF[k];
    if (d === undefined) return undefined;
    if (K.ENUM[k]) { const e = K.ENUM[k].find((x) => String(x) === String(v)); return e; }
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
  const handlers = {};
  K.on = (e, f) => ((handlers[e] = handlers[e] || []).push(f));
  K.emit = (e, a) => (handlers[e] || []).forEach((f) => f(a));

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
  /* 所有可定时的边界：[{i: 第几个字, j: 字内第几拍}] */
  K.bounds = (l) => { const B = []; l.units.forEach((u, i) => { for (let j = 0, n = K.nMora(u); j < n; j++) B.push({ i, j }); }); return B; };
  K.boundTime = (l, b) => K.subTimes(l, b.i)[b.j];
  /* 把某个边界定在时间 T，前面的不晚于 T、后面的不早于 T */
  K.setBoundary = (l, i, j, T) => {
    const u = l.units[i], n = K.nMora(u);
    if (j > 0) { u.m = K.subTimes(l, i).slice(1, n); u.m[j - 1] = T; }
    else { if (u.m) u.m = K.subTimes(l, i).slice(1, n); u.s = T; }
    l.units.forEach((x, k) => {
      if (k < i) { if (x.s > T) x.s = T; if (x.m) x.m = x.m.map((v) => Math.min(v, T)); }
      else if (k > i) { if (x.s < T) x.s = T; if (x.m) x.m = x.m.map((v) => Math.max(v, T)); }
      else { if (j > 0 && x.s > T) x.s = T; if (x.m) x.m = x.m.map((v, q) => (q < j - 1 ? Math.min(v, T) : q > j - 1 ? Math.max(v, T) : v)); }
    });
    if (l.end < T + 0.05) l.end = T + 0.05;
    K.fixLine(l);
  };
  K.lineText = (l) => l.units.map((u) => u.t).join('');
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
    l.units.forEach((u, i) => {
      if (!u.m) return;
      if (u.m.length !== K.nMora(u) - 1 || !u.m.length) { delete u.m; return; }
      const e = K.unitEnd(l, i); let q = u.s;
      u.m = u.m.map((v) => (q = K.r3(Math.min(e, Math.max(q, v)))));
    });
  };
  K.newLine = (o) => Object.assign({ id: K.newId(), units: [], end: 0, row: null, align: null, newPara: null, dots: null, showAt: null, hideAt: null }, o);

  /* ---------- 文本 <-> 单元（注音语法：漢字{かんじ}） ---------- */
  const RUBY_RE = /([々〆ヶ一-鿿]+)\{([^{}]*)\}|([\s\S])/gu;
  K.parseText = (str) => {
    const out = []; let m; RUBY_RE.lastIndex = 0;
    while ((m = RUBY_RE.exec(str))) {
      if (m[1]) out.push({ t: m[1], r: m[2] || null });
      else if (m[3] !== '\n' && m[3] !== '\r') out.push({ t: m[3], r: null });
    }
    return out;
  };
  K.unitsToText = (units) => units.map((u) => u.t + (u.r ? '{' + u.r + '}' : '')).join('');
  const sounding = (u) => /[^\s\p{P}]/u.test(u.t);
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
    if (nu.length === old.length) nu.forEach((u, i) => { u.s = old[i].s; if (old[i].m && old[i].r === u.r) u.m = old[i].m; });
    else {
      let p = 0; while (p < nu.length && p < old.length && nu[p].t === old[p].t) p++;
      let q = 0; while (q < nu.length - p && q < old.length - p && nu[nu.length - 1 - q].t === old[old.length - 1 - q].t) q++;
      for (let i = 0; i < p; i++) nu[i].s = old[i].s;
      for (let i = 0; i < q; i++) nu[nu.length - 1 - i].s = old[old.length - 1 - i].s;
      const a = p < old.length ? old[p].s : l.end, b = q > 0 ? old[old.length - q].s : l.end;
      const mid = nu.length - p - q, lo = p ? Math.max(a, nu[p - 1].s) : s0;
      for (let i = 0; i < mid; i++) nu[p + i].s = lo + ((Math.max(b, lo) - lo) * i) / mid;
    }
    l.units = nu; K.fixLine(l); return true;
  };

  /* ---------- 工程 ---------- */
  K.blank = () => ({ app: 'karaoke-studio', version: 1, title: K.t ? K.t('untitled') : '未命名', duration: 60, mediaName: '', settings: Object.assign({}, K.DEF), lines: [] });
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
        l.units.push(n); prev = n;
      });
      const text = str(c.text, 2000), fromText = !l.units.length && !!text;
      if (fromText) { l.units = K.parseText(text); l.units.forEach((u) => (u.s = start)); K.evenSplit(l, start, cend > start ? cend : start + 3); }
      const last = l.units[l.units.length - 1];
      if (!fromText) l.end = last && last._t1 != null ? Math.max(last._t1 + 0.08, cend) : cend;   // 对齐数据用最后一个字的结束；工程文件用自带的 end；SRT 用 evenSplit 的结束
      l.units.forEach((u) => delete u._t1);
      if (!l.units.length) return;
      K.fixLine(l); p.lines.push(l); maxEnd = Math.max(maxEnd, l.end);
    });
    const dur = num(j.duration, 0);
    p.duration = dur > 0 ? Math.min(dur, 86400) : Math.ceil(maxEnd + 5);
    return p;
  };

  /* ---------- 撤销 / 重做 ---------- */
  let undo = [], ptr = -1;
  const snap = () => JSON.stringify(K.project);
  K.resetHistory = () => { undo = [snap()]; ptr = 0; };
  K.touch = () => { K.rev++; K.emit('change'); };          // 拖动过程中的实时刷新（不入历史）
  let saveTimer = null;
  K.commit = () => {
    K.sortLines(); K.rev++;
    undo.length = ptr + 1; undo.push(snap()); ptr++;
    if (undo.length > 150) { undo.shift(); ptr--; }
    K.dirty = true; K.emit('change');
    clearTimeout(saveTimer); saveTimer = setTimeout(K.autosave, 400);
  };
  const restore = () => { K.project = JSON.parse(undo[ptr]); K.rev++; K.dirty = true; if (!K.line(K.ui.sel)) K.ui.sel = null; K.emit('load'); K.emit('change'); K.emit('select'); K.autosave(); };
  K.undo = () => { if (ptr > 0) { ptr--; restore(); } };
  K.redo = () => { if (ptr < undo.length - 1) { ptr++; restore(); } };

  const AK = 'karaoke-studio:autosave';
  K.autosave = () => { try { localStorage.setItem(AK, JSON.stringify(K.project)); } catch (e) {} };
  K.loadAutosave = () => { try { const j = JSON.parse(localStorage.getItem(AK) || 'null'); return j && j.lines ? j : null; } catch (e) { return null; } };

  K.setProject = (p, keepDirty) => {
    K.project = p; K.ui.sel = null; K.rev++; K.dirty = !!keepDirty; K.resetHistory();
    K.emit('load', 'project'); K.emit('change'); K.emit('select'); K.autosave();
  };
})();
