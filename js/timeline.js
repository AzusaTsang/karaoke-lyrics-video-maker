/* 时间线：每个行位一条轨道；块 = 一句歌词（浅色=显示窗口，实色=演唱区间）。
   左侧固定栏显示行位名；底部总览条显示整首歌和当前可见范围。拖动时按住 Shift = 不吸附播放头 */
(function () {
  const K = window.K, RUL = 22, TRK = 46, GUT = 46, ZMIN = 2, ZMAX = 1200;
  const LYR = '"Yu Gothic UI","Meiryo","Hiragino Sans","Microsoft YaHei","PingFang SC","Noto Sans CJK JP",sans-serif';   // 歌词本身（与界面语言无关）
  const tl = (K.tl = { pps: K.prefNum('pps', ZMIN, ZMAX, 80), scroll: 0, gut: GUT, rul: RUL, trk: TRK });
  let cv, g, ov, og, W = 0, H = 0, OW = 0, drag = null, hov = null, ovDrag = null;
  const wave = () => (K.peaks ? 40 : 0), top0 = () => RUL + wave();
  const VW = () => Math.max(1, W - GUT);                                   // 时间区域宽度（不含左侧栏）
  const X = (t) => GUT + (t - tl.scroll) * tl.pps, T = (x) => (x - GUT) / tl.pps + tl.scroll;
  const off = () => K.S().offset;           // 时间线显示的是媒体时间 = 歌词时间 + 整体偏移
  const LX = (t) => X(t + off()), LT = (x) => T(x) - off();
  const fmt = (t) => { const m = Math.floor(t / 60), s = t - m * 60; return m + ':' + (s < 10 ? '0' : '') + (tl.pps >= 150 ? s.toFixed(1) : Math.floor(s)); };
  const f3 = (t) => K.fmt3(t);
  let prefT = 0; const savePps = () => { clearTimeout(prefT); prefT = setTimeout(() => K.pref('pps', tl.pps), 400); };
  const clampScroll = () => { tl.scroll = Math.max(-1, Math.min(tl.scroll, K.dur() + 1 - VW() / tl.pps * 0.2)); };

  function hit(x, y) {
    if (y < top0()) return { zone: 'ruler' };
    const sc = K.screen(), row = Math.floor((y - top0()) / TRK);
    if (x < GUT) return { zone: 'gutter', row };
    const t = LT(x), tol = 6 / tl.pps, yIn = y - top0() - row * TRK;
    let c = sc.ord.filter((l) => { const I = sc.info.get(l.id); return I.row === row && t >= Math.min(I.show, K.ls(l)) - tol && t <= Math.max(I.hide, l.end) + tol; });
    if (!c.length) return { zone: 'empty', row, t };
    const l = c.find((x) => x.id === K.ui.sel) || c.find((x) => t >= K.ls(x) && t <= x.end) || c[0], I = sc.info.get(l.id);
    if (l.id === K.ui.sel && yIn > TRK * 0.5) {
      let bi = -1, bd = 6;
      const B = K.bounds(l); B.forEach((b, i) => { const d = Math.abs(LX(K.boundTime(l, b)) - x); if (d < bd || (d === bd && b.j === 0)) { bd = d; bi = i; } });
      if (bi >= 0) return { zone: 'tick', l, i: bi };
    }
    if (Math.abs(x - LX(l.end)) <= 5) return { zone: 'end', l };
    if (Math.abs(x - LX(I.show)) <= 5) return { zone: 'show', l };
    if (Math.abs(x - LX(I.hide)) <= 5) return { zone: 'hide', l };
    if (t >= K.ls(l) && t <= l.end) return { zone: 'move', l };
    return { zone: 'window', l };
  }
  const CUR = { ruler: 'text', tick: 'col-resize', end: 'ew-resize', show: 'w-resize', hide: 'e-resize', move: 'grab', window: 'pointer', empty: 'default', gutter: 'default' };
  /* 靠近播放头（6px 内）吸附；按住 Shift 不吸附 */
  let snapped = false;
  const snap = (t, e) => { if (!e.shiftKey && Math.abs(LX(t) - X(K.now())) < 6) { snapped = true; return K.now() - off(); } return t; };
  const boundWhat = (l, i) => { const b = K.bounds(l)[i], un = l.units[b.i], ms = K.moras(un.r); return b.j ? K.t('tip.charMora', { c: un.t, n: b.j + 1, m: ms[b.j] || '' }) : K.t('tip.char', { c: un.t }); };
  /* 提示文字：正在改的值 */
  const tipText = (z, l, i) => {
    const I = K.screen().info.get(l.id);
    if (z === 'move') return K.t('tip.move', { t: f3(K.ls(l)), row: I.row + 1 });
    if (z === 'tick') return K.t('tip.tick', { what: boundWhat(l, i), t: f3(K.boundTime(l, K.bounds(l)[i])) });
    if (z === 'end') return K.t('tip.end', { t: f3(l.end) });
    if (z === 'show') return K.t('tip.show', { t: f3(I.show) }) + (l.showAt == null ? ' · ' + K.t('tip.auto') : '');
    if (z === 'hide') return K.t('tip.hide', { t: f3(I.hide) }) + (l.hideAt == null ? ' · ' + K.t('tip.auto') : '');
    return '';
  };

  function onMove(e) {
    const r = cv.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
    if (!drag) {
      const h = hit(x, y), key = h.l ? h.zone + ':' + h.l.id + ':' + (h.i == null ? '' : h.i) : '';
      cv.style.cursor = CUR[h.zone];
      if (key !== (hov && hov.key)) hov = key ? { key, zone: h.zone, id: h.l.id, i: h.i } : null;
      if (h.l && /^(tick|end|show|hide)$/.test(h.zone)) K.tip(e.clientX, e.clientY, tipText(h.zone, h.l, h.i)); else K.tipHide();
      return;
    }
    const d = drag, l = d.l;
    if (d.zone === 'ruler') { K.seek(Math.max(0, T(x))); K.tip(e.clientX, e.clientY, K.fmt(K.now()) + '  (' + f3(K.now()) + ' s)'); return; }
    if (d.zone === 'pan') {
      if (Math.abs(x - d.x0) > 3) d.moved = true;
      if (d.moved) { tl.scroll = d.s0 - (x - d.x0) / tl.pps; clampScroll(); tl.userScroll = performance.now(); cv.style.cursor = 'grabbing'; }
      return;
    }
    if (Math.abs(x - d.x0) > 2 || Math.abs(y - d.y0) > 6) d.moved = true;
    if (!d.moved) return;
    Object.assign(l, JSON.parse(d.orig));
    const t = LT(x); snapped = false;
    if (d.zone === 'move') {
      const s0 = K.ls(l); let dt = (x - d.x0) / tl.pps; dt = snap(s0 + dt, e) - s0; if (s0 + dt < 0) dt = -s0;
      K.ops.shiftRaw(l, dt);
      const row = Math.max(0, Math.min(5, Math.floor((y - top0()) / TRK)));
      if (row !== d.row0) l.row = row;
    } else if (d.zone === 'tick') {
      const B = K.bounds(l), b = B[d.i], lo = d.i > 0 ? K.boundTime(l, B[d.i - 1]) : 0, hi = d.i < B.length - 1 ? K.boundTime(l, B[d.i + 1]) : l.end - 0.03;
      K.setBoundary(l, b.i, b.j, Math.max(lo, Math.min(hi, snap(t, e))));
    } else if (d.zone === 'end') { l.end = Math.max(snap(t, e), l.units[l.units.length - 1].s + 0.05); K.fixLine(l); }
    else if (d.zone === 'show') l.showAt = K.r3(Math.min(snap(t, e), K.ls(l) - 0.05));
    else if (d.zone === 'hide') l.hideAt = K.r3(Math.max(snap(t, e), K.ls(l) + 0.1));
    K.touch();
    K.tip(e.clientX, e.clientY, tipText(d.zone, l, d.i) + (snapped ? '\n' + K.t('tip.snapped') : ''));
  }
  const WHY = { move: 'shift', tick: 'timing', end: 'timing', show: 'showHide', hide: 'showHide' };
  K.initTimeline = () => {
    cv = document.getElementById('tlc'); g = cv.getContext('2d');
    ov = document.getElementById('tlov'); og = ov.getContext('2d');
    cv.addEventListener('mousedown', (e) => { if (e.button === 1) e.preventDefault(); });      // 中键不进入浏览器的自动滚动
    cv.addEventListener('pointerdown', (e) => {
      if (e.button !== 0 && e.button !== 1) return;
      const r = cv.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top, h = hit(x, y);
      try { cv.setPointerCapture(e.pointerId); } catch (err) {}
      if (e.button === 1 || h.zone === 'empty' || h.zone === 'gutter') { drag = { zone: 'pan', x0: x, s0: tl.scroll, moved: false, click: e.button === 0 && h.zone === 'empty' }; return; }
      if (h.zone === 'ruler') { drag = { zone: 'ruler' }; tl.scrubbing = true; K.seek(Math.max(0, T(x))); return; }
      K.select(h.l.id);
      if (h.zone === 'window') return;
      drag = { zone: h.zone, l: h.l, i: h.i, x0: x, y0: y, moved: false, orig: JSON.stringify(h.l), row0: K.screen().info.get(h.l.id).row };
      if (h.zone === 'move') cv.style.cursor = 'grabbing';
    });
    cv.addEventListener('pointermove', onMove);
    cv.addEventListener('pointerleave', () => { if (!drag) { hov = null; K.tipHide(); } });
    const up = () => {
      if (drag) {
        if (drag.zone === 'pan' && !drag.moved && drag.click) K.select(null);
        else if (drag.moved && WHY[drag.zone]) K.commit(drag.zone === 'move' && drag.l.row !== JSON.parse(drag.orig).row ? 'row' : WHY[drag.zone]);
      }
      drag = null; tl.scrubbing = false; K.tipHide(); lastKey = '';
    };
    cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
    cv.addEventListener('dblclick', (e) => {
      const r = cv.getBoundingClientRect(), h = hit(e.clientX - r.left, e.clientY - r.top);
      if (h.zone === 'show') K.ops.set(h.l, 'showAt', null);
      else if (h.zone === 'hide') K.ops.set(h.l, 'hideAt', null);
      else if (h.l) K.seek(Math.max(0, K.ls(h.l) + off() - 0.5));
    });
    cv.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      const r = cv.getBoundingClientRect(), h = hit(e.clientX - r.left, e.clientY - r.top);
      if (h.l) { K.select(h.l.id); K.lineMenu(h.l, e.clientX, e.clientY); }
      else if (h.zone === 'empty') K.menu(e.clientX, e.clientY, [[K.t('menu.add'), () => { const l = K.ops.add(Math.max(0, K.r3(h.t))); if (h.row >= K.S().rows || h.row > 0) K.ops.set(l, 'row', h.row); }]]);
    });
    cv.addEventListener('wheel', (e) => {
      e.preventDefault();
      const r = cv.getBoundingClientRect(), x = Math.max(GUT, e.clientX - r.left);
      if (e.ctrlKey || e.altKey) { const t = T(x); tl.pps = Math.max(ZMIN, Math.min(ZMAX, tl.pps * Math.exp(-e.deltaY * 0.0018))); tl.scroll = t - (x - GUT) / tl.pps; savePps(); }
      else tl.scroll += (Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY) / tl.pps;
      clampScroll(); tl.userScroll = performance.now();
    }, { passive: false });
    /* 总览条：点击 / 拖动 = 把可见范围移到那里 */
    const ovT = (e) => { const r = ov.getBoundingClientRect(); return ((e.clientX - r.left - 4) / Math.max(1, r.width - 8)) * K.dur(); };
    ov.addEventListener('pointerdown', (e) => {
      try { ov.setPointerCapture(e.pointerId); } catch (err) {}
      const t = ovT(e), span = VW() / tl.pps;
      ovDrag = t >= tl.scroll && t <= tl.scroll + span ? t - tl.scroll : span / 2;
      tl.scroll = t - ovDrag; clampScroll(); tl.userScroll = performance.now();
    });
    ov.addEventListener('pointermove', (e) => { if (ovDrag == null) return; tl.scroll = ovT(e) - ovDrag; clampScroll(); tl.userScroll = performance.now(); });
    const ovUp = () => { ovDrag = null; }; ov.addEventListener('pointerup', ovUp); ov.addEventListener('pointercancel', ovUp);
  };
  K.tlZoom = (f) => { const c = T(GUT + VW() / 2); tl.pps = Math.max(ZMIN, Math.min(ZMAX, tl.pps * f)); tl.scroll = c - VW() / 2 / tl.pps; clampScroll(); savePps(); };
  K.tlReveal = (t) => { const x = X(t); if (x < GUT + 40 || x > W - 80) { tl.scroll = Math.max(-1, t - (VW() * 0.25) / tl.pps); } };
  /* 把 [a, b] 这段媒体时间放满可见区域（两边留一点） */
  const fitRange = (a, b) => { const span = Math.max(0.5, b - a), pad = span * 0.08; tl.pps = Math.max(ZMIN, Math.min(ZMAX, VW() / (span + 2 * pad))); tl.scroll = a - pad; clampScroll(); tl.userScroll = performance.now(); savePps(); };
  K.tlFit = () => fitRange(0, K.dur());
  K.tlFitSel = () => { const l = K.sel(); if (!l) return; const I = K.screen().info.get(l.id); fitRange(Math.min(I.show, K.ls(l)) + off(), Math.max(I.hide, l.end) + off()); };

  /* 每帧调用；画面相关的状态都没变就跳过（拖动中总是重画） */
  let lastKey = '', lastOv = '';
  K.stats = K.stats || { stage: 0, tl: 0 };
  K.drawTimeline = () => {
    const box = cv.parentElement, dpr = window.devicePixelRatio || 1, sc = K.screen();
    W = box.clientWidth; H = Math.max(box.clientHeight, top0() + sc.rows * TRK + 4);
    let resized = false;
    if (cv.width !== Math.round(W * dpr) || cv.height !== Math.round(H * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); cv.style.width = W + 'px'; cv.style.height = H + 'px'; resized = true; }
    const now = K.now(), loop = K.loopRange ? K.loopRange() : null;
    if (K.playing() && !drag && performance.now() - (tl.userScroll || 0) > 1500) { const x = X(now); if (x > W * 0.85 || x < GUT) tl.scroll = now - (VW() * 0.15) / tl.pps; }
    drawOverview(now, loop, dpr);
    const key = [now, K.rev, K.inv, K.fontEpoch, K.ui.sel, K.ui.tapIdx, K.ui.tapArmed, tl.pps, tl.scroll, W, H, dpr, loop && loop.join(), hov && hov.key].join('|');
    if (key === lastKey && !resized && !drag) return false;
    lastKey = key; K.stats.tl++;
    const UF = K.uiFont(11), LF = '12px ' + LYR, hv = drag ? { zone: drag.zone, id: drag.l && drag.l.id, i: drag.i } : hov;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.fillStyle = '#15181d'; g.fillRect(0, 0, W, H);
    /* 标尺 */
    g.fillStyle = '#1c2027'; g.fillRect(0, 0, W, RUL);
    const steps = [0.1, 0.5, 1, 2, 5, 10, 30, 60, 120, 300], step = steps.find((s) => s * tl.pps >= 64) || 600;
    g.font = UF; g.textBaseline = 'middle'; g.fillStyle = '#9aa3b1'; g.strokeStyle = '#2c313a'; g.lineWidth = 1;
    for (let t = Math.max(0, Math.floor(tl.scroll / step) * step); t < T(W); t += step) {
      const x = Math.round(X(t)) + 0.5; g.beginPath(); g.moveTo(x, 0); g.lineTo(x, H); g.stroke(); g.fillText(fmt(t), x + 4, RUL / 2);
    }
    /* 波形 */
    if (K.peaks) {
      const P = K.peaks, mid = RUL + 20; g.fillStyle = '#3d5f8a';
      for (let x = GUT; x < W; x++) {
        const a = Math.floor(T(x) * P.rate), b = Math.max(a + 1, Math.floor(T(x + 1) * P.rate)); if (a < 0 || a >= P.data.length) continue;
        let m = 0; for (let k = a; k < b && k < P.data.length; k++) if (P.data[k] > m) m = P.data[k];
        g.fillRect(x, mid - m * 18, 1, Math.max(1, m * 36));
      }
    }
    /* 轨道 */
    for (let r = 0; r < sc.rows; r++) { const y = top0() + r * TRK; g.fillStyle = r % 2 ? '#181b21' : '#1a1e25'; g.fillRect(GUT, y, W - GUT, TRK); }
    const t0 = LT(GUT - 50), t1 = LT(W + 50);
    sc.ord.forEach((l) => {
      const I = sc.info.get(l.id), s = K.ls(l);
      if (Math.max(I.hide, l.end) < t0 || Math.min(I.show, s) > t1) return;
      const y = top0() + I.row * TRK + 4, h = TRK - 8, sel = l.id === K.ui.sel, H1 = hv && hv.id === l.id ? hv.zone : null;
      const xs = LX(I.show), xh = LX(I.hide), x1 = LX(s), x2 = LX(l.end);
      g.fillStyle = sel ? 'rgba(90,169,255,.22)' : H1 ? 'rgba(160,170,190,.22)' : 'rgba(140,150,170,.16)'; g.fillRect(xs, y, xh - xs, h);
      g.fillStyle = sel ? (H1 === 'move' ? '#3a7fd4' : '#2f6fc0') : H1 === 'move' || H1 === 'window' ? '#4a5770' : '#3a4558'; g.fillRect(x1, y, Math.max(2, x2 - x1), h);
      if (H1 === 'move') { g.strokeStyle = 'rgba(255,255,255,.45)'; g.strokeRect(x1 + 0.5, y + 0.5, Math.max(2, x2 - x1) - 1, h - 1); }
      /* 手动设置过的显示/消失边界用亮色标出；悬停的边加粗 */
      const ew = (z) => (H1 === z ? 4 : 2);
      g.fillStyle = l.showAt != null ? '#ffb74d' : sel || H1 === 'show' ? '#5aa9ff' : '#667085'; g.fillRect(xs, y, ew('show'), h);
      g.fillStyle = l.hideAt != null ? '#ffb74d' : sel || H1 === 'hide' ? '#5aa9ff' : '#667085'; g.fillRect(xh - ew('hide'), y, ew('hide'), h);
      if (H1 === 'end') { g.fillStyle = '#cfe4ff'; g.fillRect(x2 - 2, y, 3, h); }
      if (I.para) { g.strokeStyle = '#e6c15a'; g.setLineDash([3, 3]); g.beginPath(); g.moveTo(xs + 0.5, top0()); g.lineTo(xs + 0.5, H); g.stroke(); g.setLineDash([]); g.fillStyle = '#e6c15a'; g.fillText('¶', xs + 3, y - 1 + 6); }
      if (I.dotsDur) { g.fillStyle = '#ffd84d'; const xd = LX(s - I.dotsDur); for (let i = 0; i < 3; i++) { g.beginPath(); g.arc(xd + ((x1 - xd) * (i + 0.5)) / 3, y + h / 2, 3, 0, 6.3); g.fill(); } }
      g.save(); g.beginPath(); g.rect(x1, y, Math.max(2, x2 - x1), h); g.clip();
      if (sel) {
        const B = K.bounds(l), hb = H1 === 'tick' ? B[hv.i] : null;
        g.strokeStyle = 'rgba(255,255,255,.75)'; g.fillStyle = '#fff'; g.font = LF;
        l.units.forEach((u, i) => {
          const x = Math.round(LX(u.s)) + 0.5, nx = LX(K.unitEnd(l, i)), hot = hb && hb.i === i && hb.j === 0;
          g.save(); if (hot) { g.strokeStyle = '#ffd84d'; g.lineWidth = 3; }
          g.beginPath(); g.moveTo(x, y + h * (hot ? 0.35 : 0.5)); g.lineTo(x, y + h); g.stroke(); g.restore();
          if (nx - x > 9 && u.t.trim()) g.fillText(u.t, x + 2, y + h * 0.28);
          K.subTimes(l, i).slice(1, -1).forEach((tm, q) => { const xm = Math.round(LX(tm)) + 0.5, hm = hb && hb.i === i && hb.j === q + 1; g.save(); g.strokeStyle = hm ? '#ffe9a0' : 'rgba(255,216,77,.8)'; g.lineWidth = hm ? 3 : 1; g.beginPath(); g.moveTo(xm, y + h * (hm ? 0.45 : 0.68)); g.lineTo(xm, y + h); g.stroke(); g.restore(); });
          if (K.ui.tapArmed && (B[K.ui.tapIdx] || {}).i === i) { g.fillStyle = '#ffd84d'; g.fillRect(x - 1, y + h - 4, Math.max(3, nx - x), 4); g.fillStyle = '#fff'; }
        });
      } else { g.fillStyle = '#d5dae3'; g.font = LF; g.fillText(K.lineText(l), x1 + 4, y + h / 2); }
      g.restore(); g.font = UF;
    });
    /* 循环范围 */
    if (loop) {
      const a = X(loop[0]), b = X(loop[1]);
      g.fillStyle = 'rgba(80,200,140,.13)'; g.fillRect(a, RUL, b - a, H - RUL);
      g.fillStyle = '#3fbf7f'; g.fillRect(a, RUL - 5, b - a, 5); g.fillRect(a, 0, 2, H); g.fillRect(b - 2, 0, 2, H);
    }
    /* 播放头 */
    const xp = Math.round(X(now)) + 0.5;
    if (xp >= GUT) { g.strokeStyle = '#ff5a5a'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(xp, 0); g.lineTo(xp, H); g.stroke(); g.fillStyle = '#ff5a5a'; g.beginPath(); g.moveTo(xp - 5, 0); g.lineTo(xp + 5, 0); g.lineTo(xp, 7); g.fill(); }
    /* 左侧固定栏：行位名不会被块盖住 */
    g.fillStyle = '#1c2027'; g.fillRect(0, 0, GUT, RUL); g.fillStyle = '#16191e'; g.fillRect(0, RUL, GUT, H - RUL);
    g.fillStyle = '#2b3039'; g.fillRect(GUT - 1, 0, 1, H);
    g.fillStyle = '#9aa3b1'; g.textBaseline = 'middle';
    for (let r = 0; r < sc.rows; r++) g.fillText(K.t('tl.row', { n: r + 1 }), 6, top0() + r * TRK + TRK / 2);
    return true;
  };
  /* 总览条：整首歌的所有行、选中行、循环范围、可见范围框、播放头。只在这些变化时重画（播放头按像素取整） */
  function drawOverview(now, loop, dpr) {
    OW = ov.clientWidth; const OH = ov.clientHeight || 14, dur = Math.max(0.01, K.dur()), px = (t) => 4 + (t / dur) * Math.max(1, OW - 8);
    const key = [OW, OH, dpr, K.rev, K.ui.sel, dur, Math.round(px(now)), Math.round(px(tl.scroll)), Math.round(px(tl.scroll + VW() / tl.pps)), loop && loop.join()].join('|');
    if (key === lastOv) return; lastOv = key;
    if (ov.width !== Math.round(OW * dpr) || ov.height !== Math.round(OH * dpr)) { ov.width = Math.round(OW * dpr); ov.height = Math.round(OH * dpr); }
    og.setTransform(dpr, 0, 0, dpr, 0, 0); og.fillStyle = '#111317'; og.fillRect(0, 0, OW, OH);
    const sc = K.screen(), o = off(), rows = Math.max(1, sc.rows), rh = (OH - 4) / rows;
    sc.ord.forEach((l) => { const I = sc.info.get(l.id); og.fillStyle = l.id === K.ui.sel ? '#5aa9ff' : '#4a5568'; og.fillRect(px(K.ls(l) + o), 2 + I.row * rh, Math.max(1, px(l.end + o) - px(K.ls(l) + o)), Math.max(1, rh - 1)); });
    if (loop) { og.fillStyle = 'rgba(63,191,127,.35)'; og.fillRect(px(loop[0]), 0, px(loop[1]) - px(loop[0]), OH); }
    const a = px(Math.max(0, tl.scroll)), b = px(Math.min(dur, tl.scroll + VW() / tl.pps));
    og.fillStyle = 'rgba(255,255,255,.08)'; og.fillRect(a, 0, Math.max(2, b - a), OH);
    og.strokeStyle = 'rgba(207,228,255,.7)'; og.lineWidth = 1; og.strokeRect(a + 0.5, 0.5, Math.max(2, b - a) - 1, OH - 1);
    og.fillStyle = '#ff5a5a'; og.fillRect(Math.round(px(now)), 0, 1.5, OH);
  }
})();
