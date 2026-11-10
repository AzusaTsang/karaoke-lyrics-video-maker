/* 预览舞台：点选歌词行、拖动擦除光标（校时 / 浏览）、双击跳到行首 */
(function () {
  const K = window.K, T = (k, p) => K.t(k, p);
  let cv, ctx, drag = null, hov = null;
  const te = () => K.now() - K.S().offset;
  const u = () => cv.width / (cv.getBoundingClientRect().width || 1);       // 每个屏幕像素对应多少画布像素
  const pt = (e) => { const r = cv.getBoundingClientRect(); return { x: ((e.clientX - r.left) * cv.width) / r.width, y: ((e.clientY - r.top) * cv.height) / r.height }; };
  const edgeX = (v, t) => v.G.x0 + K.progressEdge(v.l, v.G.L, t) * v.G.s;
  const box = (v, U) => ({ top: v.G.y - v.G.top * v.G.s, bot: v.G.y + v.G.bottom * v.G.s, U });

  /* 光标的可抓范围：竖线左右 16 屏幕像素，往下包括圆形把手 */
  function hit(p) {
    const t = te(), U = u(), vis = K.visible(t, cv.width, cv.height);
    for (const v of vis.slice().reverse()) {
      const ex = edgeX(v, t), { top, bot } = box(v, U);
      if (Math.abs(p.x - ex) < 16 * U && p.y > top - 8 * U && p.y < bot + 34 * U) return { type: 'cursor', v };
    }
    for (const v of vis.slice().reverse()) {
      const { top, bot } = box(v, U);
      if (p.x > v.G.x0 - 10 * U && p.x < v.G.x0 + v.G.w + 10 * U && p.y > top && p.y < bot) return { type: 'line', v };
    }
    return null;
  }
  /* 校时：把“当前时间”钉在离鼠标最近的边界上（字 / 音节的开头；带注音的字还包括每一拍） */
  const bx = (L, b, l) => L.units[b.i].x + (L.units[b.i].w * b.j) / K.nMora(l.units[b.i]);
  const btimes = (l) => K.bounds(l).map((b) => K.boundTime(l, b)).concat([l.end]);
  function retime(l, o, b, T) {
    l.units = JSON.parse(o.units); l.end = o.end;
    if (b) K.setBoundary(l, b.i, b.j, T); else K.setEnd(l, T);
  }
  function move(e) {
    const p = pt(e);
    if (!drag) {
      const h = hit(p), nh = h && h.type === 'cursor' ? h.v.l.id : null;
      cv.style.cursor = h ? (h.type === 'cursor' ? 'ew-resize' : 'pointer') : 'default';
      hov = nh;
      return;
    }
    const l = drag.l, I = K.screen().info.get(l.id); if (!I) return;
    if (!drag.moved && Math.abs(p.x - drag.x0) < 3 * u()) return;          // 只点一下不改时间
    drag.moved = true;
    const G = K.geo(l, I, cv.width, cv.height), x = (p.x - G.x0) / G.s;
    if (drag.mode === 'scrub') { K.seek(K.edgeToTime(l, G.L, x) + K.S().offset); K.tip(e.clientX, e.clientY, K.fmt(K.now()) + '  (' + K.fmt3(K.now()) + ' s)'); return; }
    let b = null, best = Math.abs(x - G.L.total);                       // null = 行结束
    K.bounds(l).forEach((c) => { const d = Math.abs(x - bx(G.L, c, l)); if (d < best) { best = d; b = c; } });
    const key = b ? b.i + ':' + b.j : 'end';
    if (key !== drag.b) {
      drag.b = key; drag.changed = true; retime(l, drag.orig, b, drag.T);
      /* 被挤动的其他边界（为了保持时间单调而跟着移动的字）在画面上标成橙色 */
      const now = btimes(l), self = b ? K.bounds(l).findIndex((c) => c.i === b.i && c.j === b.j) : now.length - 1;
      drag.pushed = new Set(now.map((v, i) => (i !== self && Math.abs(v - drag.t0[i]) > 1e-4 ? i : -1)).filter((i) => i >= 0));
      drag.label = (b ? T('tip.retime', { what: K.boundName(l, b), t: K.fmt3(drag.T) }) : T('tip.lineEnd', { t: K.fmt3(drag.T) })) + (drag.pushed.size ? '\n' + T('tip.pushed', { n: drag.pushed.size }) : '');
      K.touch();
    }
    K.tip(e.clientX, e.clientY, drag.label);
  }
  K.initStage = () => {
    cv = document.getElementById('cv'); ctx = cv.getContext('2d');
    cv.addEventListener('pointerdown', (e) => {
      if (document.body.classList.contains('rec')) { K.playing() ? K.pause() : K.play(); return; }
      if (e.button !== 0) return;
      const p = pt(e), h = hit(p);
      if (!h) { return; }
      K.select(h.v.l.id);
      if (h.type !== 'cursor') return;
      K.pause(); try { cv.setPointerCapture(e.pointerId); } catch (err) {}
      const l = h.v.l;
      drag = { l, mode: K.ui.tool, T: K.r3(te()), b: '', x0: p.x, moved: false, changed: false, pushed: new Set(), t0: btimes(l), orig: { units: JSON.stringify(l.units), end: l.end } };
      move(e);
    });
    cv.addEventListener('pointermove', move);
    cv.addEventListener('pointerleave', () => { if (!drag) hov = null; });
    const up = () => { if (drag) { if (drag.mode === 'retime' && drag.changed) K.commit('retime'); drag = null; K.tipHide(); lastKey = ''; } };
    cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
    cv.addEventListener('dblclick', (e) => {
      if (document.body.classList.contains('rec')) return;
      const h = hit(pt(e)); if (h) K.seek(Math.max(0, K.ls(h.v.l) + K.S().offset - 0.5));
    });
  };

  /* 每帧调用；时间 / 数据 / 字体 / 选中 / 悬停 / 显示尺寸 / 录屏模式都没变就跳过。拖动中、视频背景播放中总是重画 */
  let lastKey = '';
  K.stats = K.stats || { stage: 0, tl: 0 };
  K.drawStage = (video) => {
    const S = K.S(), rec = document.body.classList.contains('rec');
    let resized = false;
    if (cv.width !== S.W || cv.height !== S.H) { cv.width = S.W; cv.height = S.H; resized = true; }
    const vbg = !!(S.useVideoBg && video && video.videoWidth);
    const key = [K.now(), K.rev, K.inv, K.fontEpoch, K.ui.sel, hov, rec, cv.clientWidth, cv.clientHeight, window.devicePixelRatio, vbg && video.readyState].join('|');
    if (key === lastKey && !resized && !drag && !(vbg && !video.paused)) return false;
    lastKey = key; K.stats.stage++;
    let bg = S.bgMode === 'color' ? 'color' : rec ? 'key' : 'none';
    if (vbg) bg = 'video';
    K.render(ctx, K.now(), { bg, video });
    if (rec) return true;
    /* ---- 编辑用叠加层（不会出现在导出里） ---- */
    const t = te(), U = u(), g = ctx;
    K.visible(t, cv.width, cv.height).forEach((v) => {
      const G = v.G, sel = v.l.id === K.ui.sel, { top, bot } = box(v, U), hv = hov === v.l.id || (drag && drag.l === v.l);
      g.save();
      if (sel) { g.strokeStyle = 'rgba(90,169,255,.9)'; g.lineWidth = 1.5 * U; g.setLineDash([6 * U, 4 * U]); g.strokeRect(G.x0 - 8 * U, top - 4 * U, G.w + 16 * U, bot - top + 8 * U); g.setLineDash([]); }
      if (drag && drag.l === v.l && drag.mode === 'retime') {          // 拖动时显示所有字边界；被挤动的标橙色
        const B = K.bounds(v.l).map((c) => [bx(G.L, c, v.l), c.j]).concat([[G.L.total, 0]]);
        B.forEach((q, i) => {
          const X = G.x0 + q[0] * G.s, pu = drag.pushed.has(i);
          g.strokeStyle = pu ? '#ff9f43' : 'rgba(255,255,255,.55)'; g.lineWidth = (pu ? 3 : 1) * U;
          g.beginPath(); g.moveTo(X, q[1] ? top - 6 * U : bot + 2 * U); g.lineTo(X, q[1] ? top + 2 * U : bot + (pu ? 16 : 10) * U); g.stroke();
        });
      }
      const ex = edgeX(v, t), col = sel ? '#5aa9ff' : 'rgba(255,255,255,.75)', R = (hv ? 10 : 7) * U;
      g.strokeStyle = 'rgba(0,0,0,.6)'; g.lineWidth = (hv ? 6 : 4) * U; g.beginPath(); g.moveTo(ex, top); g.lineTo(ex, bot + 12 * U); g.stroke();
      g.strokeStyle = col; g.lineWidth = (hv ? 3 : 2) * U; g.beginPath(); g.moveTo(ex, top); g.lineTo(ex, bot + 12 * U); g.stroke();
      if (hv) { g.fillStyle = 'rgba(90,169,255,.25)'; g.beginPath(); g.arc(ex, bot + 19 * U, R + 6 * U, 0, Math.PI * 2); g.fill(); }
      g.fillStyle = col; g.strokeStyle = 'rgba(0,0,0,.6)'; g.lineWidth = 1.5 * U;
      g.beginPath(); g.arc(ex, bot + 19 * U, R, 0, Math.PI * 2); g.fill(); g.stroke();
      g.restore();
    });
    return true;
  };
})();
