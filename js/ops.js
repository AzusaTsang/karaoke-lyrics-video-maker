/* 对歌词行的编辑操作（每个操作结束都会 commit，可撤销） */
(function () {
  const K = window.K, ops = (K.ops = {});
  const shiftLine = (l, d) => {
    l.units.forEach((u) => { u.s += d; if (u.e != null) u.e += d; });
    l.end += d; if (l.showAt != null) l.showAt += d; if (l.hideAt != null) l.hideAt += d;
    K.fixLine(l);
  };
  ops.shiftRaw = shiftLine;
  ops.shift = (l, d) => { shiftLine(l, d); K.commit(); };
  ops.even = (l) => { K.evenSplit(l); K.commit(); };
  ops.add = (t) => {
    const l = K.newLine({ units: K.parseText('新歌词'), end: t + 2 });
    l.units.forEach((u) => (u.s = t)); K.evenSplit(l, t, t + 2);
    K.project.lines.push(l); K.commit(); K.select(l.id); return l;
  };
  ops.del = (l) => {
    const sc = K.screen(), i = sc.ord.indexOf(l), nx = sc.ord[i + 1] || sc.ord[i - 1];
    K.project.lines = K.project.lines.filter((x) => x !== l);
    K.commit(); K.select(nx ? nx.id : null);
  };
  /* 复制为和声行：同样的文字和时间，放到一个当前没被占用的行位 */
  ops.dup = (l) => {
    const sc = K.screen(), I = sc.info.get(l.id), used = new Set();
    sc.ord.forEach((x) => { const J = sc.info.get(x.id); if (J.show < I.hide && J.hide > I.show) used.add(J.row); });
    let row = 0; while (used.has(row)) row++;
    const n = K.newLine({ units: JSON.parse(JSON.stringify(l.units)), end: l.end, row, newPara: false });
    K.project.lines.push(n); K.commit(); K.select(n.id); return n;
  };
  /* 在时间 t 处把一行拆成两行 */
  ops.split = (l, t) => {
    const k = l.units.findIndex((u) => u.s >= t);
    if (k <= 0) return null;
    const n = K.newLine({ units: l.units.splice(k), end: l.end, row: null });
    while (n.units.length > 1 && !n.units[0].t.trim()) { const sp = n.units.shift(); n.units[0].s = Math.min(n.units[0].s, Math.max(sp.s, n.units[0].s)); }
    l.end = Math.min(l.end, Math.max(t, l.units[l.units.length - 1].s + 0.05));
    K.fixLine(l); K.fixLine(n);
    K.project.lines.push(n); K.commit(); return n;
  };
  ops.merge = (l) => {
    const sc = K.screen(), nx = sc.ord[sc.ord.indexOf(l) + 1]; if (!nx) return;
    const a = l.units[l.units.length - 1], b = nx.units[0];
    if (a && b && /[A-Za-zÀ-ɏЀ-ӿ]$/.test(a.t) && /^[A-Za-zÀ-ɏЀ-ӿ]/.test(b.t)) l.units.push({ t: ' ', r: null, s: Math.min(l.end, b.s) });
    l.units = l.units.concat(nx.units); l.end = Math.max(l.end, nx.end); l.hideAt = null;
    K.project.lines = K.project.lines.filter((x) => x !== nx);
    K.fixLine(l); K.commit();
  };
  ops.set = (l, k, v) => { l[k] = v; K.commit(); };
  /* 打点：播放时每按一次，把选中行的下一个字的开始时间设为当前时间 */
  ops.tap = (t) => {
    const l = K.sel(); if (!l) return;
    let i = K.ui.tapIdx;
    if (i >= l.units.length) {            // 最后再按一次 = 这一行结束，跳到下一行
      l.end = Math.max(t, l.units[l.units.length - 1].s + 0.05); K.commit();
      const sc = K.screen(), nx = sc.ord[sc.ord.indexOf(l) + 1];
      if (nx) K.select(nx.id); else K.ui.tapIdx = l.units.length;
      return;
    }
    l.units[i].s = t; delete l.units[i].e;
    for (let k = 0; k < i; k++) { if (l.units[k].s > t) l.units[k].s = t; if (l.units[k].e > t) delete l.units[k].e; }
    for (let k = i + 1; k < l.units.length; k++) if (l.units[k].s < t) l.units[k].s = t;
    i++;
    while (i < l.units.length && !/[^\s\p{P}]/u.test(l.units[i].t)) { l.units[i].s = Math.max(l.units[i].s, t); i++; }   // 空格、标点自动带过
    if (l.end < t + 0.05) l.end = t + 0.05;
    K.fixLine(l); K.ui.tapIdx = i; K.commit();
  };
})();
