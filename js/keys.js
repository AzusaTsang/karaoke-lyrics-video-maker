/* 快捷键表：键盘处理、帮助对话框、底栏提示都由这一张表生成，不会互相脱节。
   k：按键写法（'Ctrl+Shift+S'、'Shift+ArrowLeft'、'['、'?'…；同一条里有多个键时 run 的第二个参数 = 第几个键）
   label：帮助里的说明（翻译 key）；grp：帮助分组；sel：需要先选中一行；typing：焦点在输入框里也生效；hint：底栏提示里的短说明 */
(function () {
  const K = window.K;
  const off = () => K.S().offset, fr = () => 1 / +K.S().fps;
  const pick = (d) => {
    const l = K.sel(), sc = K.screen(), i = l ? sc.ord.indexOf(l) + d : 0, n = sc.ord[Math.max(0, Math.min(sc.ord.length - 1, i))];
    if (n) { K.select(n.id); K.tlReveal(K.ls(n) + off()); }
  };
  const L = () => K.sel();
  K.KEYS = [
    { grp: 'play', k: ['Space'], label: 'k.play', hint: 'h.play', run: () => (K.playing() ? K.pause() : K.play()) },
    { grp: 'play', k: ['Enter'], label: 'k.playLine', hint: 'h.playLine', sel: 1, run: () => K.playLine() },
    { grp: 'play', k: ['L'], label: 'k.loop', hint: 'h.loop', run: () => K.toggleLoop() },
    { grp: 'play', k: ['Home'], label: 'k.home', sel: 1, run: () => K.seek(Math.max(0, K.ls(L()) + off() - 1)) },
    { grp: 'play', k: ['ArrowLeft', 'ArrowRight'], label: 'k.seek1', run: (e, i) => K.seek(K.now() + (i ? 1 : -1)) },
    { grp: 'play', k: ['Shift+ArrowLeft', 'Shift+ArrowRight'], label: 'k.seek5', run: (e, i) => K.seek(K.now() + (i ? 5 : -5)) },
    { grp: 'play', k: [',', '.'], label: 'k.frame', run: (e, i) => K.seek(K.now() + (i ? 1 : -1) * fr()) },
    { grp: 'play', k: ['Shift+,', 'Shift+.'], label: 'k.speed', hint: 'h.speed', hk: '< >', run: (e, i) => K.stepSpeed(i ? 1 : -1) },
    { grp: 'line', k: ['ArrowUp', 'ArrowDown'], label: 'k.pick', hint: 'h.pick', run: (e, i) => pick(i ? 1 : -1) },
    { grp: 'time', k: ['T'], label: 'k.tap', hint: 'h.tap', sel: 1, run: () => { K.ui.tapArmed = true; K.invalidate(); K.ops.tap(K.r3(K.now() - off())); } },
    { grp: 'time', k: ['[', ']'], label: 'k.nudge', hint: 'h.nudge', sel: 1, run: (e, i) => K.ops.shift(L(), i ? 0.02 : -0.02) },
    { grp: 'time', k: ['Shift+[', 'Shift+]'], label: 'k.nudge5', sel: 1, run: (e, i) => K.ops.shift(L(), i ? 0.1 : -0.1) },
    { grp: 'line', k: ['P'], label: 'k.para', hint: 'h.para', sel: 1, run: () => { const l = L(); K.ops.set(l, 'newPara', K.screen().info.get(l.id).para ? (l.newPara === true ? null : false) : true); } },
    { grp: 'line', k: ['D'], label: 'k.dots', hint: 'h.dots', sel: 1, run: () => { const l = L(); K.ops.set(l, 'dots', l.dots == null ? true : l.dots ? false : null); } },
    { grp: 'line', k: ['H'], label: 'k.dup', hint: 'h.dup', sel: 1, run: () => K.ops.dup(L()) },
    { grp: 'line', k: ['S'], label: 'k.split', sel: 1, run: () => K.ops.split(L(), K.now() - off()) },
    { grp: 'line', k: ['M'], label: 'k.merge', sel: 1, run: () => K.ops.merge(L()) },
    { grp: 'line', k: ['1', '2', '3', '4'], label: 'k.row', hint: 'h.row', sel: 1, run: (e, i) => K.ops.set(L(), 'row', i) },
    { grp: 'line', k: ['0'], label: 'k.rowAuto', sel: 1, run: () => K.ops.set(L(), 'row', null) },
    { grp: 'line', k: ['Delete'], label: 'k.del', sel: 1, run: () => K.ops.del(L()) },
    /* 移动选中行在画面上的位置（行属性的位置偏移，画布像素） */
    { grp: 'line', k: ['Ctrl+ArrowLeft', 'Ctrl+ArrowRight', 'Ctrl+ArrowUp', 'Ctrl+ArrowDown'], label: 'k.nudgePos', sel: 1, run: (e, i) => K.ops.nudgePos(L(), [-4, 4, 0, 0][i], [0, 0, -4, 4][i]) },
    { grp: 'line', k: ['Ctrl+Shift+ArrowLeft', 'Ctrl+Shift+ArrowRight', 'Ctrl+Shift+ArrowUp', 'Ctrl+Shift+ArrowDown'], label: 'k.nudgePos5', sel: 1, run: (e, i) => K.ops.nudgePos(L(), [-20, 20, 0, 0][i], [0, 0, -20, 20][i]) },
    { grp: 'view', k: ['F'], label: 'k.fitSel', sel: 1, run: () => K.tlFitSel() },
    { grp: 'view', k: ['Shift+F'], label: 'k.fitAll', run: () => K.tlFit() },
    { grp: 'view', k: ['=', '-'], label: 'k.zoom', run: (e, i) => K.tlZoom(i ? 1 / 1.4 : 1.4) },
    { grp: 'view', k: ['?', 'F1'], label: 'k.help', hint: 'h.help', typing: 1, run: () => K.showHelp() },
    { grp: 'view', k: ['Escape'], label: 'k.esc', run: () => { document.body.classList.remove('rec'); document.getElementById('menu').hidden = true; if (K.tipHide) K.tipHide(); } },
    { grp: 'file', k: ['Ctrl+Z'], label: 'k.undo', run: () => K.undo() },
    { grp: 'file', k: ['Ctrl+Shift+Z', 'Ctrl+Y'], label: 'k.redo', run: () => K.redo() },
    { grp: 'file', k: ['Ctrl+S'], label: 'k.save', typing: 1, run: () => K.save() },
    { grp: 'file', k: ['Ctrl+Shift+S'], label: 'k.saveAs', typing: 1, run: () => K.saveAs() },
    { grp: 'file', k: ['Ctrl+O'], label: 'k.open', typing: 1, run: () => K.openDialog() },
  ];
  K.KEY_GROUPS = ['play', 'time', 'line', 'view', 'file'];

  /* ---------- 匹配 ----------
     标点按字符匹配（换挡后的字符也算，如 Shift+[ 在多数布局下是 “{”），所以 JIS / US 布局都能用；
     '?' '=' 本身常常要按 Shift 才打得出，匹配时不看 Shift。字母在非拉丁布局下退回按物理键位（e.code）匹配 */
  const SHIFTED = { '[': '{', ']': '}', ',': '<', '.': '>', '=': '+', '-': '_' };
  const ANY_SHIFT = new Set(['?', '=']);
  const parse = (spec) => { const p = spec.split('+'), tok = p.pop() || '+'; return { ctrl: p.includes('Ctrl'), shift: p.includes('Shift'), tok }; };
  const tokHit = (tok, e) => {
    if (tok === 'Space') return e.code === 'Space' || e.key === ' ';
    if (tok.length > 1) return e.key === tok;
    if (/^[A-Z]$/.test(tok)) return e.key.toLowerCase() === tok.toLowerCase() || (!/^[a-z]$/i.test(e.key) && e.code === 'Key' + tok);
    return e.key === tok || e.key === SHIFTED[tok];
  };
  const PARSED = K.KEYS.map((b) => b.k.map(parse));
  K.matchKey = (e) => {
    if (e.altKey) return null;
    const ctrl = !!(e.ctrlKey || e.metaKey);
    for (let n = 0; n < K.KEYS.length; n++) for (let i = 0; i < PARSED[n].length; i++) {
      const s = PARSED[n][i];
      if (s.ctrl === ctrl && (ANY_SHIFT.has(s.tok) || s.shift === !!e.shiftKey) && tokHit(s.tok, e)) return { b: K.KEYS[n], i };
    }
    return null;
  };

  /* ---------- 显示 ---------- */
  const NAMES = { ArrowLeft: '←', ArrowRight: '→', ArrowUp: '↑', ArrowDown: '↓', Escape: 'Esc' };
  const keyName = (spec) => spec.split('+').map((p) => (p === 'Space' ? K.t('key.space') : p === 'Delete' ? K.t('key.delete') : NAMES[p] || p)).join('+');
  /* 一条的按键显示成 kbd 列表；1 2 3 4 这样连续的数字合并成 “1–4” */
  K.keyHtml = (b) => {
    if (b.k.length > 2 && b.k.every((x, i) => /^\d$/.test(x) && (!i || +x === +b.k[i - 1] + 1))) return `<kbd>${b.k[0]}</kbd>–<kbd>${b.k[b.k.length - 1]}</kbd>`;
    return b.k.map((x) => `<kbd>${K.esc(keyName(x))}</kbd>`).join(' ');
  };
  K.keyHint = () => K.KEYS.filter((b) => b.hint).sort((a, b) => (b.label === 'k.help') - (a.label === 'k.help')).map((b) => {
    const ks = b.hk || (b.k.length > 2 ? b.k[0] + '-' + b.k[b.k.length - 1] : b.k.map(keyName).join(b.k.every((x) => /^Arrow/.test(x)) ? '' : b.k.every((x) => x.length === 1) ? ' ' : '/'));
    return ks + ' ' + K.t(b.hint);
  }).join(' · ');

  /* ---------- 处理 ---------- */
  K.CTRL_SEL = 'button, summary, a[href], [role="button"], input[type="checkbox"]';
  K.keyHandler = (e) => {
    if (e.defaultPrevented || e.isComposing || e.keyCode === 229) return;
    if (K.modalOpen && K.modalOpen()) return;                  // 对话框自己处理 Esc / Enter / Tab
    const a = document.activeElement, tag = a && a.tagName;
    const typing = a && (tag === 'TEXTAREA' || tag === 'SELECT' || a.isContentEditable || (tag === 'INPUT' && !['range', 'checkbox', 'color', 'button'].includes(a.type)));
    const m = K.matchKey(e);
    /* 正在输入：只有 Ctrl 组合键 / 功能键（F1…）当快捷键；能打出字的键（如 ?）留给输入框 */
    if (typing) { if (m && m.b.typing && (e.ctrlKey || e.metaKey || e.key.length > 1)) { e.preventDefault(); m.b.run(e, m.i); } else if (e.key === 'Escape') a.blur(); return; }
    if (!m) return;
    /* 聚焦的滑块 / 分隔条自己用方向键等；聚焦的按钮自己用空格 / 回车 */
    if (a && (a.type === 'range' || a.getAttribute('role') === 'separator') && /^(Arrow|Home|End|Page)/.test(e.key)) return;
    if ((e.code === 'Space' || e.key === 'Enter') && e.target.closest && e.target.closest(K.CTRL_SEL)) return;
    if (m.b.sel && !K.sel()) return;
    e.preventDefault(); m.b.run(e, m.i);
  };
})();
