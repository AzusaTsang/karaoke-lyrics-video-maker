/* 屏幕模型（段落 / 行位 / 显示窗口 / 预备点）与 Canvas 渲染 */
(function () {
  const K = window.K;

  /* ---------- 屏幕模型 ----------
     段落：手动分段(newPara) 或 与前面歌词间隔 >= paraGap 自动分段。
     段内各行轮流占用“行位”(row)，行位空出后才显示下一句；段与段之间不互相预显。 */
  let scCache = { rev: -1 };
  K.screen = () => {
    if (scCache.rev === K.rev) return scCache;
    const S = K.S(), ord = K.project.lines.slice().sort((a, b) => K.ls(a) - K.ls(b));
    const info = new Map(), paras = [];
    let prevEnd = -1e9;
    ord.forEach((l, i) => {
      const gap = K.ls(l) - prevEnd;
      const brk = i === 0 || (l.newPara != null ? l.newPara : gap >= S.paraGap);
      if (brk) paras.push({ lines: [], gap, first: i === 0 });
      paras[paras.length - 1].lines.push(l);
      prevEnd = Math.max(prevEnd, l.end);
    });
    let prevHide = -1e9, maxRow = 0;
    paras.forEach((p, pi) => {
      const rowSeq = {}; let ac = 0;
      const nextStart = paras[pi + 1] ? K.ls(paras[pi + 1].lines[0]) : 1e9;
      p.lines.forEach((l) => {
        let row = l.row;
        if (row == null) {
          let c = ac % S.rows;
          for (let n = 0; n < S.rows; n++) {
            const seq = rowSeq[c], last = seq && seq[seq.length - 1];
            if (last && last.end > K.ls(l) + 0.01) c = (c + 1) % S.rows; else break;
          }
          row = c; ac = c + 1;
        }
        (rowSeq[row] = rowSeq[row] || []).push(l);
        maxRow = Math.max(maxRow, row);
        info.set(l.id, { row, para: false, pi, auto: l.row == null });
      });
      const first = p.lines[0], fs = K.ls(first), FI = info.get(first.id);
      const autoDots = p.first || p.gap >= (first.newPara === true ? 1.2 : S.paraGap);
      p.lines.forEach((l) => { info.get(l.id).dotsOn = S.dots && (l.dots != null ? l.dots : l === first && autoDots); });
      FI.para = true;
      const lead = FI.dotsOn ? Math.max(S.lead, S.dotsDur + 0.4) : S.lead;
      const pShow = Math.min(Math.max(fs - lead, prevHide), fs - 0.05);
      let maxHide = -1e9;
      Object.keys(rowSeq).forEach((r) => {
        const seq = rowSeq[r];
        seq.forEach((l, k) => {
          const I = info.get(l.id), nx = seq[k + 1];
          let h = l.end + S.hold;
          if (nx) h = Math.max(l.end, Math.min(h, K.ls(nx) - 0.3 - S.fadeOut));
          h = Math.max(Math.min(l.end, nextStart - 0.05), Math.min(h, nextStart - 0.3 - S.fadeOut));   // 下一段开始前让位
          I.autoHide = h; I.hide = l.hideAt != null ? l.hideAt : h;
        });
        seq.forEach((l, k) => {
          const I = info.get(l.id), pv = seq[k - 1], st = K.ls(l);
          const free = pv ? info.get(pv.id).hide + S.fadeOut : pShow;
          let s = Math.max(free, pShow, st - S.preShow);
          if (I.dotsOn && l !== first) s = Math.min(s, Math.max(free, st - S.dotsDur - 0.4));
          s = Math.min(s, st - 0.05);
          I.autoShow = s; I.show = l.showAt != null ? l.showAt : s;
          I.dotsDur = I.dotsOn ? Math.min(S.dotsDur, st - I.show - 0.05) : 0;
          if (I.dotsDur < 0.6) I.dotsDur = 0;
          I.align = l.align || (S.layout === 'stack' ? 'center' : ['left', 'right', 'center'][I.row % 3]);
          maxHide = Math.max(maxHide, I.hide + S.fadeOut);
        });
      });
      prevHide = maxHide;
    });
    scCache = { rev: K.rev, ord, info, maxRow, rows: Math.max(S.rows, maxRow + 1) };
    return scCache;
  };

  /* ---------- 文字布局 ---------- */
  const mc = document.createElement('canvas').getContext('2d');
  const fw = (S) => (S.weight === 'normal' ? '' : S.weight + ' ');
  K.fontBase = () => { const S = K.S(); return `${fw(S)}${S.size}px ${S.font}`; };
  K.fontRuby = () => { const S = K.S(); return `${fw(S)}${S.size * S.rubyRatio}px ${S.font}`; };
  const lay = new WeakMap();
  K.fontEpoch = 0;
  K.layout = (l) => {
    const c = lay.get(l); if (c && c.rev === K.rev && c.fe === K.fontEpoch) return c;
    const S = K.S(), units = []; let x = 0;
    l.units.forEach((u) => {
      mc.font = K.fontBase(); const bw = mc.measureText(u.t).width + S.spacing * [...u.t].length;
      let rw = 0; if (u.r) { mc.font = K.fontRuby(); rw = mc.measureText(u.r).width + S.spacing * 0.5 * [...u.r].length; }
      const w = Math.max(bw, rw); units.push({ x, w, bw, rw }); x += w;
    });
    const L = { rev: K.rev, fe: K.fontEpoch, units, total: x }; lay.set(l, L); return L;
  };
  K.rowStep = () => { const S = K.S(); return S.size * (1 + S.rubyRatio) + S.rubyGap + S.size * S.lineGap; };
  /* 一行在画布上的几何：x0 左端、y 基线、s 缩放 */
  K.geo = (l, I, W, H) => {
    const S = K.S(), L = K.layout(l), s = L.total ? Math.min(1, (S.maxW * W) / L.total) : 1, w = L.total * s, m = S.marginX * W;
    const x0 = I.align === 'left' ? m : I.align === 'right' ? W - m - w : (W - w) / 2;
    return { L, s, w, x0, y: S.posY * H + I.row * K.rowStep(), top: S.size * (0.86 + S.rubyRatio) + S.rubyGap, bottom: S.size * 0.22 };
  };
  K.progressEdge = (l, L, t) => {
    let edge = 0;
    l.units.forEach((u, i) => {
      if (t <= u.s) return;
      const T = K.subTimes(l, i), n = T.length - 1; let p = 1;
      for (let j = 0; j < n; j++) if (t < T[j + 1]) { p = (j + (T[j + 1] > T[j] ? (t - T[j]) / (T[j + 1] - T[j]) : 1)) / n; break; }
      edge = Math.max(edge, L.units[i].x + L.units[i].w * p);
    });
    return edge;
  };
  /* 擦除位置（行内未缩放坐标）→ 时间 */
  K.edgeToTime = (l, L, x) => {
    if (x <= 0) return K.ls(l);
    for (let i = 0; i < l.units.length; i++) {
      const m = L.units[i];
      if (x <= m.x + m.w) { const T = K.subTimes(l, i), n = T.length - 1, f = (m.w ? (x - m.x) / m.w : 0) * n, j = Math.min(n - 1, Math.floor(f)); return T[j] + (f - j) * (T[j + 1] - T[j]); }
    }
    return l.end;
  };

  /* ---------- 绘制 ---------- */
  function paint(g, text, x, y, fill, stroke, sw, spacing) {
    const draw = (fn) => { if (!spacing) { fn(text, x, y); return; } let cx = x; for (const ch of text) { fn(ch, cx, y); cx += g.measureText(ch).width + spacing; } };
    if (sw > 0) { g.lineJoin = 'round'; g.miterLimit = 2; g.lineWidth = sw * 2; g.strokeStyle = stroke; draw((t, a, b) => g.strokeText(t, a, b)); }
    g.fillStyle = fill; draw((t, a, b) => g.fillText(t, a, b));
  }
  function drawPass(g, l, L, high) {
    const S = K.S(), rubyY = -(S.size * 0.86 + S.rubyGap), fb = K.fontBase(), fr = K.fontRuby();
    l.units.forEach((u, i) => {
      const m = L.units[i];
      if (u.t.trim() !== '') { g.font = fb; paint(g, u.t, m.x + (m.w - m.bw) / 2, 0, high ? S.highFill : S.baseFill, high ? S.highStroke : S.baseStroke, S.strokeW, S.spacing); }
      if (u.r) { g.font = fr; paint(g, u.r, m.x + (m.w - m.rw) / 2, rubyY, high ? S.rubyHighFill : S.rubyFill, high ? S.rubyHighStroke : S.rubyStroke, S.rubyStrokeW, S.spacing * 0.5); }
    });
  }
  function drawLine(g, l, G, t, alpha) {
    const S = K.S(), L = G.L; if (!L.total) return;
    g.save(); g.globalAlpha = alpha; g.translate(G.x0, G.y); g.scale(G.s, G.s);
    g.textBaseline = 'alphabetic'; g.textAlign = 'left';
    if (S.glow > 0) { g.shadowColor = S.glowColor; g.shadowBlur = S.glow; }
    drawPass(g, l, L, false); g.shadowBlur = 0;
    const edge = K.progressEdge(l, L, t);
    if (edge > 0) {
      g.save(); g.beginPath(); g.rect(-S.size, -S.size * 3, edge + S.size, S.size * 5); g.clip();
      if (S.glow > 0) { g.shadowColor = S.glowColor; g.shadowBlur = S.glow; }
      drawPass(g, l, L, true); g.restore();
    }
    g.restore();
  }
  function drawDots(g, l, I, G, t, alpha) {
    const S = K.S(), s0 = K.ls(l), dur = I.dotsDur; if (!dur || t >= s0) return;
    const el = t - (s0 - dur), R = (S.size * S.dotSize) / 2, gap = R * 0.8, unit = dur / 3;
    const y = G.y - G.top * G.s - R * 1.6;
    g.save(); g.globalAlpha = alpha;
    for (let i = 0; i < 3; i++) {
      const p = (el - i * unit) / unit, m = p <= 0 ? 1 : p >= 1 ? 0 : 1 - p; if (m <= 0) continue;
      const cx = G.x0 + R + i * (2 * R + gap), on = p > 0;
      g.beginPath(); g.arc(cx, y, R * m, 0, Math.PI * 2);
      g.lineWidth = S.strokeW * 0.7 * m * 2; g.strokeStyle = on ? S.highStroke : S.baseStroke; if (g.lineWidth > 0) g.stroke();
      g.fillStyle = on ? S.highFill : S.baseFill; g.fill();
    }
    g.restore();
  }
  K.lineAlpha = (I, t) => {
    const S = K.S(); let a = 1;
    if (S.fadeIn > 0) a = Math.min(a, (t - I.show) / S.fadeIn);
    if (S.fadeOut > 0) a = Math.min(a, 1 - (t - I.hide) / S.fadeOut); else if (t > I.hide) a = 0;
    return Math.max(0, Math.min(1, a));
  };
  /* 某时刻可见的行：[{l, I, G, a}] */
  K.visible = (t, W, H) => {
    const S = K.S(), sc = K.screen(), out = [];
    for (const l of sc.ord) {
      const I = sc.info.get(l.id);
      if (t < I.show || t > I.hide + S.fadeOut) continue;
      const a = K.lineAlpha(I, t); if (a <= 0) continue;
      out.push({ l, I, G: K.geo(l, I, W, H), a });
    }
    return out;
  };
  /* t 为媒体时间；返回是否画了歌词 */
  K.render = (g, t, opts) => {
    const S = K.S(), W = g.canvas.width, H = g.canvas.height;
    g.clearRect(0, 0, W, H);
    if (opts.bg === 'color') { g.fillStyle = S.bgColor; g.fillRect(0, 0, W, H); }
    else if (opts.bg === 'key') { g.fillStyle = S.keyColor; g.fillRect(0, 0, W, H); }
    else if (opts.bg === 'video' && opts.video && opts.video.readyState >= 2) {
      const v = opts.video, k = Math.max(W / v.videoWidth, H / v.videoHeight);
      g.drawImage(v, (W - v.videoWidth * k) / 2, (H - v.videoHeight * k) / 2, v.videoWidth * k, v.videoHeight * k);
    }
    const te = t - S.offset, vis = K.visible(te, W, H);
    vis.forEach((v) => { drawLine(g, v.l, v.G, te, v.a); drawDots(g, v.l, v.I, v.G, te, v.a); });
    return vis.length > 0;
  };
  K.ensureFont = async () => {
    const sample = [...new Set(K.project.lines.map(K.lineText).join('') + 'あ')].join('');
    try { await Promise.all([document.fonts.load(K.fontBase(), sample), document.fonts.load(K.fontRuby(), 'あいう')]); } catch (e) {}
    K.fontEpoch++;
  };
  /* 字体随时可能加载完（如画布第一次用到某个网页字体）：让排版缓存和画面失效 */
  if (document.fonts && document.fonts.addEventListener) document.fonts.addEventListener('loadingdone', () => { K.fontEpoch++; });
})();
