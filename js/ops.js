/* 对歌词行的编辑操作（每个操作结束都会 commit，可撤销） */
(function () {
  const K = window.K, ops = (K.ops = {});
  const shiftLine = (l, d) => {
    l.units.forEach((u) => { u.s += d; if (u.m) u.m = u.m.map((v) => v + d); });
    l.end += d; if (l.showAt != null) l.showAt += d; if (l.hideAt != null) l.hideAt += d;
    K.fixLine(l);
  };
  ops.shiftRaw = shiftLine;
  ops.shift = (l, d) => { shiftLine(l, d); K.commit('shift'); };
  ops.even = (l) => { K.evenSplit(l); K.commit('even'); };
  ops.add = (t) => {
    const l = K.newLine({ units: K.parseText(K.t('newLyric')), end: t + 2 });
    l.units.forEach((u) => (u.s = t)); K.evenSplit(l, t, t + 2);
    K.project.lines.push(l); K.commit('add'); K.select(l.id); return l;
  };
  ops.del = (l) => {
    const sc = K.screen(), i = sc.ord.indexOf(l), nx = sc.ord[i + 1] || sc.ord[i - 1];
    K.project.lines = K.project.lines.filter((x) => x !== l);
    K.commit('del'); K.select(nx ? nx.id : null);
  };
  /* 复制为和声行：同样的文字和时间，放到一个当前没被占用的行位 */
  ops.dup = (l) => {
    const sc = K.screen(), I = sc.info.get(l.id), used = new Set();
    sc.ord.forEach((x) => { const J = sc.info.get(x.id); if (J.show < I.hide && J.hide > I.show) used.add(J.row); });
    let row = 0; while (used.has(row)) row++;
    const n = K.newLine({ units: JSON.parse(JSON.stringify(l.units)), end: l.end, row, newPara: false });
    K.project.lines.push(n); K.commit('dup'); K.select(n.id); return n;
  };
  /* 在时间 t 处把一行拆成两行 */
  /* 拆分处的空白字直接丢掉：新行不以空白开头，前一行也不以空白结尾；其余时间原样保留（本来就单调） */
  ops.split = (l, t) => {
    const blank = (u) => !u.t.trim();
    const g = K.groups(l).find((q) => (!q.w || q.f) && l.units[q.i].s >= t), k = g ? g.i : -1;       // 只在词与词之间拆（不拆开一个词）
    if (k <= 0) return null;
    let a = k, b = k;
    while (a > 0 && blank(l.units[a - 1])) a--;
    while (b < l.units.length && blank(l.units[b])) b++;
    if (a === 0 || b === l.units.length) return null;          // 一侧只剩空白，不拆
    const n = K.newLine({ units: l.units.slice(b), end: l.end, row: null });
    l.units = l.units.slice(0, a);
    l.end = Math.min(l.end, Math.max(t, l.units[l.units.length - 1].s + 0.05));
    K.fixLine(l); K.fixLine(n);
    K.project.lines.push(n); K.commit('split'); return n;
  };
  ops.merge = (l) => {
    const sc = K.screen(), nx = sc.ord[sc.ord.indexOf(l) + 1]; if (!nx) return;
    const a = l.units[l.units.length - 1], b = nx.units[0];
    if (a && b && /[A-Za-zÀ-ɏЀ-ӿ]$/.test(a.t) && /^[A-Za-zÀ-ɏЀ-ӿ]/.test(b.t)) l.units.push({ t: ' ', r: null, s: Math.min(l.end, b.s) });
    l.units = l.units.concat(nx.units); l.end = Math.max(l.end, nx.end); l.hideAt = null;
    K.project.lines = K.project.lines.filter((x) => x !== nx);
    K.fixLine(l); K.commit('merge');
  };
  const SET_WHY = { newPara: 'para', dots: 'dots', row: 'row', align: 'align', showAt: 'showHide', hideAt: 'showHide' };
  ops.set = (l, k, v) => { l[k] = v; K.commit(SET_WHY[k] || 'settings'); };
  /* 手动音节：在字母 i 处分开（v = 1）/ 和前一个音节合并（v = 0）。和自动结果相同时不留覆盖 */
  ops.syl = (l, i, v) => {
    const u = l.units[i]; if (!u) return;
    delete u.k; const auto = K.groups(l).some((g) => g.w && g.i === i);
    if (auto !== !!v) u.k = v;
    K.fixLine(l); K.commit('syl');
  };
  ops.sylReset = (l) => { if (!l.units.some((u) => u.k != null)) return; l.units.forEach((u) => delete u.k); K.commit('syl'); };
  /* 音节内字母均分：一行 / 全部歌词，都是一步撤销 */
  const evenSyl = (lines) => {
    const n = lines.filter((l) => K.evenSyllables(l)).length;
    if (n) { K.commit('evenSyl'); K.toast(K.t('msg.evenSyl', { n }), 'ok'); } else K.toast(K.t('msg.evenSylNone'));
    return n;
  };
  ops.evenSyl = (l) => evenSyl([l]);
  ops.evenSylAll = () => evenSyl(K.project.lines);
  /* 打点：播放时每按一次，把选中行的下一个字（字母按音节，带注音的字按拍）的开始时间设为当前时间 */
  ops.tap = (t) => {
    const l = K.sel(); if (!l) return;
    const B = K.bounds(l); let i = K.ui.tapIdx;
    if (i >= B.length) {                   // 最后再按一次 = 这一行结束，跳到下一行
      K.setEnd(l, Math.max(t, K.minEnd(l))); K.commit('tap');
      const sc = K.screen(), nx = sc.ord[sc.ord.indexOf(l) + 1];
      if (nx) K.select(nx.id); else K.ui.tapIdx = B.length;
      return;
    }
    K.setBoundary(l, B[i].i, B[i].j, t); i++;
    while (i < B.length && !/[^\s\p{P}]/u.test(l.units[B[i].i].t)) i++;      // 空格、标点自动带过
    K.ui.tapIdx = i; K.commit('tap');
  };
})();
