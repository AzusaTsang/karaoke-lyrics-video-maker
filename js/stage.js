/* 预览舞台：点选歌词行、拖动擦除光标 */
(function () {
  const K = window.K;
  let cv, ctx, drag = null;
  const te = () => K.now() - K.S().offset;
  const u = () => cv.width / (cv.getBoundingClientRect().width || 1);       // 每个屏幕像素对应多少画布像素
  const pt = (e) => { const r = cv.getBoundingClientRect(); return { x: ((e.clientX - r.left) * cv.width) / r.width, y: ((e.clientY - r.top) * cv.height) / r.height }; };
  const edgeX = (v, t) => v.G.x0 + K.progressEdge(v.l, v.G.L, t) * v.G.s;

  function hit(p) {
    const t = te(), U = u(), vis = K.visible(t, cv.width, cv.height);
    for (const v of vis.slice().reverse()) {
      const ex = edgeX(v, t), top = v.G.y - v.G.top * v.G.s, bot = v.G.y + v.G.bottom * v.G.s;
      if (Math.abs(p.x - ex) < 11 * U && p.y > top - 8 * U && p.y < bot + 30 * U) return { type: 'cursor', v };
    }
    for (const v of vis.slice().reverse()) {
      const top = v.G.y - v.G.top * v.G.s, bot = v.G.y + v.G.bottom * v.G.s;
      if (p.x > v.G.x0 - 10 * U && p.x < v.G.x0 + v.G.w + 10 * U && p.y > top && p.y < bot) return { type: 'line', v };
    }
    return null;
  }
  /* 校时：把“当前时间”钉在离鼠标最近的字边界上 */
  function retime(l, o, b, T) {
    l.units.forEach((x, i) => { x.s = o.units[i].s; if (o.units[i].e != null) x.e = o.units[i].e; else delete x.e; });
    l.end = o.end;
    const n = l.units.length;
    if (b < n) {
      l.units[b].s = T; delete l.units[b].e;
      for (let k = 0; k < b; k++) { if (l.units[k].s > T) l.units[k].s = T; if (l.units[k].e != null && l.units[k].e > T) delete l.units[k].e; }
      for (let k = b + 1; k < n; k++) if (l.units[k].s < T) l.units[k].s = T;
      if (l.end < T + 0.05) l.end = T + 0.05;
    } else {
      l.end = T; l.units.forEach((x) => { if (x.s > T - 0.02) x.s = T - 0.02; });
    }
    K.fixLine(l);
  }
  function move(e) {
    const p = pt(e);
    if (!drag) { const h = hit(p); cv.style.cursor = h ? (h.type === 'cursor' ? 'ew-resize' : 'pointer') : 'default'; return; }
    const l = drag.l, I = K.screen().info.get(l.id); if (!I) return;
    const G = K.geo(l, I, cv.width, cv.height), x = (p.x - G.x0) / G.s;
    if (drag.mode === 'scrub') { K.seek(K.edgeToTime(l, G.L, x) + K.S().offset); return; }
    let b = l.units.length, best = Math.abs(x - G.L.total);
    G.L.units.forEach((m, i) => { const d = Math.abs(x - m.x); if (d < best) { best = d; b = i; } });
    if (b !== drag.b) { drag.b = b; drag.changed = true; retime(l, drag.orig, b, drag.T); K.touch(); }
  }
  K.initStage = () => {
    cv = document.getElementById('cv'); ctx = cv.getContext('2d');
    cv.addEventListener('pointerdown', (e) => {
      if (document.body.classList.contains('rec')) { K.playing() ? K.pause() : K.play(); return; }
      const h = hit(pt(e));
      if (!h) { return; }
      K.select(h.v.l.id);
      if (h.type !== 'cursor') return;
      K.pause(); try { cv.setPointerCapture(e.pointerId); } catch (err) {}
      drag = { l: h.v.l, mode: K.ui.tool, T: K.r3(te()), b: -1, changed: false, orig: JSON.parse(JSON.stringify({ units: h.v.l.units, end: h.v.l.end })) };
      move(e);
    });
    cv.addEventListener('pointermove', move);
    const up = () => { if (drag) { if (drag.mode === 'retime' && drag.changed) K.commit(); drag = null; } };
    cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
  };

  K.drawStage = (video) => {
    const S = K.S(), rec = document.body.classList.contains('rec');
    if (cv.width !== S.W || cv.height !== S.H) { cv.width = S.W; cv.height = S.H; }
    let bg = S.bgMode === 'color' ? 'color' : rec ? 'key' : 'none';
    if (S.useVideoBg && video && video.videoWidth) bg = 'video';
    K.render(ctx, K.now(), { bg, video });
    if (rec) return;
    /* ---- 编辑用叠加层（不会出现在导出里） ---- */
    const t = te(), U = u(), g = ctx;
    K.visible(t, cv.width, cv.height).forEach((v) => {
      const G = v.G, sel = v.l.id === K.ui.sel, top = G.y - G.top * G.s, bot = G.y + G.bottom * G.s;
      g.save();
      if (sel) { g.strokeStyle = 'rgba(90,169,255,.9)'; g.lineWidth = 1.5 * U; g.setLineDash([6 * U, 4 * U]); g.strokeRect(G.x0 - 8 * U, top - 4 * U, G.w + 16 * U, bot - top + 8 * U); g.setLineDash([]); }
      if (drag && drag.l === v.l && drag.mode === 'retime') {          // 拖动时显示所有字边界
        g.strokeStyle = 'rgba(255,255,255,.55)'; g.lineWidth = 1 * U;
        G.L.units.map((m) => m.x).concat([G.L.total]).forEach((bx) => { const X = G.x0 + bx * G.s; g.beginPath(); g.moveTo(X, bot + 2 * U); g.lineTo(X, bot + 10 * U); g.stroke(); });
      }
      const ex = edgeX(v, t), col = sel ? '#5aa9ff' : 'rgba(255,255,255,.75)';
      g.strokeStyle = 'rgba(0,0,0,.6)'; g.lineWidth = 4 * U; g.beginPath(); g.moveTo(ex, top); g.lineTo(ex, bot + 12 * U); g.stroke();
      g.strokeStyle = col; g.lineWidth = 2 * U; g.beginPath(); g.moveTo(ex, top); g.lineTo(ex, bot + 12 * U); g.stroke();
      g.fillStyle = col; g.strokeStyle = 'rgba(0,0,0,.6)'; g.lineWidth = 1.5 * U;
      g.beginPath(); g.arc(ex, bot + 19 * U, 7 * U, 0, Math.PI * 2); g.fill(); g.stroke();
      g.restore();
    });
  };
})();
