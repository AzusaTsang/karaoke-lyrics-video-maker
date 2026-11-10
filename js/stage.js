/* 预览舞台：点选歌词行、拖动擦除光标（校时 / 浏览）、Alt+拖动 = 移动这一行（位置偏移）、双击跳到行首、右键 = 行菜单。
   一行可以有好几排（行内换行）：光标画在正在唱的那一排；拖动时以鼠标下面的那一排为准 */
(function () {
  const K = window.K, T = (k, p) => K.t(k, p);
  let cv, ctx, drag = null, hov = null, hovAlt = false;
  const te = () => K.now() - K.S().offset;
  const u = () => cv.width / (cv.getBoundingClientRect().width || 1);       // 每个屏幕像素对应多少画布像素
  const pt = (e) => { const r = cv.getBoundingClientRect(); return { x: ((e.clientX - r.left) * cv.width) / r.width, y: ((e.clientY - r.top) * cv.height) / r.height }; };
  const edgeP = (v, t) => K.edgePt(v.G, K.progressEdge(v.l, v.G.L, t));     // 擦除光标：{k: 第几排, x, y}
  const rbox = (G, k) => K.rowBox(G, k);

  /* 光标的可抓范围：竖线左右 16 屏幕像素，往下包括圆形把手；alt = 按着 Alt（只认歌词本身，用来移动） */
  function hit(p, alt) {
    const t = te(), U = u(), vis = K.visible(t, cv.width, cv.height);
    if (!alt) for (const v of vis.slice().reverse()) {
      const e = edgeP(v, t), { top, bot } = rbox(v.G, e.k);
      if (Math.abs(p.x - e.x) < 16 * U && p.y > top - 8 * U && p.y < bot + 34 * U) return { type: 'cursor', v };
    }
    for (const v of vis.slice().reverse()) {
      const B = K.blockBox(v.G);
      if (p.x > B.x0 - 10 * U && p.x < B.x1 + 10 * U && p.y > B.top && p.y < B.bot) return { type: 'line', v };
    }
    return null;
  }
  /* 校时：把“当前时间”钉在离鼠标最近的边界上（字 / 音节的开头；带注音的字还包括每一拍）。只在鼠标所在的那一排里找 */
  const bx = (L, b, l) => L.units[b.i].x + (L.units[b.i].w * b.j) / K.nMora(l.units[b.i]);
  const btimes = (l) => K.bounds(l).map((b) => K.boundTime(l, b)).concat([l.end]);
  /* 边界 → 画布上的 x 和它所在的排（行结束算最后一排的末尾） */
  const bpos = (G, l, b) => { const k = b ? G.L.units[b.i].row : G.rows.length - 1, R = G.rows[k], X = b ? bx(G.L, b, l) : G.L.span; return { k, x: R.x0 + (X - R.off) * G.s }; };
  function retime(l, o, b, T) {
    l.units = JSON.parse(o.units); l.end = o.end;
    if (b) K.setBoundary(l, b.i, b.j, T); else K.setEnd(l, T);
  }
  /* Alt+拖动：位置偏移（画布宽 / 高的比例）。吸附到“没有偏移”和画布中线（整块的中心）；按住 Shift 不吸附 */
  function movePos(e, p) {
    const d = drag, S = K.S(), W = cv.width, H = cv.height, U = u(), tol = 10 * U;
    if (!d.moved && Math.hypot(p.x - d.x0, p.y - d.y0) < 3 * U) return;
    d.moved = true;
    let nx = d.dx0 * W + (p.x - d.x0), ny = d.dy0 * H + (p.y - d.y0), sx = false, sy = false;
    if (!e.shiftKey) {
      if (Math.abs(nx) < tol) { nx = 0; sx = true; } else if (Math.abs(d.cx + nx - W / 2) < tol) { nx = W / 2 - d.cx; sx = true; }
      if (Math.abs(ny) < tol) { ny = 0; sy = true; } else if (Math.abs(d.cy + ny - H / 2) < tol) { ny = H / 2 - d.cy; sy = true; }
    }
    const r5 = (v) => Math.round(v * 1e5) / 1e5;
    K.setOv(d.l, 'dx', r5(nx / W)); K.setOv(d.l, 'dy', r5(ny / H)); K.touch();
    const E = K.LS(d.l);
    K.tip(e.clientX, e.clientY, T('tip.pos', { x: Math.round((E.dx || 0) * S.W), y: Math.round((E.dy || 0) * S.H) }) + (sx || sy ? '\n' + T('tip.posSnap') : ''));
  }
  function move(e) {
    const p = pt(e);
    if (!drag) {
      const h = hit(p, e.altKey), nh = h && h.type === 'cursor' ? h.v.l.id : null;
      cv.style.cursor = h ? (e.altKey ? 'move' : h.type === 'cursor' ? 'ew-resize' : 'pointer') : 'default';
      hov = nh; hovAlt = e.altKey;
      return;
    }
    if (drag.mode === 'pos') { movePos(e, p); return; }
    const l = drag.l, I = K.screen().info.get(l.id); if (!I) return;
    if (!drag.moved && Math.hypot(p.x - drag.x0, p.y - drag.y0) < 3 * u()) return;          // 只点一下不改时间（竖着拖到另一排也算拖动）
    drag.moved = true;
    const G = K.geo(l, I, cv.width, cv.height), k = K.ptRow(G, p.y), x = K.ptX(G, p.x, k), last = k === G.rows.length - 1;
    if (drag.mode === 'scrub') { K.seek(K.edgeToTime(l, G.L, x) + K.S().offset); K.tip(e.clientX, e.clientY, K.fmt(K.now()) + '  (' + K.fmt3(K.now()) + ' s)'); return; }
    let b = null, best = last ? Math.abs(x - G.L.span) : Infinity;          // null = 行结束（只在最后一排）
    K.bounds(l).forEach((c) => { if (G.L.units[c.i].row !== k) return; const d = Math.abs(x - bx(G.L, c, l)); if (d < best) { best = d; b = c; } });
    if (!b && !last) return;
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
      const p = pt(e), h = hit(p, e.altKey);
      if (!h) { return; }
      K.select(h.v.l.id);
      const l = h.v.l;
      if (e.altKey) {                                         // Alt+拖动歌词 = 移动这一行
        try { cv.setPointerCapture(e.pointerId); } catch (err) {}
        const E = K.LS(l), G = h.v.G, B = K.blockBox(G);
        drag = { mode: 'pos', l, x0: p.x, y0: p.y, dx0: E.dx || 0, dy0: E.dy || 0, cx: (B.x0 + B.x1) / 2 - (E.dx || 0) * cv.width, cy: (B.top + B.bot) / 2 - (E.dy || 0) * cv.height, moved: false };
        e.preventDefault(); return;
      }
      if (h.type !== 'cursor') return;
      K.pause(); try { cv.setPointerCapture(e.pointerId); } catch (err) {}
      drag = { l, mode: K.ui.tool, T: K.r3(te()), b: '', x0: p.x, y0: p.y, moved: false, changed: false, pushed: new Set(), t0: btimes(l), orig: { units: JSON.stringify(l.units), end: l.end } };
      move(e);
    });
    cv.addEventListener('pointermove', move);
    cv.addEventListener('pointerleave', () => { if (!drag) hov = null; });
    const up = () => {
      if (drag) {
        if (drag.mode === 'retime' && drag.changed) K.commit('retime');
        else if (drag.mode === 'pos' && drag.moved) K.commit('linePos');
        drag = null; K.tipHide(); lastKey = '';
      }
    };
    cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
    cv.addEventListener('dblclick', (e) => {
      if (document.body.classList.contains('rec')) return;
      const h = hit(pt(e)); if (h) K.seek(Math.max(0, K.ls(h.v.l) + K.S().offset - 0.5));
    });
    /* 右键歌词 = 和时间线 / 列表相同的行菜单（含“位置恢复原样”） */
    cv.addEventListener('contextmenu', (e) => {
      if (document.body.classList.contains('rec')) return;
      const h = hit(pt(e), true); if (!h) return;
      e.preventDefault(); K.select(h.v.l.id); K.lineMenu(h.v.l, e.clientX, e.clientY);
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
    const key = [K.now(), K.rev, K.inv, K.fontEpoch, K.ui.sel, hov, hovAlt, rec, cv.clientWidth, cv.clientHeight, window.devicePixelRatio, vbg && video.readyState].join('|');
    if (key === lastKey && !resized && !drag && !(vbg && !video.paused)) return false;
    lastKey = key; K.stats.stage++;
    let bg = S.bgMode === 'color' ? 'color' : rec ? 'key' : 'none';
    if (vbg) bg = 'video';
    K.render(ctx, K.now(), { bg, video });
    if (rec) return true;
    /* ---- 编辑用叠加层（不会出现在导出里） ---- */
    const t = te(), U = u(), g = ctx;
    K.visible(t, cv.width, cv.height).forEach((v) => {
      const G = v.G, sel = v.l.id === K.ui.sel, B = K.blockBox(G), hv = hov === v.l.id || (drag && drag.l === v.l && drag.mode !== 'pos');
      g.save();
      if (sel) { g.strokeStyle = drag && drag.l === v.l && drag.mode === 'pos' ? '#ffb74d' : 'rgba(90,169,255,.9)'; g.lineWidth = 1.5 * U; g.setLineDash([6 * U, 4 * U]); g.strokeRect(B.x0 - 8 * U, B.top - 4 * U, B.x1 - B.x0 + 16 * U, B.bot - B.top + 8 * U); g.setLineDash([]); }
      if (drag && drag.l === v.l && drag.mode === 'retime') {          // 拖动时显示所有字边界；被挤动的标橙色
        const bs = K.bounds(v.l).map((c) => [bpos(G, v.l, c), c.j]).concat([[bpos(G, v.l, null), 0]]);
        bs.forEach((q, i) => {
          const X = q[0].x, { top, bot } = rbox(G, q[0].k), pu = drag.pushed.has(i);
          g.strokeStyle = pu ? '#ff9f43' : 'rgba(255,255,255,.55)'; g.lineWidth = (pu ? 3 : 1) * U;
          g.beginPath(); g.moveTo(X, q[1] ? top - 6 * U : bot + 2 * U); g.lineTo(X, q[1] ? top + 2 * U : bot + (pu ? 16 : 10) * U); g.stroke();
        });
      }
      const e = edgeP(v, t), ex = e.x, { top, bot } = rbox(G, e.k), col = sel ? '#5aa9ff' : 'rgba(255,255,255,.75)', R = (hv ? 10 : 7) * U;
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
