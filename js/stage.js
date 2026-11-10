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
  /* 校时：把“当前时间”钉在离鼠标最近的边界上（字的开头；带注音的字还包括每一拍） */
  const bx = (L, b, l) => L.units[b.i].x + (L.units[b.i].w * b.j) / K.nMora(l.units[b.i]);
  function retime(l, o, b, T) {
    l.units = JSON.parse(o.units); l.end = o.end;
    if (b) K.setBoundary(l, b.i, b.j, T);
    else { l.end = T; l.units.forEach((x) => { if (x.s > T - 0.02) x.s = T - 0.02; if (x.m) x.m = x.m.map((v) => Math.min(v, T - 0.02)); }); K.fixLine(l); }
  }
  function move(e) {
    const p = pt(e);
    if (!drag) { const h = hit(p); cv.style.cursor = h ? (h.type === 'cursor' ? 'ew-resize' : 'pointer') : 'default'; return; }
    const l = drag.l, I = K.screen().info.get(l.id); if (!I) return;
    const G = K.geo(l, I, cv.width, cv.height), x = (p.x - G.x0) / G.s;
    if (drag.mode === 'scrub') { K.seek(K.edgeToTime(l, G.L, x) + K.S().offset); return; }
    let b = null, best = Math.abs(x - G.L.total);                       // null = 行结束
    K.bounds(l).forEach((c) => { const d = Math.abs(x - bx(G.L, c, l)); if (d < best) { best = d; b = c; } });
    const key = b ? b.i + ':' + b.j : 'end';
    if (key !== drag.b) { drag.b = key; drag.changed = true; retime(l, drag.orig, b, drag.T); K.touch(); }
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
      drag = { l: h.v.l, mode: K.ui.tool, T: K.r3(te()), b: '', changed: false, orig: { units: JSON.stringify(h.v.l.units), end: h.v.l.end } };
      move(e);
    });
    cv.addEventListener('pointermove', move);
    const up = () => { if (drag) { if (drag.mode === 'retime' && drag.changed) K.commit(); drag = null; K.invalidate(); } };
    cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
  };

  /* 每帧调用；时间 / 数据 / 字体 / 选中 / 显示尺寸 / 录屏模式都没变就跳过。拖动中、视频背景播放中总是重画 */
  let lastKey = '';
  K.stats = K.stats || { stage: 0, tl: 0 };
  K.drawStage = (video) => {
    const S = K.S(), rec = document.body.classList.contains('rec');
    let resized = false;
    if (cv.width !== S.W || cv.height !== S.H) { cv.width = S.W; cv.height = S.H; resized = true; }
    const vbg = !!(S.useVideoBg && video && video.videoWidth);
    const key = [K.now(), K.rev, K.inv, K.fontEpoch, K.ui.sel, rec, cv.clientWidth, cv.clientHeight, window.devicePixelRatio, vbg && video.readyState].join('|');
    if (key === lastKey && !resized && !drag && !(vbg && !video.paused)) return false;
    lastKey = key; K.stats.stage++;
    let bg = S.bgMode === 'color' ? 'color' : rec ? 'key' : 'none';
    if (vbg) bg = 'video';
    K.render(ctx, K.now(), { bg, video });
    if (rec) return true;
    /* ---- 编辑用叠加层（不会出现在导出里） ---- */
    const t = te(), U = u(), g = ctx;
    K.visible(t, cv.width, cv.height).forEach((v) => {
      const G = v.G, sel = v.l.id === K.ui.sel, top = G.y - G.top * G.s, bot = G.y + G.bottom * G.s;
      g.save();
      if (sel) { g.strokeStyle = 'rgba(90,169,255,.9)'; g.lineWidth = 1.5 * U; g.setLineDash([6 * U, 4 * U]); g.strokeRect(G.x0 - 8 * U, top - 4 * U, G.w + 16 * U, bot - top + 8 * U); g.setLineDash([]); }
      if (drag && drag.l === v.l && drag.mode === 'retime') {          // 拖动时显示所有字边界
        g.strokeStyle = 'rgba(255,255,255,.55)'; g.lineWidth = 1 * U;
        K.bounds(v.l).map((c) => [bx(G.L, c, v.l), c.j]).concat([[G.L.total, 0]]).forEach((q) => { const X = G.x0 + q[0] * G.s; g.beginPath(); g.moveTo(X, q[1] ? top - 6 * U : bot + 2 * U); g.lineTo(X, q[1] ? top + 2 * U : bot + 10 * U); g.stroke(); });
      }
      const ex = edgeX(v, t), col = sel ? '#5aa9ff' : 'rgba(255,255,255,.75)';
      g.strokeStyle = 'rgba(0,0,0,.6)'; g.lineWidth = 4 * U; g.beginPath(); g.moveTo(ex, top); g.lineTo(ex, bot + 12 * U); g.stroke();
      g.strokeStyle = col; g.lineWidth = 2 * U; g.beginPath(); g.moveTo(ex, top); g.lineTo(ex, bot + 12 * U); g.stroke();
      g.fillStyle = col; g.strokeStyle = 'rgba(0,0,0,.6)'; g.lineWidth = 1.5 * U;
      g.beginPath(); g.arc(ex, bot + 19 * U, 7 * U, 0, Math.PI * 2); g.fill(); g.stroke();
      g.restore();
    });
    return true;
  };
})();
