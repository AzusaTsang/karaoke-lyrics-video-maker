/* 时间线：每个行位一条轨道；块 = 一句歌词（浅色=显示窗口，实色=演唱区间） */
(function () {
  const K = window.K, RUL = 22, TRK = 46;
  const tl = (K.tl = { pps: 80, scroll: 0 });
  let cv, g, W = 0, H = 0, drag = null;
  const wave = () => (K.peaks ? 40 : 0), top0 = () => RUL + wave();
  const X = (t) => (t - tl.scroll) * tl.pps, T = (x) => x / tl.pps + tl.scroll;
  const off = () => K.S().offset;           // 时间线显示的是媒体时间 = 歌词时间 + 整体偏移
  const LX = (t) => X(t + off()), LT = (x) => T(x) - off();
  const fmt = (t) => { const m = Math.floor(t / 60), s = t - m * 60; return m + ':' + (s < 10 ? '0' : '') + (tl.pps >= 150 ? s.toFixed(1) : Math.floor(s)); };

  function hit(x, y) {
    if (y < top0()) return { zone: 'ruler' };
    const sc = K.screen(), row = Math.floor((y - top0()) / TRK), t = LT(x), tol = 6 / tl.pps, yIn = y - top0() - row * TRK;
    let c = sc.ord.filter((l) => { const I = sc.info.get(l.id); return I.row === row && t >= Math.min(I.show, K.ls(l)) - tol && t <= Math.max(I.hide, l.end) + tol; });
    if (!c.length) return { zone: 'empty', row, t };
    const l = c.find((x) => x.id === K.ui.sel) || c.find((x) => t >= K.ls(x) && t <= x.end) || c[0], I = sc.info.get(l.id);
    if (l.id === K.ui.sel && yIn > TRK * 0.5) {
      let bi = -1, bd = 6;
      l.units.forEach((u, i) => { const d = Math.abs(LX(u.s) - x); if (d < bd) { bd = d; bi = i; } });
      if (bi >= 0) return { zone: 'tick', l, i: bi };
    }
    if (Math.abs(x - LX(l.end)) <= 5) return { zone: 'end', l };
    if (Math.abs(x - LX(I.show)) <= 5) return { zone: 'show', l };
    if (Math.abs(x - LX(I.hide)) <= 5) return { zone: 'hide', l };
    if (t >= K.ls(l) && t <= l.end) return { zone: 'move', l };
    return { zone: 'window', l };
  }
  const CUR = { ruler: 'text', tick: 'col-resize', end: 'ew-resize', show: 'w-resize', hide: 'e-resize', move: 'grab', window: 'pointer', empty: 'default' };
  const snap = (t) => (Math.abs(LX(t) - X(K.now())) < 6 ? K.now() - off() : t);

  function onMove(e) {
    const r = cv.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
    if (!drag) { cv.style.cursor = CUR[hit(x, y).zone]; return; }
    const d = drag, l = d.l;
    if (d.zone === 'ruler') { K.seek(Math.max(0, T(x))); return; }
    if (Math.abs(x - d.x0) > 2 || Math.abs(y - d.y0) > 6) d.moved = true;
    if (!d.moved) return;
    Object.assign(l, JSON.parse(d.orig));
    const t = LT(x);
    if (d.zone === 'move') {
      const s0 = K.ls(l); let dt = (x - d.x0) / tl.pps; dt = snap(s0 + dt) - s0; if (s0 + dt < 0) dt = -s0;
      K.ops.shiftRaw(l, dt);
      const row = Math.max(0, Math.min(5, Math.floor((y - top0()) / TRK)));
      if (row !== d.row0) l.row = row;
    } else if (d.zone === 'tick') {
      const i = d.i, lo = i > 0 ? l.units[i - 1].s : 0, hi = i < l.units.length - 1 ? l.units[i + 1].s : l.end - 0.03;
      l.units[i].s = Math.max(lo, Math.min(hi, snap(t))); delete l.units[i].e; if (i > 0) delete l.units[i - 1].e; K.fixLine(l);
    } else if (d.zone === 'end') { l.end = Math.max(snap(t), l.units[l.units.length - 1].s + 0.05); K.fixLine(l); }
    else if (d.zone === 'show') l.showAt = K.r3(Math.min(snap(t), K.ls(l) - 0.05));
    else if (d.zone === 'hide') l.hideAt = K.r3(Math.max(snap(t), K.ls(l) + 0.1));
    K.touch();
  }
  K.initTimeline = () => {
    cv = document.getElementById('tlc'); g = cv.getContext('2d');
    cv.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      const r = cv.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top, h = hit(x, y);
      try { cv.setPointerCapture(e.pointerId); } catch (err) {}
      if (h.zone === 'ruler') { drag = { zone: 'ruler' }; tl.scrubbing = true; K.seek(Math.max(0, T(x))); return; }
      if (h.zone === 'empty') { K.select(null); return; }
      K.select(h.l.id);
      if (h.zone === 'window') return;
      drag = { zone: h.zone, l: h.l, i: h.i, x0: x, y0: y, moved: false, orig: JSON.stringify(h.l), row0: K.screen().info.get(h.l.id).row };
      if (h.zone === 'move') cv.style.cursor = 'grabbing';
    });
    cv.addEventListener('pointermove', onMove);
    const up = () => { if (drag && drag.moved && drag.zone !== 'ruler') K.commit(); drag = null; tl.scrubbing = false; };
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
      else if (h.zone === 'empty') K.menu(e.clientX, e.clientY, [['在此处添加歌词行', () => { const l = K.ops.add(Math.max(0, K.r3(h.t))); if (h.row >= K.S().rows || h.row > 0) K.ops.set(l, 'row', h.row); }]]);
    });
    cv.addEventListener('wheel', (e) => {
      e.preventDefault();
      const r = cv.getBoundingClientRect(), x = e.clientX - r.left;
      if (e.ctrlKey || e.altKey) { const t = T(x); tl.pps = Math.max(8, Math.min(1200, tl.pps * Math.exp(-e.deltaY * 0.0018))); tl.scroll = t - x / tl.pps; }
      else tl.scroll += (Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY) / tl.pps;
      tl.scroll = Math.max(-1, tl.scroll); tl.userScroll = performance.now();
    }, { passive: false });
  };
  K.tlZoom = (f) => { const c = T(W / 2); tl.pps = Math.max(8, Math.min(1200, tl.pps * f)); tl.scroll = Math.max(-1, c - W / 2 / tl.pps); };
  K.tlReveal = (t) => { const x = X(t); if (x < 40 || x > W - 80) tl.scroll = Math.max(-1, t - (W * 0.25) / tl.pps); };

  K.drawTimeline = () => {
    const box = cv.parentElement, dpr = window.devicePixelRatio || 1, sc = K.screen();
    W = box.clientWidth; H = Math.max(box.clientHeight, top0() + sc.rows * TRK + 4);
    if (cv.width !== Math.round(W * dpr) || cv.height !== Math.round(H * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); cv.style.width = W + 'px'; cv.style.height = H + 'px'; }
    const now = K.now();
    if (K.playing() && !drag && performance.now() - (tl.userScroll || 0) > 1500) { const x = X(now); if (x > W * 0.85 || x < 0) tl.scroll = now - (W * 0.15) / tl.pps; }
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.fillStyle = '#15181d'; g.fillRect(0, 0, W, H);
    /* 标尺 */
    g.fillStyle = '#1c2027'; g.fillRect(0, 0, W, RUL);
    const steps = [0.1, 0.5, 1, 2, 5, 10, 30, 60], step = steps.find((s) => s * tl.pps >= 64) || 120;
    g.font = '11px "Segoe UI",sans-serif'; g.textBaseline = 'middle'; g.fillStyle = '#8b93a1'; g.strokeStyle = '#2c313a'; g.lineWidth = 1;
    for (let t = Math.max(0, Math.floor(tl.scroll / step) * step); t < T(W); t += step) {
      const x = Math.round(X(t)) + 0.5; g.beginPath(); g.moveTo(x, 0); g.lineTo(x, H); g.stroke(); g.fillText(fmt(t), x + 4, RUL / 2);
    }
    /* 波形 */
    if (K.peaks) {
      const P = K.peaks, mid = RUL + 20; g.fillStyle = '#3d5f8a';
      for (let x = 0; x < W; x++) {
        const a = Math.floor(T(x) * P.rate), b = Math.max(a + 1, Math.floor(T(x + 1) * P.rate)); if (a < 0 || a >= P.data.length) continue;
        let m = 0; for (let k = a; k < b && k < P.data.length; k++) if (P.data[k] > m) m = P.data[k];
        g.fillRect(x, mid - m * 18, 1, Math.max(1, m * 36));
      }
    }
    /* 轨道 */
    for (let r = 0; r < sc.rows; r++) {
      const y = top0() + r * TRK; g.fillStyle = r % 2 ? '#181b21' : '#1a1e25'; g.fillRect(0, y, W, TRK);
      g.fillStyle = '#4a5261'; g.fillText('行' + (r + 1), 4, y + 9);
    }
    const t0 = LT(-50), t1 = LT(W + 50);
    sc.ord.forEach((l) => {
      const I = sc.info.get(l.id), s = K.ls(l);
      if (Math.max(I.hide, l.end) < t0 || Math.min(I.show, s) > t1) return;
      const y = top0() + I.row * TRK + 4, h = TRK - 8, sel = l.id === K.ui.sel;
      const xs = LX(I.show), xh = LX(I.hide), x1 = LX(s), x2 = LX(l.end);
      g.fillStyle = sel ? 'rgba(90,169,255,.22)' : 'rgba(140,150,170,.16)'; g.fillRect(xs, y, xh - xs, h);
      g.fillStyle = sel ? '#2f6fc0' : '#3a4558'; g.fillRect(x1, y, Math.max(2, x2 - x1), h);
      /* 手动设置过的显示/消失边界用亮色标出 */
      g.fillStyle = l.showAt != null ? '#ffb74d' : sel ? '#5aa9ff' : '#667085'; g.fillRect(xs, y, 2, h);
      g.fillStyle = l.hideAt != null ? '#ffb74d' : sel ? '#5aa9ff' : '#667085'; g.fillRect(xh - 2, y, 2, h);
      if (I.para) { g.strokeStyle = '#e6c15a'; g.setLineDash([3, 3]); g.beginPath(); g.moveTo(xs + 0.5, top0()); g.lineTo(xs + 0.5, H); g.stroke(); g.setLineDash([]); g.fillStyle = '#e6c15a'; g.fillText('¶', xs + 3, y - 1 + 6); }
      if (I.dotsDur) { g.fillStyle = '#ffd84d'; const xd = LX(s - I.dotsDur); for (let i = 0; i < 3; i++) { g.beginPath(); g.arc(xd + ((x1 - xd) * (i + 0.5)) / 3, y + h / 2, 3, 0, 6.3); g.fill(); } }
      g.save(); g.beginPath(); g.rect(x1, y, Math.max(2, x2 - x1), h); g.clip();
      if (sel) {
        g.strokeStyle = 'rgba(255,255,255,.75)'; g.fillStyle = '#fff'; g.font = '12px "Yu Gothic UI","Microsoft YaHei",sans-serif';
        l.units.forEach((u, i) => {
          const x = Math.round(LX(u.s)) + 0.5, nx = LX(K.unitEnd(l, i));
          g.beginPath(); g.moveTo(x, y + h * 0.5); g.lineTo(x, y + h); g.stroke();
          if (nx - x > 9 && u.t.trim()) g.fillText(u.t, x + 2, y + h * 0.28);
          if (i === K.ui.tapIdx && K.ui.tapArmed) { g.fillStyle = '#ffd84d'; g.fillRect(x - 1, y + h - 4, Math.max(3, nx - x), 4); g.fillStyle = '#fff'; }
        });
      } else { g.fillStyle = '#d5dae3'; g.font = '12px "Yu Gothic UI","Microsoft YaHei",sans-serif'; g.fillText(K.lineText(l), x1 + 4, y + h / 2); }
      g.restore(); g.font = '11px "Segoe UI",sans-serif';
    });
    /* 播放头 */
    const xp = Math.round(X(now)) + 0.5; g.strokeStyle = '#ff5a5a'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(xp, 0); g.lineTo(xp, H); g.stroke();
    g.fillStyle = '#ff5a5a'; g.beginPath(); g.moveTo(xp - 5, 0); g.lineTo(xp + 5, 0); g.lineTo(xp, 7); g.fill();
  };
})();
