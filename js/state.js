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

  K.project = null;
  K.rev = 0;               // 任何改动都会 +1，用于失效缓存
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
  K.unitEnd = (l, i) => {
    const u = l.units[i], n = l.units[i + 1];
    let e = n ? n.s : l.end;
    if (u.e != null) e = Math.min(e, u.e);
    return Math.max(e, u.s + 0.02);
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
      u.s = K.r3(u.s); p = u.s;
      if (u.e != null) { u.e = K.r3(Math.max(u.e, u.s + 0.02)); }
    });
    l.units.forEach((u, i) => { const n = l.units[i + 1]; if (u.e != null && n && u.e >= n.s) delete u.e; });
    const last = l.units[l.units.length - 1];
    l.end = K.r3(Math.max(l.end, last ? last.s + 0.05 : l.end));
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
    l.units.forEach((u) => { u.s = K.r3(s + k * d); delete u.e; if (sounding(u)) k++; });
    l.end = K.r3(e);
  };
  /* 修改文本后尽量保留原有时间：前后缀相同的字保留，中间重新平均 */
  K.retext = (l, str) => {
    const nu = K.parseText(str), old = l.units;
    if (!nu.length) return false;
    const s0 = K.ls(l);
    if (nu.length === old.length) nu.forEach((u, i) => { u.s = old[i].s; if (old[i].e != null) u.e = old[i].e; });
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
  K.blank = () => ({ app: 'karaoke-studio', version: 1, title: '未命名', duration: 60, mediaName: '', settings: Object.assign({}, K.DEF), lines: [] });
  K.sortLines = () => K.project.lines.sort((a, b) => K.ls(a) - K.ls(b));

  /* 接受：工程文件 / 对齐脚本输出的数组 [{start,end,text,units:[{t,r,t0,t1}]}] */
  K.normalizeProject = (j) => {
    const p = K.blank();
    if (Array.isArray(j)) j = { lines: j };
    if (j.title) p.title = j.title;
    if (j.mediaName) p.mediaName = j.mediaName;
    Object.assign(p.settings, j.settings || {});
    let maxEnd = 0;
    (j.lines || []).forEach((c) => {
      const l = K.newLine({ id: c.id && typeof c.id === 'string' ? c.id : K.newId() });
      ['row', 'align', 'newPara', 'dots', 'showAt', 'hideAt'].forEach((k) => { if (c[k] != null) l[k] = c[k]; });
      let prev = null;
      (c.units || []).forEach((u) => {
        if (Array.isArray(u)) u = { t: u[0], r: u[1], t0: u[2], t1: u[3] };
        const n = { t: u.t, r: u.r || null };
        if (u.s != null) { n.s = u.s; if (u.e != null) n.e = u.e; }
        else {
          n.s = u.t0 != null ? u.t0 : prev ? prev._t1 : c.start || 0;
          n._t1 = u.t1 != null ? u.t1 : n.s;
        }
        l.units.push(n); prev = n;
      });
      if (!l.units.length && c.text) { l.units = K.parseText(c.text); l.end = c.end || 0; l.units.forEach((u) => (u.s = c.start || 0)); K.evenSplit(l, c.start || 0, c.end || (c.start || 0) + 3); }
      // 对齐数据：字与字之间停顿较长时，给前一个字一个明确的结束时间
      l.units.forEach((u, i) => {
        const n = l.units[i + 1];
        if (u._t1 != null) { if (n && n.s - u._t1 > 0.35) u.e = u._t1 + 0.12; }
      });
      const last = l.units[l.units.length - 1];
      l.end = last && last._t1 != null ? last._t1 + 0.08 : c.end || 0;   // 对齐数据用最后一个字的结束；工程文件用自带的 end
      l.units.forEach((u) => delete u._t1);
      if (!l.units.length) return;
      K.fixLine(l); p.lines.push(l); maxEnd = Math.max(maxEnd, l.end);
    });
    p.duration = j.duration || Math.ceil(maxEnd + 5);
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
    K.emit('load'); K.emit('change'); K.emit('select'); K.autosave();
  };
})();
