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
      /* 预备点时长可以按行覆盖（l.o.dotsDur）：段首行的提前量、每行的显示时间都按这一行自己的时长算 */
      const lead = FI.dotsOn ? Math.max(S.lead, K.LS(first).dotsDur + 0.4) : S.lead;
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
          const I = info.get(l.id), pv = seq[k - 1], st = K.ls(l), dd = K.LS(l).dotsDur;
          const free = pv ? info.get(pv.id).hide + S.fadeOut : pShow;
          let s = Math.max(free, pShow, st - S.preShow);
          if (I.dotsOn && l !== first) s = Math.min(s, Math.max(free, st - dd - 0.4));
          s = Math.min(s, st - 0.05);
          I.autoShow = s; I.show = l.showAt != null ? l.showAt : s;
          I.dotsDur = I.dotsOn ? Math.min(dd, st - I.show - 0.05) : 0;
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
  /* E = 一行的有效设置（K.LS(l)）；不传 = 全局设置 */
  K.fontBase = (E) => { E = E || K.S(); return `${fw(E)}${E.size}px ${E.font}`; };
  K.fontRuby = (E) => { E = E || K.S(); return `${fw(E)}${E.size * E.rubyRatio}px ${E.font}`; };
  const lay = new WeakMap(), blankU = (u) => !u.r && !u.t.trim();
  K.fontEpoch = 0;
  /* 排版（未缩放）：units[i] = {x, w, bw, rw, row}，x 是“展平”坐标——各排首尾相接，所以擦除进度在排与排之间是连续、单调的；
     rows[k] = {a, b: 单元范围, off: 这一排在展平坐标里的起点, w: 宽}；total = 最宽的一排（用来按最大宽度缩放整块），span = 展平总长。
     行内换行两边的空白宽度为 0（不在一排的头尾占位置）。缓存按 rev / 字体 / 有效字体字号字间距 */
  K.layout = (l) => {
    const E = K.LS(l), fb = K.fontBase(E), fr = K.fontRuby(E), c = lay.get(l);
    if (c && c.rev === K.rev && c.fe === K.fontEpoch && c.fb === fb && c.fr === fr && c.sp === E.spacing) return c;
    const U = l.units, units = [], rows = [], z = U.map(() => false); let x = 0, a = 0, ro = 0, rb = false;
    U.forEach((u, i) => { if (!u.n || !i) return; for (let j = i - 1; j >= 0 && blankU(U[j]); j--) z[j] = true; for (let j = i; j < U.length && blankU(U[j]); j++) z[j] = true; });
    U.forEach((u, i) => {
      if (u.n && i) { rows.push({ a, b: i, off: ro, w: x - ro }); a = i; ro = x; }
      if (rows.length && u.r) rb = true;
      mc.font = fb; const bw = mc.measureText(u.t).width + E.spacing * [...u.t].length;
      let rw = 0; if (u.r) { mc.font = fr; rw = mc.measureText(u.r).width + E.spacing * 0.5 * [...u.r].length; }
      const w = z[i] ? 0 : Math.max(bw, rw); units.push({ x, w, bw, rw, row: rows.length }); x += w;
    });
    rows.push({ a, b: U.length, off: ro, w: x - ro });
    const L = { rev: K.rev, fe: K.fontEpoch, fb, fr, sp: E.spacing, units, rows, total: Math.max(...rows.map((r) => r.w)), span: x, rb }; lay.set(l, L); return L;
  };
  K.rowStep = () => { const S = K.S(); return S.size * (1 + S.rubyRatio) + S.rubyGap + S.size * S.lineGap; };
  /* 一行之内两排基线的距离（未缩放）：字号 ×(1 + 换行间距)，第 2 排起有注音时再加上注音的高度，免得下一排的注音碰到上一排 */
  K.wrapStep = (E, L) => E.size * (1 + E.wrapGap) + (L.rb ? E.size * E.rubyRatio + E.rubyGap : 0);
  /* 多排的一行往哪边长：行属性 grow；自动 = 行位在上半部分（含正中间、只有一个行位）往上长（最后一排在行位基线上），其余往下长（第一排在基线上） */
  K.growAuto = (I) => { const n = K.screen().rows; return n <= 1 || I.row <= (n - 1) / 2 ? 'up' : 'down'; };
  K.grow = (l, I) => { const g = K.LS(l).grow; return g && g !== 'auto' ? g : K.growAuto(I); };
  /* 一行在画布上的几何：s 缩放；rows[k] = {x0 左端, y 基线, w 宽, off, lw: 未缩放宽, a, b}；
     x0 / w = 整块的左端 / 宽度，y = 第一排基线；top / bottom = 基线上下的高度（未缩放）。位置偏移 dx / dy 加在整块上 */
  K.geo = (l, I, W, H) => {
    const S = K.S(), E = K.LS(l), L = K.layout(l), s = L.total ? Math.min(1, (E.maxW * W) / L.total) : 1, m = S.marginX * W, N = L.rows.length;
    const dx = (E.dx || 0) * W, base = S.posY * H + I.row * K.rowStep() + (E.dy || 0) * H;
    const st = N > 1 ? K.wrapStep(E, L) * s : 0, gr = N > 1 ? K.grow(l, I) : 'down', k0 = gr === 'up' ? N - 1 : gr === 'center' ? (N - 1) / 2 : 0;
    const rows = L.rows.map((r, k) => { const w = r.w * s; return { x0: (I.align === 'left' ? m : I.align === 'right' ? W - m - w : (W - w) / 2) + dx, y: base + (k - k0) * st, w, off: r.off, lw: r.w, a: r.a, b: r.b }; });
    let x0 = rows[0].x0, x1 = x0 + rows[0].w; rows.forEach((r) => { x0 = Math.min(x0, r.x0); x1 = Math.max(x1, r.x0 + r.w); });
    return { L, s, w: N > 1 ? x1 - x0 : rows[0].w, x0, y: rows[0].y, rows, top: E.size * (0.86 + E.rubyRatio) + E.rubyGap, bottom: E.size * 0.22 };
  };
  /* 展平坐标 X → 第几排（正好在两排交界处算下一排的开头） */
  K.rowOfX = (G, X) => { const R = G.rows; let k = 0; while (k + 1 < R.length && X >= R[k + 1].off - 1e-9) k++; return k; };
  /* 展平坐标 X → 画布上的点 {k, x, y(基线)} */
  K.edgePt = (G, X) => { const k = K.rowOfX(G, X), R = G.rows[k]; return { k, x: R.x0 + (X - R.off) * G.s, y: R.y }; };
  /* 第 k 排的上下边（画布坐标）；整块的外框 */
  K.rowBox = (G, k) => ({ top: G.rows[k].y - G.top * G.s, bot: G.rows[k].y + G.bottom * G.s });
  K.blockBox = (G) => ({ x0: G.x0, x1: G.x0 + G.w, top: G.rows[0].y - G.top * G.s, bot: G.rows[G.rows.length - 1].y + G.bottom * G.s });
  /* 画布上的 y → 最近的一排；画布上的 x（在第 k 排）→ 展平坐标（中间的排夹在自己的范围里，第一排左边 / 最后一排右边不夹） */
  K.ptRow = (G, y) => { let b = 0, bd = Infinity; G.rows.forEach((R, k) => { const d = Math.abs(y - (R.y + ((G.bottom - G.top) * G.s) / 2)); if (d < bd) { bd = d; b = k; } }); return b; };
  K.ptX = (G, x, k) => { const R = G.rows[k], n = G.rows.length; let X = R.off + (x - R.x0) / G.s; if (k > 0) X = Math.max(R.off, X); if (k < n - 1) X = Math.min(R.off + R.lw, X); return X; };
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
  /* 画单元 [a, b)（一排）；坐标是展平坐标，调用方已经平移到这一排的起点 */
  function drawPass(g, l, L, high, E, a, b) {
    const S = E, rubyY = -(S.size * 0.86 + S.rubyGap), fb = K.fontBase(E), fr = K.fontRuby(E);
    for (let i = a; i < b; i++) {
      const u = l.units[i], m = L.units[i];
      if (u.t.trim() !== '') { g.font = fb; paint(g, u.t, m.x + (m.w - m.bw) / 2, 0, high ? S.highFill : S.baseFill, high ? S.highStroke : S.baseStroke, S.strokeW, S.spacing); }
      if (u.r) { g.font = fr; paint(g, u.r, m.x + (m.w - m.rw) / 2, rubyY, high ? S.rubyHighFill : S.rubyFill, high ? S.rubyHighStroke : S.rubyStroke, S.rubyStrokeW, S.spacing * 0.5); }
    }
  }
  /* 一行 = 一排或几排（行内换行）；擦除从一排的末尾接到下一排的开头（展平坐标里连续） */
  function drawLine(g, l, G, t, alpha) {
    const S = K.LS(l), L = G.L; if (!L.total) return;
    const edge = K.progressEdge(l, L, t), pad = S.strokeW + S.glow + S.size * 0.1;
    G.rows.forEach((R) => {
      g.save(); g.globalAlpha = alpha; g.translate(R.x0, R.y); g.scale(G.s, G.s); if (R.off) g.translate(-R.off, 0);
      g.textBaseline = 'alphabetic'; g.textAlign = 'left';
      if (S.glow > 0) { g.shadowColor = S.glowColor; g.shadowBlur = S.glow; }
      drawPass(g, l, L, false, S, R.a, R.b); g.shadowBlur = 0;
      if (edge > R.off) {
        /* 描边 / 发光伸到最后一个字的右边界外面：擦到本排最后一个字时，裁剪边逐渐多走出这一段，擦完时连描边一起盖住（否则右端留一条没擦到的边） */
        let ce = edge, j = R.b - 1; while (j >= R.a && !L.units[j].w) j--;
        if (j >= R.a && edge > L.units[j].x) ce = edge + pad * Math.min(1, (edge - L.units[j].x) / L.units[j].w);
        g.save(); g.beginPath(); g.rect(R.off - 1e5, -1e5, ce - R.off + 1e5, 2e5); g.clip();          // 只裁右边（擦到哪）：这一趟只画本排的字，上下左不用裁，注音 / 发光再大也不会被切掉
        if (S.glow > 0) { g.shadowColor = S.glowColor; g.shadowBlur = S.glow; }
        drawPass(g, l, L, true, S, R.a, R.b); g.restore();
      }
      g.restore();
    });
  }
  /* 预备点：放在第一排前面——dotPos = top 在行首上方，left 在行首左边（和文字同高，最后一个点紧挨着第一个字）；颜色可单独设置（留空 = 跟随歌词填充色） */
  function drawDots(g, l, I, G, t, alpha) {
    const S = K.LS(l), s0 = K.ls(l), dur = I.dotsDur; if (!dur || t >= s0) return;
    const el = t - (s0 - dur), R = (S.size * S.dotSize) / 2, gap = R * 0.8, unit = dur / 3, R0 = G.rows[0];
    const left = S.dotPos === 'left', step = 2 * R + gap;
    const y = left ? R0.y - S.size * 0.36 * G.s : R0.y - G.top * G.s - R * 1.6;
    const xa = left ? R0.x0 - S.strokeW * G.s - R * 1.4 - 2 * step - R : R0.x0 + R;
    g.save(); g.globalAlpha = alpha;
    for (let i = 0; i < 3; i++) {
      const p = (el - i * unit) / unit, m = p <= 0 ? 1 : p >= 1 ? 0 : 1 - p; if (m <= 0) continue;
      const cx = xa + i * step, on = p > 0;
      g.beginPath(); g.arc(cx, y, R * m, 0, Math.PI * 2);
      g.lineWidth = S.strokeW * 0.7 * m * 2; g.strokeStyle = on ? S.highStroke : S.baseStroke; if (g.lineWidth > 0) g.stroke();
      g.fillStyle = on ? S.dotHighFill || S.highFill : S.dotFill || S.baseFill; g.fill();
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
  /* 全局字体 + 各行自己的字体（行属性）都要加载 */
  K.ensureFont = async () => {
    const sample = [...new Set(K.project.lines.map(K.lineText).join('') + 'あ')].join(''), fb = new Set([K.fontBase()]), fr = new Set([K.fontRuby()]);
    K.project.lines.forEach((l) => { if (K.hasOv(l)) { const E = K.LS(l); fb.add(K.fontBase(E)); fr.add(K.fontRuby(E)); } });
    try { await Promise.all([...[...fb].map((f) => document.fonts.load(f, sample)), ...[...fr].map((f) => document.fonts.load(f, 'あいう'))]); } catch (e) {}
    K.fontEpoch++;
  };
  /* 字体随时可能加载完（如画布第一次用到某个网页字体）：让排版缓存和画面失效 */
  if (document.fonts && document.fonts.addEventListener) document.fonts.addEventListener('loadingdone', () => { K.fontEpoch++; });
})();
