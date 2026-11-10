window.addEventListener('load', async () => {
  const out = {}; const K = window.K, wait = (ms) => new Promise(r => setTimeout(r, ms));
  const ev = (el, type, x, y, o) => el.dispatchEvent(new PointerEvent(type, Object.assign({ clientX: x, clientY: y, bubbles: true, pointerId: 1, button: 0 }, o || {})));
  try {
    localStorage.clear();
    K.setProject(K.normalizeProject(K.SAMPLES[0].project)); await K.ensureFont(); await wait(200);
    const S = K.S(), cv = document.getElementById('cv'), tlc = document.getElementById('tlc');
    let sc = K.screen(); const l = sc.ord[2], l4 = sc.ord[3], l5 = sc.ord[4];
    // 分段让位
    K.ops.set(l5, 'newPara', true); sc = K.screen();
    out.paraAfterPrevEnd = sc.info.get(l5.id).show >= l4.end - 1e-6; out.prevHide = +sc.info.get(l4.id).hide.toFixed(2); out.l5show = +sc.info.get(l5.id).show.toFixed(2); out.l5start = K.ls(l5); K.undo();
    // ---- A. 舞台：拖擦除光标校时 ----
    const T0 = 28.0; K.select(l.id); K.seek(T0); await wait(100);
    const toClient = (cx, cy) => { const r = cv.getBoundingClientRect(); return [r.left + cx * r.width / cv.width, r.top + cy * r.height / cv.height]; };
    const I = K.screen().info.get(l.id), G = K.geo(l, I, cv.width, cv.height);
    const ex = G.x0 + K.progressEdge(l, G.L, T0) * G.s, k = 6;      // 目标：第 7 个单元的起点
    const before = l.units[k].s;
    let [x, y] = toClient(ex, G.y - S.size * 0.4); ev(cv, 'pointerdown', x, y);
    let [x2] = toClient(G.x0 + G.L.units[k].x * G.s + 1, 0); ev(cv, 'pointermove', x2, y); ev(cv, 'pointerup', x2, y);
    out.retime = { unit: K.line(l.id).units[k].t, before, after: K.line(l.id).units[k].s, expect: T0 };
    out.mono = K.line(l.id).units.every((u, i, a) => !i || u.s >= a[i - 1].s);
    K.undo(); out.retimeUndo = K.line(l.id).units[k].s === before;
    // 按假名（拍）拖：第 1 个字 王道{おうどう} 的第 3 拍
    { const c = K.line(l.id), u0 = c.units[0], n = K.nMora(u0); K.seek(27.95); await wait(50);
      const I3 = K.screen().info.get(c.id), G3 = K.geo(c, I3, cv.width, cv.height), e3 = G3.x0 + K.progressEdge(c, G3.L, 27.95) * G3.s;
      const [ax, ay] = toClient(e3, G3.y - S.size * 0.4), [ax2] = toClient(G3.x0 + (G3.L.units[0].x + G3.L.units[0].w * 2 / n) * G3.s, 0);
      ev(cv, 'pointerdown', ax, ay); ev(cv, 'pointermove', ax2, ay); ev(cv, 'pointerup', ax2, ay);
      const r0 = K.line(l.id).units[0]; out.mora = { ruby: r0.r, n, m: r0.m, s: r0.s, expect3rd: 27.95 };
      const L0 = K.line(l.id), Gm = K.geo(L0, I3, cv.width, cv.height); out.moraEdgeFrac = +(K.progressEdge(L0, Gm.L, 27.95) / Gm.L.units[0].w).toFixed(3);
      K.undo(); K.seek(T0); await wait(50); }
    // 长音：最后一个字应一直擦到行结束，中途是部分进度
    { const c = K.line(l.id), li = c.units.length - 1, u = c.units[li], Lc = K.layout(c), mid = (u.s + c.end) / 2;
      out.longNote = { hasE: c.units.some((x) => x.e != null), end: c.end, lastStart: u.s, fracAtMid: +((K.progressEdge(c, Lc, mid) - Lc.units[li].x) / Lc.units[li].w).toFixed(2) }; }
    // ---- B. 浏览模式 ----
    K.ui.tool = 'scrub'; const L2 = K.line(l.id); K.seek(T0); await wait(50);
    { const I2 = K.screen().info.get(L2.id), G2 = K.geo(L2, I2, cv.width, cv.height), e2 = G2.x0 + K.progressEdge(L2, G2.L, K.now()) * G2.s;
      const [bx, by] = toClient(e2, G2.y - K.S().size * 0.4), [bx2] = toClient(G2.x0 + G2.L.units[k].x * G2.s + 1, 0);
      out.scrubDbg = { nowBefore: K.now(), coordShift: +(bx - x).toFixed(1), sel: K.ui.sel === L2.id };
      ev(cv, 'pointerdown', bx, by); ev(cv, 'pointermove', bx2, by); ev(cv, 'pointerup', bx2, by); }
    out.scrub = { now: +K.now().toFixed(3), expect: L2.units[k].s }; K.ui.tool = 'retime';
    // ---- C. 时间线 ----
    K.tl.pps = 80; K.tl.scroll = 24; await wait(100);
    const r = tlc.getBoundingClientRect(), TX = (t) => r.left + (t - K.tl.scroll) * 80, top0 = 22, TRK = 46;
    let cur = K.line(l.id), Ic = K.screen().info.get(cur.id), yb = r.top + top0 + Ic.row * TRK + 12, s0 = K.ls(cur);
    // 整行平移 +1s
    ev(tlc, 'pointerdown', TX(s0 + 0.5), yb); ev(tlc, 'pointermove', TX(s0 + 0.5) + 80, yb); ev(tlc, 'pointerup', TX(s0 + 0.5) + 80, yb);
    out.move = +(K.ls(K.line(l.id)) - s0).toFixed(3); K.undo();
    // 拖到第 3 行
    ev(tlc, 'pointerdown', TX(s0 + 0.5), yb); ev(tlc, 'pointermove', TX(s0 + 0.5) + 3, yb + 2 * TRK); ev(tlc, 'pointerup', TX(s0 + 0.5) + 3, yb + 2 * TRK);
    out.rowDrag = K.line(l.id).row; K.undo();
    // 字刻度：第 4 个单元 +0.05s（下半部）
    cur = K.line(l.id); const u3 = cur.units[3].s, yt = r.top + top0 + Ic.row * TRK + 36;
    ev(tlc, 'pointerdown', TX(u3), yt); ev(tlc, 'pointermove', TX(u3) + 4, yt); ev(tlc, 'pointerup', TX(u3) + 4, yt);
    out.tick = +(K.line(l.id).units[3].s - u3).toFixed(3); K.undo();
    // 出现边界：往右拖 40px → 手动 showAt；双击恢复
    Ic = K.screen().info.get(l.id); const xs = TX(Ic.show);
    ev(tlc, 'pointerdown', xs + 1, yb); ev(tlc, 'pointermove', xs + 41, yb); ev(tlc, 'pointerup', xs + 41, yb);
    out.showDrag = { auto: +Ic.show.toFixed(2), now: K.line(l.id).showAt };
    tlc.dispatchEvent(new MouseEvent('dblclick', { clientX: TX(K.line(l.id).showAt) + 1, clientY: yb, bubbles: true })); out.showReset = K.line(l.id).showAt;
    // 打点
    K.select(l.id); K.ui.tapIdx = 0; K.ops.tap(27.5); K.ops.tap(27.9); out.tap = [K.line(l.id).units[0].s, K.line(l.id).units[1].s, K.ui.tapIdx];
    // 导出路径：透明帧
    const c = document.createElement('canvas'); c.width = S.W; c.height = S.H; const g = c.getContext('2d');
    out.blank = K.render(g, 5, { bg: 'none' }); out.drew = K.render(g, 28.5, { bg: 'none' }); out.cornerAlpha = g.getImageData(0, 0, 1, 1).data[3];
    // 保存 / 读回
    const p2 = K.normalizeProject(JSON.parse(JSON.stringify(K.project))); out.roundtrip = JSON.stringify(p2.lines) === JSON.stringify(K.project.lines);
    { K.showTab("style"); await wait(100); const fp = document.getElementById("fontPick"); out.fontOpts = fp.options.length; fp.value = "Meiryo"; fp.dispatchEvent(new Event("change", { bubbles: true })); out.fontSet = K.S().font; K.undo(); }
    K.setProject(K.normalizeProject(K.SAMPLES[1].project)); out.fr = K.screen().ord.length;
    K.setProject(K.normalizeProject(K.SAMPLES[0].project)); const d = K.ops.dup(K.screen().ord[2]); K.seek(28.6); K.tl.scroll = 22; await wait(300);
  } catch (e) { out.error = String(e && e.stack || e); }
  const pre = document.createElement('pre'); pre.id = 'result'; pre.textContent = JSON.stringify(out); document.body.appendChild(pre);
});
