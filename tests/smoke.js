/* 冒烟测试：在真实页面里模拟拖动 / 快捷键 / 切换语言等操作，逐条断言。
   结果写进 <pre id="result">：第一行是 PASS/FAIL 汇总，第二行起是 JSON 详情（失败项、异常、原始观测值） */
window.addEventListener('load', async () => {
  const out = {}, fails = [], K = window.K;
  /* 无头 Chrome 的虚拟时间里几乎不出动画帧：由测试自己驱动 K.tick（与 requestAnimationFrame 循环做的事完全相同） */
  const frames = async (k) => { for (let i = 0; i < k; i++) { await new Promise((r) => setTimeout(r, 16)); K.tick(performance.now()); } };
  const wait = async (ms) => { await new Promise((r) => setTimeout(r, ms)); await frames(2); };
  /* Worker / 视频编码器在别的线程里干活，不归无头 Chrome 的虚拟时间管：虚拟时钟会抢跑，等它们时要用忙等把真实时间耗掉。
     untilReal = 等条件成立；real(promise) = 等一个要靠别的线程才能完成的 Promise */
  const spin = () => { let x = 0; for (let i = 0; i < 3e6; i++) x += i; return x; };
  const untilReal = async (cond, tries) => { for (let i = 0; i < (tries || 4000) && !cond(); i++) { spin(); await new Promise((r) => setTimeout(r, 1)); } return cond(); };
  const real = async (p) => { let d = 0, v; p.then((x) => { v = x; d = 1; }, (x) => { v = x; d = 2; }); await untilReal(() => d); if (d !== 1) throw v || new Error('timeout'); return v; };
  const until = async (cond, tries) => { for (let i = 0; i < (tries || 60) && !cond(); i++) await wait(50); return cond(); };
  let n = 0;
  const ok = (name, cond, detail) => { n++; if (!cond) fails.push(detail === undefined ? name : name + ' :: ' + JSON.stringify(detail)); };
  const near = (a, b, eps) => typeof a === 'number' && typeof b === 'number' && Math.abs(a - b) <= (eps || 1e-6);
  const ev = (el, type, x, y, o) => el.dispatchEvent(new PointerEvent(type, Object.assign({ clientX: x, clientY: y, bubbles: true, pointerId: 1, button: 0 }, o || {})));
  const key = (el, k, code) => el.dispatchEvent(new KeyboardEvent('keydown', { key: k, code: code || k, bubbles: true, cancelable: true }));
  const HAN = /[㐀-鿿]/;
  try {
    /* ---- 0. 第一次打开：示例在背后、欢迎页在上面；关掉后第二次打开不再出现 ---- */
    { await frames(2);
      const wd = document.querySelector('dialog.welcome');
      out.first = { open: !!(wd && wd.open), src: K.doc.src, dirty: K.dirty, lines: K.project.lines.length, visible: K.visible(K.now() - K.S().offset, 1920, 1080).length };
      ok('welcomeOnFirstRun', out.first.open && K.modalOpen(), out.first);
      ok('sampleBehindWelcome', out.first.src === 'sample' && !out.first.dirty && out.first.lines > 10 && out.first.visible > 0, out.first);
      ok('homeTitleIsAppName', document.title === ((K.I18N[K.lang] || {})['app.titleHome'] || K.t('app.name')) && !document.title.includes(K.project.title), document.title);
      const acts = [...document.querySelectorAll('#welcomeActions [data-act]')].map((b) => b.dataset.act);
      ok('welcomeActions', ['sample', 'import', 'open', 'empty'].every((a) => acts.includes(a)) && acts.length === K.welcomeActions.filter((a) => a.where.includes('welcome')).length, acts);
      ok('welcomeFocusInside', wd && wd.contains(document.activeElement));
      key(document.body, ' ', 'Space'); await frames(1); ok('noShortcutsUnderModal', !K.playing());
      wd.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })); await frames(1);
      ok('welcomeEscCloses', !document.querySelector('dialog.welcome') && !K.modalOpen() && K.pref('welcomed') === true);
      // 第二次打开（同一浏览器，有 welcomed 标记、无自动保存）：用 iframe 真正再启动一次
      const boot = async () => { const f = document.createElement('iframe'); f.style.cssText = 'position:fixed;left:-3000px;width:1200px;height:800px'; f.src = 'index.html?noyt';
        const ld = new Promise((r) => (f.onload = r)); document.body.appendChild(f); await ld; await wait(50);
        let r = null; try { const w = f.contentWindow; r = { welcome: !!w.document.querySelector('dialog.welcome'), boot: !!(w.K && w.K.project) }; } catch (e) { r = { err: String(e) }; }
        f.remove(); return r; };
      out.second = await boot();
      ok('noWelcomeOnSecondRun', out.second && out.second.boot && out.second.welcome === false, out.second);
      localStorage.removeItem('karaoke-studio:prefs'); out.again = await boot();
      ok('welcomeAgainAfterClear', out.again && out.again.welcome === true, out.again);
      delete K.prefs.welcomed; ok('firstRunLogic', K.firstRun(false) === true && K.firstRun(true) === false); K.prefs.welcomed = true; }

    localStorage.clear(); K.setLang('zh-CN');
    K.setProject(K.normalizeProject(K.SAMPLES[0].project)); await K.ensureFont(); await wait(200);
    const S = K.S(), cv = document.getElementById('cv'), tlc = document.getElementById('tlc');
    let sc = K.screen(); const l = sc.ord[2], l4 = sc.ord[3], l5 = sc.ord[4];

    // ---- 分段让位：手动分段后，新段第一行不早于上一行消失才出现 ----
    K.ops.set(l5, 'newPara', true); sc = K.screen();
    out.para = { prevHide: +sc.info.get(l4.id).hide.toFixed(3), l5show: +sc.info.get(l5.id).show.toFixed(3), l5start: K.ls(l5) };
    ok('paraShowAfterPrevHide', sc.info.get(l5.id).show >= sc.info.get(l4.id).hide - 1e-6, out.para);
    K.undo();
    // 两行不重叠时：新段第一行要等上一行唱完（end）才出现
    { sc = K.screen(); const i = sc.ord.findIndex((x, k) => k > 0 && K.ls(x) - sc.ord[k - 1].end > 1 && K.ls(x) - sc.ord[k - 1].end < S.paraGap && !sc.info.get(x.id).para);
      ok('foundNonOverlapPair', i > 0, i);
      if (i > 0) { const a = sc.ord[i - 1], b = sc.ord[i]; K.ops.set(b, 'newPara', true); const s2 = K.screen();
        out.para2 = { prevEnd: a.end, show: +s2.info.get(b.id).show.toFixed(3) };
        ok('paraAfterPrevEnd', s2.info.get(b.id).show >= a.end - 1e-6 && s2.info.get(b.id).para, out.para2); K.undo(); } }

    // ---- A. 舞台：拖擦除光标校时 ----
    const T0 = 28.0; K.select(l.id); K.seek(T0); await wait(100);
    const toClient = (cx, cy) => { const r = cv.getBoundingClientRect(); return [r.left + cx * r.width / cv.width, r.top + cy * r.height / cv.height]; };
    const I = K.screen().info.get(l.id), G = K.geo(l, I, cv.width, cv.height);
    const ex = G.x0 + K.progressEdge(l, G.L, T0) * G.s, k = 6;      // 目标：第 7 个单元的起点
    const before = l.units[k].s;
    let [x, y] = toClient(ex, G.y - S.size * 0.4); ev(cv, 'pointerdown', x, y);
    let [x2] = toClient(G.x0 + G.L.units[k].x * G.s + 1, 0); ev(cv, 'pointermove', x2, y); ev(cv, 'pointerup', x2, y);
    out.retime = { unit: K.line(l.id).units[k].t, before, after: K.line(l.id).units[k].s, expect: T0 };
    ok('retime', near(out.retime.after, T0) && before !== T0, out.retime);
    ok('retimeMonotone', K.line(l.id).units.every((u, i, a) => !i || u.s >= a[i - 1].s));
    K.undo(); ok('retimeUndo', K.line(l.id).units[k].s === before);
    // 按假名（拍）拖：第 1 个字 王道{おうどう} 的第 3 拍
    { const c = K.line(l.id), u0 = c.units[0], n0 = K.nMora(u0); K.seek(27.95); await wait(50);
      const I3 = K.screen().info.get(c.id), G3 = K.geo(c, I3, cv.width, cv.height), e3 = G3.x0 + K.progressEdge(c, G3.L, 27.95) * G3.s;
      const [ax, ay] = toClient(e3, G3.y - S.size * 0.4), [ax2] = toClient(G3.x0 + (G3.L.units[0].x + G3.L.units[0].w * 2 / n0) * G3.s, 0);
      ev(cv, 'pointerdown', ax, ay); ev(cv, 'pointermove', ax2, ay); ev(cv, 'pointerup', ax2, ay);
      const r0 = K.line(l.id).units[0]; out.mora = { ruby: r0.r, n: n0, m: r0.m, s: r0.s };
      ok('moraRetime', n0 === 4 && r0.m && near(r0.m[1], 27.95), out.mora);
      const L0 = K.line(l.id), Gm = K.geo(L0, I3, cv.width, cv.height); out.moraEdgeFrac = +(K.progressEdge(L0, Gm.L, 27.95) / Gm.L.units[0].w).toFixed(3);
      ok('moraEdgeFrac', near(out.moraEdgeFrac, 0.5, 0.002), out.moraEdgeFrac);
      K.undo(); K.seek(T0); await wait(50); }
    // 长音：最后一个字应一直擦到行结束，中途是部分进度
    { const c = K.line(l.id), li = c.units.length - 1, u = c.units[li], Lc = K.layout(c), mid = (u.s + c.end) / 2;
      out.longNote = { hasE: c.units.some((q) => q.e != null), end: c.end, lastStart: u.s, fracAtMid: +((K.progressEdge(c, Lc, mid) - Lc.units[li].x) / Lc.units[li].w).toFixed(2) };
      ok('longNote', !out.longNote.hasE && near(out.longNote.fracAtMid, 0.5, 0.02), out.longNote); }

    // ---- B. 浏览模式 ----
    K.ui.tool = 'scrub'; const L2 = K.line(l.id); K.seek(T0); await wait(50);
    { const I2 = K.screen().info.get(L2.id), G2 = K.geo(L2, I2, cv.width, cv.height), e2 = G2.x0 + K.progressEdge(L2, G2.L, K.now()) * G2.s;
      const [bx, by] = toClient(e2, G2.y - K.S().size * 0.4), [bx2] = toClient(G2.x0 + G2.L.units[k].x * G2.s + 1, 0);
      ev(cv, 'pointerdown', bx, by); ev(cv, 'pointermove', bx2, by); ev(cv, 'pointerup', bx2, by); }
    out.scrub = { now: +K.now().toFixed(3), expect: L2.units[k].s }; K.ui.tool = 'retime';
    ok('scrub', near(out.scrub.now, out.scrub.expect, 0.01), out.scrub);

    // ---- C. 时间线 ----
    K.tl.pps = 80; K.tl.scroll = 24; await wait(100);
    const r = tlc.getBoundingClientRect(), TX = (t) => r.left + K.tl.gut + (t - K.tl.scroll) * 80, top0 = 22, TRK = 46;
    let cur = K.line(l.id), Ic = K.screen().info.get(cur.id), yb = r.top + top0 + Ic.row * TRK + 12, s0 = K.ls(cur);
    ev(tlc, 'pointerdown', TX(s0 + 0.5), yb); ev(tlc, 'pointermove', TX(s0 + 0.5) + 80, yb); ev(tlc, 'pointerup', TX(s0 + 0.5) + 80, yb);
    out.move = +(K.ls(K.line(l.id)) - s0).toFixed(3); ok('tlMove', near(out.move, 1, 1e-3), out.move); K.undo();
    ev(tlc, 'pointerdown', TX(s0 + 0.5), yb); ev(tlc, 'pointermove', TX(s0 + 0.5) + 3, yb + 2 * TRK); ev(tlc, 'pointerup', TX(s0 + 0.5) + 3, yb + 2 * TRK);
    out.rowDrag = K.line(l.id).row; ok('tlRowDrag', out.rowDrag === 2, out.rowDrag); K.undo();
    cur = K.line(l.id); const u3 = cur.units[3].s, yt = r.top + top0 + Ic.row * TRK + 36;
    ev(tlc, 'pointerdown', TX(u3), yt); ev(tlc, 'pointermove', TX(u3) + 4, yt); ev(tlc, 'pointerup', TX(u3) + 4, yt);
    out.tick = +(K.line(l.id).units[3].s - u3).toFixed(3); ok('tlTick', near(out.tick, 0.05, 1e-3), out.tick); K.undo();
    Ic = K.screen().info.get(l.id); const xs = TX(Ic.show);
    ev(tlc, 'pointerdown', xs + 1, yb); ev(tlc, 'pointermove', xs + 41, yb); ev(tlc, 'pointerup', xs + 41, yb);
    out.showDrag = { auto: +Ic.show.toFixed(2), now: K.line(l.id).showAt };
    ok('tlShowDrag', typeof out.showDrag.now === 'number' && near(out.showDrag.now - Ic.show, 0.5, 0.02), out.showDrag);
    tlc.dispatchEvent(new MouseEvent('dblclick', { clientX: TX(K.line(l.id).showAt) + 1, clientY: yb, bubbles: true }));
    ok('tlShowReset', K.line(l.id).showAt === null, K.line(l.id).showAt);
    // 打点
    K.select(l.id); K.ui.tapIdx = 0; K.ops.tap(27.5); K.ops.tap(27.9);
    { const c = K.line(l.id), B = K.bounds(c); out.tap = [c.units[0].s, K.boundTime(c, B[1]), K.ui.tapIdx];
      ok('tap', out.tap[0] === 27.5 && near(out.tap[1], 27.9) && out.tap[2] === 2, out.tap); }
    // 导出路径：透明帧
    const c = document.createElement('canvas'); c.width = S.W; c.height = S.H; const g = c.getContext('2d');
    ok('renderBlank', K.render(g, 5, { bg: 'none' }) === false);
    ok('renderDrew', K.render(g, 28.5, { bg: 'none' }) === true);
    ok('cornerAlpha0', g.getImageData(0, 0, 1, 1).data[3] === 0);
    // 保存 / 读回
    { const p2 = K.normalizeProject(JSON.parse(JSON.stringify(K.project)));
      ok('roundtripLines', JSON.stringify(p2.lines) === JSON.stringify(K.project.lines));
      ok('roundtripSettings', JSON.stringify(p2.settings) === JSON.stringify(K.project.settings)); }
    { K.showTab('style'); await wait(100); const fp = document.getElementById('fontPick'); out.fontOpts = fp.options.length; fp.value = 'Meiryo'; fp.dispatchEvent(new Event('change', { bubbles: true }));
      out.fontSet = K.S().font; ok('fontPick', out.fontOpts >= 20 && /^'Meiryo', /.test(out.fontSet), { n: out.fontOpts, f: out.fontSet }); K.undo(); }
    // 拆分：新行不以空白开头，时间单调
    { const p = K.normalizeProject({ lines: [{ units: [['a', null, 1, 1.2], [' ', null, 1.2, 1.3], ['b', null, 1.3, 1.5], [' ', null, 1.5, 1.6], ['c', null, 1.6, 1.8]] }] });
      K.setProject(p); const L = K.project.lines[0], nl = K.ops.split(L, 1.25);
      const all = K.project.lines.map((x) => K.lineText(x));
      out.split = all;
      ok('splitNoLeadingSpace', nl && all.length === 2 && all[0] === 'a' && all[1] === 'b c', all);
      ok('splitMonotone', K.project.lines.every((x) => x.units.every((u, i, a) => !i || u.s >= a[i - 1].s) && x.end >= x.units[x.units.length - 1].s));
      ok('splitOnlySpaceRefused', K.ops.split(K.project.lines[0], 1.21) === null); }
    K.setProject(K.normalizeProject(K.SAMPLES[1].project)); out.fr = K.screen().ord.length; ok('frSample', out.fr > 10, out.fr);

    // ---- D. 工程文件不可信：恶意字段不能注入 DOM，设置被清洗 ----
    { const X = '"><img src=x onerror="window.__pwn=1">';
      const evil = { title: X, mediaName: X, duration: 'NaN', settings: { baseFill: X, highFill: '#ABCDEF', size: X, strokeW: 1e9, W: 1e9, H: -5, layout: X, weight: X, rows: 99, fps: X, dots: 'false', useVideoBg: 'true', font: X, bgMode: 'color', evil: X },
        lines: [{ id: X, start: 1, end: 3, row: X, align: X, newPara: X, showAt: X, units: [{ t: '<img src=x onerror="window.__pwn=1">', r: X, s: 'abc' }, { t: 'y', s: 2, m: [X] }] },
          { id: 'L_ok-1', end: 5, units: [{ t: 'z', s: 4 }] }, { id: 'L_ok-1', end: 6, units: [{ t: 'w', s: 5 }] }, null, 42] };
      const p = K.normalizeProject(JSON.parse(JSON.stringify(evil).replace('"evil":', '"__proto__":{"size":1,"polluted":1},"evil":'))), s = p.settings, D = K.DEF;
      out.evilSettings = s;
      ok('sanColor', s.baseFill === D.baseFill && s.highFill === '#abcdef', [s.baseFill, s.highFill]);
      ok('sanNumbers', s.size === D.size && s.strokeW === K.RANGE.strokeW[1] && s.W === K.RANGE.W[1] && s.H === K.RANGE.H[0], [s.size, s.strokeW, s.W, s.H]);
      ok('sanEnums', s.layout === D.layout && s.weight === D.weight && s.rows === D.rows && s.fps === D.fps && s.bgMode === 'color', [s.layout, s.weight, s.rows, s.fps]);
      ok('sanBools', s.dots === false && s.useVideoBg === true, [s.dots, s.useVideoBg]);
      ok('sanFont', typeof s.font === 'string' && !/[<>]/.test(s.font), s.font);
      ok('sanUnknownDropped', !('evil' in s) && !('polluted' in s) && Object.keys(s).length === Object.keys(D).length, Object.keys(s));
      ok('sanIds', p.lines.every((x) => /^[A-Za-z0-9_-]{1,40}$/.test(x.id)) && new Set(p.lines.map((x) => x.id)).size === p.lines.length, p.lines.map((x) => x.id));
      ok('sanLineFields', p.lines.every((x) => (x.row === null || Number.isInteger(x.row)) && (x.align === null || ['left', 'center', 'right'].includes(x.align)) && (x.showAt === null || isFinite(x.showAt)) && [null, true, false].includes(x.newPara)), p.lines[0]);
      ok('sanUnits', p.lines.every((x) => x.units.every((u) => typeof u.t === 'string' && isFinite(u.s) && (u.r === null || typeof u.r === 'string') && (!u.m || u.m.every(isFinite)))), p.lines[0].units);
      ok('sanDuration', isFinite(p.duration) && p.duration > 0, p.duration);
      ok('sanTitleString', typeof p.title === 'string' && typeof p.mediaName === 'string');
      K.setProject(p); K.select(p.lines[0].id);
      for (const t of ['style', 'layout', 'export', 'line']) { K.showTab(t); await wait(60); }
      K.lineMenu(p.lines[0], 100, 100); document.getElementById('menu').hidden = true;
      await wait(100);
      ok('noInjectedElements', document.querySelectorAll('img').length === 0 && !window.__pwn, document.querySelectorAll('img').length);
      ok('listRendered', document.querySelectorAll('#list .li').length === p.lines.length);
      ok('titleIsText', document.getElementById('title').value === p.title && document.title.includes('<img'), document.title);
      K.select(null); }

    // ---- E. 多语言 ----
    { const D = K.I18N, langs = Object.keys(D), base = Object.keys(D['zh-CN']).sort();
      ok('i18nLangs', langs.length === 3 && ['zh-CN', 'ja', 'en'].every((x) => langs.includes(x)), langs);
      langs.forEach((lg) => { const ks = Object.keys(D[lg]).sort(), miss = base.filter((x) => !(x in D[lg])), extra = ks.filter((x) => !(x in D['zh-CN']));
        ok('i18nKeys:' + lg, !miss.length && !extra.length, { miss, extra });
        ok('i18nNonEmpty:' + lg, ks.every((x) => typeof D[lg][x] === 'string' && D[lg][x].trim() !== ''));
        // 占位符在各语言里一致
        ok('i18nParams:' + lg, base.every((x) => JSON.stringify((D['zh-CN'][x].match(/\{\w+\}/g) || []).sort()) === JSON.stringify(((D[lg][x] || '').match(/\{\w+\}/g) || []).sort())), lg); });
      // 每个 data-i18n* 引用的 key 都存在
      const used = [...document.querySelectorAll('[data-i18n],[data-i18n-title],[data-i18n-placeholder],[data-i18n-aria]')].flatMap((el) => [el.dataset.i18n, el.dataset.i18nTitle, el.dataset.i18nPlaceholder, el.dataset.i18nAria]).filter(Boolean);
      ok('i18nHtmlKeysExist', used.every((x) => x in D['zh-CN']), used.filter((x) => !(x in D['zh-CN'])));
      // 插值
      for (const lg of langs) { K.setLang(lg);
        const s1 = K.t('msg.saved', { name: 'A<b>.kara.json' }), s2 = K.t('exp.done', { n: 7, w: 1920, h: 1080, fps: 60, t0: 0 });
        ok('interp:' + lg, s1.includes('A<b>.kara.json') && !/\{\w+\}/.test(s1) && s2.includes('7') && s2.includes('1920') && !/\{\w+\}/.test(s2), [s1, s2]);
        ok('interpMissingParamKept:' + lg, K.t('msg.saved', {}).includes('{name}')); }
      ok('fallbackKey', K.t('no.such.key') === 'no.such.key');
      D['zh-CN'].__only_zh = '中'; K.setLang('en'); ok('fallbackZh', K.t('__only_zh') === '中'); delete D['zh-CN'].__only_zh;
      // 切换语言：按钮文字 / html lang / 动态面板 / 选中与工程不丢
      K.setProject(K.normalizeProject(K.SAMPLES[0].project)); const keepSel = K.screen().ord[2].id; K.select(keepSel); const rev0 = JSON.stringify(K.project);
      const btn = document.getElementById('bNew');
      const label = {};
      for (const lg of ['en', 'ja', 'zh-CN']) {
        K.setLang(lg); K.showTab('line'); await wait(80); label[lg] = btn.textContent;
        ok('langHtmlAttr:' + lg, document.documentElement.lang === lg);
        ok('langSelect:' + lg, document.getElementById('lang').value === lg);
        ok('langBtn:' + lg, btn.textContent === D[lg]['top.new'] && btn.title === D[lg]['top.newTip'], [btn.textContent, btn.title]);
        const bad = [...document.querySelectorAll('[data-i18n]')].filter((el) => el.textContent !== K.t(el.dataset.i18n)).map((el) => el.dataset.i18n);
        ok('allDataI18nApplied:' + lg, !bad.length, bad);
        ok('lineTabRebuilt:' + lg, document.querySelector('#tab-line .blk').textContent === D[lg]['line.text']);
        ok('selKept:' + lg, K.ui.sel === keepSel && JSON.stringify(K.project) === rev0);
      }
      ok('labelsDiffer', new Set(Object.values(label)).size === 3, label);
      // 英文界面里不应残留汉字（歌词本身、工程名、字体名除外）
      K.setLang('en'); K.select(keepSel); await wait(80);
      const leftovers = [];
      for (const t of ['line', 'style', 'layout', 'export']) {
        K.showTab(t); await wait(60);
        const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
        while (w.nextNode()) { const nd = w.currentNode, el = nd.parentElement;
          if (!el || el.closest('#list, td, textarea, script, pre, #toasts, #fontPick, #lang, [hidden]') || el.closest('.tab[hidden]')) continue;
          if (HAN.test(nd.nodeValue.replace('漢字{かんじ}', ''))) leftovers.push(nd.nodeValue.trim().slice(0, 40)); }
        document.querySelectorAll('[title],[placeholder]').forEach((el) => { if (!el.closest('#list, #fontPick') && (HAN.test(el.title || '') || HAN.test(el.placeholder || ''))) leftovers.push('@' + (el.title || el.placeholder).slice(0, 40)); });
      }
      K.lineMenu(K.sel(), 100, 100); [...document.querySelectorAll('#menu button')].forEach((b) => { if (HAN.test(b.textContent)) leftovers.push('menu:' + b.textContent); }); document.getElementById('menu').hidden = true;
      [...document.getElementById('samples').options].forEach((o) => { if (HAN.test(o.textContent)) leftovers.push('sample:' + o.textContent); });
      ok('noChineseLeftInEnglish', !leftovers.length, [...new Set(leftovers)]);
      K.setLang('zh-CN'); await wait(50); }

    // ---- F. 空闲时不重画；有变化时重画 ----
    { K.pause(); K.select(null); await wait(150);
      const s0 = Object.assign({}, K.stats); await frames(12);
      out.idle = { stage: K.stats.stage - s0.stage, tl: K.stats.tl - s0.tl };
      ok('idleNoRedraw', out.idle.stage === 0 && out.idle.tl === 0, out.idle);
      const c1 = Object.assign({}, K.stats); K.seek(K.now() + 0.5); await wait(80);
      ok('seekRedraws', K.stats.stage > c1.stage && K.stats.tl > c1.tl, [c1, K.stats]);
      const c2 = Object.assign({}, K.stats); K.select(K.screen().ord[0].id); await wait(80);
      ok('selectRedraws', K.stats.stage > c2.stage && K.stats.tl > c2.tl);
      const c3 = Object.assign({}, K.stats); K.S().size += 2; K.touch(); await wait(80);
      ok('editRedraws', K.stats.stage > c3.stage); K.undo(); await wait(50);
      const cw0 = cv.clientWidth, c4 = Object.assign({}, K.stats); document.getElementById('app').style.gridTemplateRows = 'auto minmax(0,1fr) 330px'; await wait(120);
      ok('resizeRedraws', cv.clientWidth !== cw0 && K.stats.stage > c4.stage && K.stats.tl > c4.tl, [cw0, cv.clientWidth, c4, K.stats]); document.getElementById('app').style.gridTemplateRows = ''; await wait(80);
      const c5 = Object.assign({}, K.stats); K.setLang('ja'); await wait(80);
      ok('langRedrawsTimeline', K.stats.tl > c5.tl); K.setLang('zh-CN'); await wait(50);
      const c6 = Object.assign({}, K.stats); K.play(); await frames(6); K.pause();
      ok('playRedraws', K.stats.stage - c6.stage >= 4, K.stats.stage - c6.stage); }

    // ---- G. 键盘：焦点在按钮上时空格不切换播放 ----
    { K.pause(); const b = document.getElementById('bZin'); b.focus(); key(b, ' ', 'Space'); await wait(20);
      ok('spaceOnButtonNoPlay', !K.playing()); b.blur();
      key(document.body, ' ', 'Space'); await wait(20); ok('spaceOnBodyPlays', K.playing()); K.pause();
      b.focus(); b.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 1 })); ok('mouseClickBlursButton', document.activeElement !== b); }

    // ---- I. 事件取消订阅 ----
    { let c = 0; const f = () => c++, un = K.on('__t', f); K.emit('__t'); un(); K.emit('__t');
      K.on('__t', f); K.off('__t', f); K.emit('__t');
      let d = 0; const g1 = () => { d++; K.off('__t', g1); }, g2 = () => d++; K.on('__t', g1); K.on('__t', g2); K.emit('__t'); K.emit('__t');
      ok('offUnsubscribes', c === 1 && d === 3, [c, d]); }

    // ---- J. 快捷键表 = 帮助 = 实际处理 ----
    { K.setProject(K.normalizeProject(K.SAMPLES[0].project), false, { src: 'sample' }); await wait(50);
      const ev = (spec) => { const p = spec.split('+'), tok = p.pop(), ctrl = p.includes('Ctrl'), shift = p.includes('Shift');
        const SH = { '[': '{', ']': '}', ',': '<', '.': '>' }, k = tok === 'Space' ? ' ' : /^[A-Z]$/.test(tok) ? (shift ? tok : tok.toLowerCase()) : shift && SH[tok] ? SH[tok] : tok;
        return new KeyboardEvent('keydown', { key: k, code: tok === 'Space' ? 'Space' : /^[A-Z]$/.test(tok) ? 'Key' + tok : '', ctrlKey: ctrl, shiftKey: shift, bubbles: true, cancelable: true }); };
      const bad = [];
      K.KEYS.forEach((b) => b.k.forEach((spec, i) => { const m = K.matchKey(ev(spec)); if (!m || m.b !== b || m.i !== i) bad.push(spec + '→' + (m ? m.b.label : 'none')); }));
      ok('everyBoundKeyMatchesItsRow', !bad.length, bad);
      ok('altIgnored', K.matchKey(new KeyboardEvent('keydown', { key: 'l', altKey: true })) === null);
      ok('jisBracketShift', (K.matchKey(new KeyboardEvent('keydown', { key: '{', shiftKey: true })) || {}).b === K.KEYS.find((b) => b.label === 'k.nudge5'));
      ok('helpLabelsTranslated', K.KEYS.every((b) => K.has(b.label) && (!b.hint || K.has(b.hint)) && K.KEY_GROUPS.includes(b.grp)));
      key(document.body, '?', 'Slash'); await frames(1);
      const hd = document.querySelector('dialog.help');
      const rows = hd ? [...hd.querySelectorAll('tr[data-key-id]')].map((r) => r.dataset.keyId) : [];
      ok('helpOpensWithQuestion', !!(hd && hd.open), !!hd);
      ok('helpCoversEveryBinding', rows.length === K.KEYS.length && K.KEYS.every((b) => rows.includes(b.label)), { rows: rows.length, keys: K.KEYS.length });
      ok('helpMouseRows', hd && hd.querySelectorAll('tr:not([data-key-id])').length === K.MOUSE.reduce((n, g) => n + g[1].length, 0));
      ok('helpAbout', hd && hd.querySelector('.about').textContent.includes(K.APP.version) && hd.querySelector('.about').textContent.includes('MIT') && hd.querySelector('.about').textContent.includes(K.APP.repo));
      K.setLang('ja'); await frames(1);
      ok('helpRetranslates', hd.querySelector('h2').textContent === K.t('help.title') && document.querySelector('dialog.help') === hd);
      K.setLang('zh-CN'); await frames(1);
      hd.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); await frames(1);
      ok('helpEscCloses', !document.querySelector('dialog.help') && !K.modalOpen());
      key(document.body, 'F1'); await frames(1); const h2 = document.querySelector('dialog.help'); ok('helpF1', !!h2); if (h2) h2.querySelector('[data-x]').click(); await frames(1);
      const hint = document.getElementById('keys').textContent;
      ok('hintFromTable', K.KEYS.filter((b) => b.hint).every((b) => hint.includes(K.t(b.hint))), hint); }

    // ---- K. 播放速度 / 循环 / 从行首播放 ----
    { K.pause(); const sp = document.getElementById('speed');
      K.setSpeed(0.5); ok('speedSet', K.ui.speed === 0.5 && sp.value === '0.5' && K.pref('speed') === 0.5);
      K.seek(10); K.play(); let ts = performance.now(); K.tick(ts); const a = K.now(); K.tick(ts + 1000); const b = K.now(); K.pause();
      out.speedClock = +(b - a).toFixed(3); ok('speedSilentClock', near(out.speedClock, 0.5, 0.01), out.speedClock);
      document.body.dispatchEvent(new KeyboardEvent('keydown', { key: '>', shiftKey: true, bubbles: true, cancelable: true }));
      ok('speedKey', K.ui.speed === 0.75, K.ui.speed);
      K.setSpeed(9); ok('speedClamped', K.ui.speed === 1);
      K.select(null); key(document.body, 'l'); ok('loopNeedsSelection', K.ui.loop === false);
      const l = K.screen().ord[3]; K.select(l.id);
      key(document.body, 'l'); const lr = K.loopRange();
      ok('loopOn', K.ui.loop && K.playing() && lr && near(lr[0], K.ls(l) + K.S().offset - 1, 1e-3) && near(lr[1], l.end + K.S().offset + 0.4, 1e-3), lr);
      ok('loopButtonState', document.getElementById('bLoop').getAttribute('aria-pressed') === 'true');
      const st = Object.assign({}, K.stats); K.seek(lr[1] + 0.01); K.tick(performance.now());
      ok('loopWraps', near(K.now(), lr[0], 0.05), K.now());
      ok('loopDrawn', K.stats.tl > st.tl);
      const l2 = K.screen().ord[6]; K.select(l2.id); ok('loopFollowsSelection', near(K.loopRange()[0], K.ls(l2) + K.S().offset - 1, 1e-3) && K.now() >= K.loopRange()[0] - 1e-6);
      key(document.body, 'L'); ok('loopOff', !K.ui.loop && K.loopRange() === null); K.pause();
      K.select(l.id); key(document.body, 'Enter'); ok('enterPlaysLine', K.playing() && near(K.now(), K.ls(l) + K.S().offset - 1, 0.05), K.now()); K.pause(); }

    // ---- L. 应用内对话框替代 confirm() ----
    { let native = 0; const oc = window.confirm; window.confirm = () => { native++; return true; };
      K.setProject(K.normalizeProject(K.SAMPLES[0].project), false, { src: 'sample' }); K.ops.shift(K.project.lines[0], 0.1);
      const n0 = K.project.lines.length;
      document.getElementById('bNew').click(); await frames(1);
      let d = document.querySelector('dialog.small');
      ok('modalShown', !!(d && d.open && d.getAttribute('aria-labelledby') && d.querySelector('.pri.danger')) && native === 0);
      ok('modalFocus', d && d.contains(document.activeElement));
      const bs = d ? [...d.querySelectorAll('button')] : []; bs[bs.length - 1].focus();
      d.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true }));
      ok('modalTabTrap', bs[0] === document.activeElement, document.activeElement && document.activeElement.textContent);
      d.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); await frames(1);
      ok('modalEscCancels', !document.querySelector('dialog.small') && K.project.lines.length === n0 && K.dirty);
      document.getElementById('bNew').click(); await frames(1); d = document.querySelector('dialog.small');
      d.querySelector('.dbody').dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true })); await wait(30);
      ok('modalEnterDefault', !document.querySelector('dialog.small') && K.project.lines.length === 0 && !K.dirty && K.doc.src === 'new');
      ok('noNativeConfirm', native === 0); window.confirm = oc;
      // 空状态：预览区和列表都有操作按钮
      await frames(2); const em = document.getElementById('empty');
      ok('emptyStateStage', !em.hidden && em.querySelectorAll('[data-act]').length === K.welcomeActions.filter((a) => a.where.includes('empty')).length);
      ok('emptyStateList', document.querySelectorAll('#list [data-act]').length >= 2);
      K.ops.add(1); await frames(1); ok('emptyStateHidesWithLines', em.hidden); }

    // ---- M. 媒体横幅 / 无声时钟 ----
    { const p = K.normalizeProject({ title: 'T', mediaName: 'song<b>.mp3', lines: [{ start: 1, end: 2, text: 'ab' }] });
      K.setProject(p, false, { src: 'file', name: 't.kara.json' }); await frames(2);
      const bn = document.getElementById('mbanner');
      ok('bannerMissingMedia', !bn.hidden && bn.textContent.includes('song<b>.mp3') && !bn.querySelector('b'), bn.textContent);
      document.getElementById('mbClose').click(); ok('bannerDismiss', bn.hidden);
      K.setProject(K.normalizeProject(K.SAMPLES[0].project), false, { src: 'sample' }); await frames(1);
      ok('bannerSample', !bn.hidden && bn.textContent.includes(K.t('mb.sample')));
      K.setProject(K.normalizeProject({ lines: [{ start: 1, end: 2, text: 'x' }] }), false, { src: 'import' }); await frames(1);
      ok('noBannerWithoutMediaName', bn.hidden);
      const ck = document.getElementById('clock'); K.play(); await frames(2);
      ok('silentClockShown', !ck.hidden && ck.classList.contains('on')); K.pause(); await frames(1); ok('silentClockIdle', !ck.hidden && !ck.classList.contains('on')); }

    // ---- N. 保存状态 / 关闭前提醒 / 撤销按钮 ----
    { const ss = document.getElementById('saveState'), bu = document.getElementById('bUndo');
      const unload = () => { const e = new Event('beforeunload', { cancelable: true }); window.dispatchEvent(e); return e.defaultPrevented; };
      K.setProject(K.normalizeProject(K.SAMPLES[0].project), false, { src: 'sample' }); await frames(1);
      ok('stateSample', ss.textContent === K.t('ss.sample') && !unload() && bu.disabled, ss.textContent);
      K.ops.shift(K.project.lines[0], 0.1); await frames(1);
      ok('stateAutoOnly', ss.textContent === K.t('ss.autoOnly') && ss.classList.contains('warn') && unload(), ss.textContent);
      ok('undoEnabledWithLabel', !bu.disabled && bu.title.includes(K.t('u.shift')), bu.title);
      K.markSaved('x.kara.json', 'download'); await frames(1);
      ok('stateSynced', ss.textContent === K.t('ss.synced', { name: 'x.kara.json' }) && !unload(), ss.textContent);
      const meta = K.loadAutosaveMeta(); ok('metaPersisted', meta.dirty === false && meta.name === 'x.kara.json' && meta.src === 'download', meta);
      K.undo(); await frames(1); ok('redoLabel', !document.getElementById('bRedo').disabled && document.getElementById('bRedo').title.includes(K.t('u.shift'))); }

    // ---- O. 焦点：鼠标选过的下拉框不吞快捷键；聚焦的滑块自己用方向键 ----
    { K.showTab('style'); await wait(60); const rg = document.querySelector('#tab-style input[type=range]'), t0 = K.now();
      rg.focus(); rg.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true }));
      ok('rangeArrowNoSeek', K.now() === t0 && document.activeElement === rg); rg.blur();
      const sel = document.querySelector('#tab-style select[data-s="weight"]'); sel.focus();
      sel.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); sel.dispatchEvent(new Event('change', { bubbles: true }));
      ok('selectBlurAfterMouse', document.activeElement !== sel); K.undo();
      ok('selectTitle', !!sel.title);
      document.querySelector('#tool button[data-v="scrub"]').click(); ok('prefTool', K.pref('tool') === 'scrub' && K.ui.tool === 'scrub');
      document.querySelector('#tool button[data-v="retime"]').click();
      document.querySelector('#tabs button[data-t="layout"]').click(); ok('prefTab', K.pref('tab') === 'layout'); K.showTab('line'); }

    // ---- P. 时间线：拖动提示、Shift 不吸附、缩放到全曲 / 选中行、行名栏 ----
    { K.setProject(K.normalizeProject(K.SAMPLES[0].project), false, { src: 'sample' }); const l = K.screen().ord[2]; K.select(l.id);
      K.tl.pps = 80; K.tl.scroll = 24; await wait(60);
      const r = tlc.getBoundingClientRect(), TX = (t) => r.left + K.tl.gut + (t - K.tl.scroll) * 80, I = K.screen().info.get(l.id), y = r.top + 22 + I.row * 46 + 36;
      const u3 = l.units[3].s; K.seek(u3 + 0.03 + K.S().offset); await wait(30);
      ev(tlc, 'pointerdown', TX(u3), y); ev(tlc, 'pointermove', TX(u3) + 3, y);
      const tip = document.getElementById('tip'); out.tip = tip.textContent;
      ok('dragTooltip', !tip.hidden && tip.textContent.includes(K.fmt3(K.line(l.id).units[3].s)) && tip.textContent.includes(l.units[3].t), out.tip);
      ok('snapsWithoutShift', near(K.line(l.id).units[3].s, u3 + 0.03, 2e-3), K.line(l.id).units[3].s);
      ev(tlc, 'pointermove', TX(u3) + 3, y, { shiftKey: true });
      ok('shiftDisablesSnap', near(K.line(l.id).units[3].s, u3 + 3 / 80, 2e-3), K.line(l.id).units[3].s);
      ev(tlc, 'pointerup', TX(u3) + 3, y); ok('tooltipHidesOnUp', tip.hidden); K.undo();
      K.tlFit(); const vw = tlc.clientWidth - K.tl.gut;
      ok('zoomFit', K.tl.pps * K.dur() <= vw + 1 && K.tl.pps * K.dur() > vw * 0.8, [K.tl.pps, K.dur(), vw]);
      K.tlFitSel(); ok('zoomSel', K.tl.pps > 80 && K.tl.scroll <= K.ls(l) && K.tl.scroll + vw / K.tl.pps >= K.line(l.id).end, K.tl.pps);
      // 左侧行名栏：点它不会选中块
      ev(tlc, 'pointerdown', r.left + 10, y); ev(tlc, 'pointerup', r.left + 10, y); ok('gutterNoSelect', K.ui.sel === l.id);
      // 中键 / 空白处拖动 = 平移
      const s0 = K.tl.scroll; ev(tlc, 'pointerdown', r.left + 300, y, { button: 1 }); ev(tlc, 'pointermove', r.left + 200, y, { button: 1 }); ev(tlc, 'pointerup', r.left + 200, y, { button: 1 });
      ok('middlePan', near(K.tl.scroll - s0, 100 / K.tl.pps, 1e-6), [s0, K.tl.scroll]);
      // 预览：只点光标不改时间；双击跳到行首
      const T0 = K.ls(l) + 0.3; K.seek(T0 + K.S().offset); await wait(40);
      const G = K.geo(K.line(l.id), K.screen().info.get(l.id), cv.width, cv.height), ex = G.x0 + K.progressEdge(K.line(l.id), G.L, T0) * G.s, rc = cv.getBoundingClientRect();
      const cx = rc.left + ex * rc.width / cv.width, cy = rc.top + (G.y - K.S().size * 0.4) * rc.height / cv.height, before = JSON.stringify(K.line(l.id).units);
      ev(cv, 'pointerdown', cx, cy); ev(cv, 'pointerup', cx, cy);
      ok('cursorClickNoRetime', JSON.stringify(K.line(l.id).units) === before);
      cv.dispatchEvent(new MouseEvent('dblclick', { clientX: cx, clientY: cy, bubbles: true }));
      ok('stageDblClickSeeks', near(K.now(), K.ls(l) + K.S().offset - 0.5, 0.01), K.now()); }

    // ---- Q. 提示条可堆叠、错误样式不同、可关闭 ----
    { const box = document.getElementById('toasts'); box.innerHTML = '';
      K.toast('a'); K.toast('b', 'error'); K.toast('c', 'ok');
      ok('toastsStack', box.children.length === 3 && box.querySelector('.toast.error[role="alert"]') && box.querySelector('.toast.info[role="status"]'));
      box.querySelector('.toast.error .x').click(); ok('toastDismiss', box.children.length === 2 && !box.querySelector('.error'));
      K.toast('a'); ok('toastDedupe', box.children.length === 2); box.innerHTML = ''; }

    // ---- R. 无障碍：只有图标的按钮都有名字；对话框有角色 ----
    { const unnamed = [...document.querySelectorAll('button')].filter((b) => !b.closest('[hidden]') && !(b.getAttribute('aria-label') || b.textContent.trim().replace(/[^\p{L}\p{N}]/gu, '')).length).map((b) => b.id || b.outerHTML.slice(0, 60));
      ok('iconButtonsNamed', !unnamed.length, unnamed);
      ok('ariaKeysExist', [...document.querySelectorAll('[data-i18n-aria]')].every((el) => K.has(el.dataset.i18nAria) && el.getAttribute('aria-label') === K.t(el.dataset.i18nAria))); }

    // ---- S. 阶段 3：添加歌词 / LRC / SRT / ASS / 自动注音 / ZIP ----
    { const plain = (x) => x.units.map((u) => u.t).join('');
      /* S0. 启动时不碰网络：kuromoji 只在用户要求时才加载 */
      ok('noKuromojiAtStartup', !window.kuromoji && K.furi.tokenizer === null && !document.querySelector('script[src*="jsdelivr"], script[src*="kuromoji"]') && !performance.getEntriesByType('resource').some((e) => /jsdelivr/.test(e.name)));

      /* S1. 粘贴歌词：行数 / 分段 / 注音 / 均分时间 / 一步撤销 / 选中第一行 */
      K.setProject(K.blank()); K.select(null); await frames(1);
      const before = JSON.stringify(K.project);
      const txt = '夜空に光る星{ほし}の\r\n約束{やくそく}を忘れない\n\n\n  second para line  \n\tlast\u0007';
      const A = K.addLyrics(txt, { mode: 'replace', start: 10, dur: 3, gap: 4 });
      out.paste = A && A.map((x) => [plain(x), x.newPara, K.ls(x), x.end]);
      ok('pasteLineCount', A && A.length === 4 && K.project.lines.length === 4, out.paste);
      ok('pasteParagraphFlags', A.map((x) => x.newPara).join() === ',,true,', A.map((x) => x.newPara));
      ok('pasteFuriganaParsed', A[0].units.length === 7 && A[0].units[5].t === '星' && A[0].units[5].r === 'ほし' && A[1].units[0].t === '約束' && A[1].units[0].r === 'やくそく' && K.unitsToText(A[0].units) === '夜空に光る星{ほし}の');
      ok('pasteTrimsAndSanitises', plain(A[2]) === 'second para line' && plain(A[3]) === 'last', [plain(A[2]), plain(A[3])]);
      ok('pasteBackToBack', near(K.ls(A[0]), 10) && near(A[0].end, 13) && near(K.ls(A[1]), 13) && near(A[1].end, 16) && near(K.ls(A[2]), 20) && near(A[2].end, 23) && near(K.ls(A[3]), 23), out.paste);
      ok('pasteEvenSplit', near(A[0].units[3].s, 10 + 3 * 3 / 7, 1e-3) && near(A[0].units[6].s, 10 + 6 * 3 / 7, 1e-3), A[0].units.map((u) => u.s));
      ok('pasteEvenSplitSkipsSpaces', near(A[2].units[0].s, 20) && near(A[2].units[7].s, 20 + 6 * 3 / 14, 1e-2), A[2].units.map((u) => u.s));
      ok('pasteSelectsFirst', K.ui.sel === A[0].id);
      ok('pasteDurationCoversLines', K.project.duration >= 26 + 5 - 1e-6, K.project.duration);
      ok('pasteSingleUndoStep', K.undoWhy() === 'paste' && (K.undo(), JSON.stringify(K.project) === before && !K.canUndo()));
      K.redo(); ok('pasteRedo', K.project.lines.length === 4);
      { const B = K.addLyrics('x\ny', { mode: 'append', start: 40, dur: 2, gap: 4, firstPara: true });
        ok('pasteAppend', K.project.lines.length === 6 && B[0].newPara === true && near(K.ls(B[1]), 42), K.project.lines.length);
        K.undo(); ok('pasteAppendUndoOneStep', K.project.lines.length === 4); }
      ok('pasteEmptyIsNull', K.addLyrics(' \n\n\t\n', { mode: 'append', start: 0, dur: 3, gap: 4 }) === null && K.project.lines.length === 4);
      { const X = K.addLyrics('<img src=x onerror="window.__pwn=2">', { mode: 'append', start: 50, dur: 3, gap: 4 }); await frames(3);
        ok('pasteNoInjection', X.length === 1 && !document.querySelector('#list img, #tab-line img') && !window.__pwn, document.querySelectorAll('img').length); K.undo(); }
      /* 对话框：从顶栏菜单进入，空内容不能提交，切换语言不丢文字，提交后一步撤销 */
      K.setProject(K.blank()); await frames(1);
      document.getElementById('bImport').click(); await frames(1);
      { const mb = [...document.querySelectorAll('#menu button')];
        ok('importMenuHasPaste', !document.getElementById('menu').hidden && mb.length === 2 && mb[0].textContent === K.t('imp.paste'), mb.map((b) => b.textContent));
        mb[0].click(); await frames(1);
        const dlg = document.querySelector('dialog.paste'), ta = dlg && dlg.querySelector('#plText');
        ok('pasteDialogOpens', !!(dlg && dlg.open && ta) && dlg.contains(document.activeElement));
        ok('pasteGoDisabledWhenEmpty', dlg.querySelector('.dacts .pri').disabled);
        ta.value = 'あい\nう\n\nえ'; ta.dispatchEvent(new Event('input', { bubbles: true }));
        ok('pasteCounter', !dlg.querySelector('.dacts .pri').disabled && dlg.querySelector('#plCount').textContent === K.t('pl.count', { n: 3, p: 2, s: 13 }), dlg.querySelector('#plCount').textContent);
        K.setLang('ja'); await frames(1);
        ok('pasteDialogKeepsTextOnLang', dlg.querySelector('#plText').value === 'あい\nう\n\nえ' && dlg.querySelector('h2').textContent === K.t('pl.title') && !dlg.querySelector('.dacts .pri').disabled);
        K.setLang('zh-CN'); await frames(1);
        ok('pasteAfterOptionDisabledWhenEmpty', dlg.querySelector('#plStart option[value="after"]').disabled);
        dlg.querySelector('.dacts .pri').click(); await frames(2);
        ok('pasteDialogAdds', !document.querySelector('dialog.paste') && K.project.lines.length === 3 && K.project.lines[2].newPara === true && K.ui.sel === K.project.lines[0].id && K.undoWhy() === 'paste', K.project.lines.length);
        ok('pasteToastTellsNextStep', [...document.querySelectorAll('#toasts .toast')].some((t) => t.textContent.includes(K.t('pl.done', { n: 3 }))));
        K.undo(); ok('pasteDialogUndoOneStep', K.project.lines.length === 0 && !K.canUndo()); }
      { const pa = K.welcomeActions.find((a) => a.id === 'paste');
        ok('welcomeHasPaste', pa && pa.where.includes('welcome') && pa.where.includes('empty') && K.has(pa.label) && K.has(pa.desc));
        await frames(2); const eb = document.querySelector('#empty [data-act="paste"]'); ok('emptyStateHasPaste', !!eb);
        eb.click(); await frames(1); ok('emptyStatePasteOpensDialog', !!document.querySelector('dialog.paste'));
        document.querySelector('dialog.paste').dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })); await frames(1); ok('pasteEscCloses', !document.querySelector('dialog.paste') && !K.modalOpen()); }

      /* S2. LRC 导入 */
      { const P = (t) => K.normalizeProject(K.parseLrc(t));
        const a = P('\uFEFF[ti:My Song]\r\n[ar:Someone]\r\n[offset:500]\r\n[00:10.00]First line\r\n[00:14.50]  Second\r\n[00:30.00]\r\n[00:40.00]Third\r\njunk line\r\n');
        out.lrcA = a.lines.map((x) => [plain(x), K.ls(x), x.end]);
        ok('lrcTitleAndLines', a.title === 'My Song' && a.lines.length === 3 && a.lines.map(plain).join('|') === 'First line|Second|Third', out.lrcA);
        ok('lrcOffsetApplied', near(K.ls(a.lines[0]), 9.5, 1e-3) && near(K.ls(a.lines[1]), 14, 1e-3) && near(K.ls(a.lines[2]), 39.5, 1e-3), out.lrcA);
        ok('lrcEndIsNextStart', near(a.lines[0].end, 14, 1e-3), a.lines[0].end);
        ok('lrcEndCappedAt8s', near(a.lines[1].end, 22, 1e-3) && near(a.lines[2].end, 47.5, 1e-3), [a.lines[1].end, a.lines[2].end]);
        ok('lrcPlainEvenSplit', near(a.lines[0].units[7].s, 9.5 + 4.5 * 6 / 9, 1e-2), a.lines[0].units.map((u) => u.s));
        const b = P('[00:05.00][01:05.00]Repeat\n[00:10.00]Other\n[00:50.5]x\n[00:51.250]y');
        out.lrcB = b.lines.map((x) => [plain(x), K.ls(x), x.end]);
        ok('lrcMultiTimestamp', b.lines.map(plain).join() === 'Repeat,Other,x,y,Repeat' && near(K.ls(b.lines[4]), 65) && near(b.lines[0].end, 10) && near(b.lines[1].end, 18) && near(K.ls(b.lines[2]), 50.5) && near(K.ls(b.lines[3]), 51.25), out.lrcB);
        const c = P('[00:20.00]<00:20.00>he<00:20.50>llo <00:21.00>world<00:22.00>\n[00:30.00][00:40.00]<00:30.00>a<00:31.00>b<00:32.00>');
        const L = c.lines[0], u = L.units;
        out.lrcC = c.lines.map((x) => [plain(x), x.units.map((q) => q.s), x.end]);
        ok('lrcEnhancedUnits', plain(L) === 'hello world' && near(u[0].s, 20) && near(u[1].s, 20.25, 1e-3) && near(u[2].s, 20.5) && near(u[6].s, 21) && near(L.end, 22), out.lrcC);
        ok('lrcEnhancedMultiStampShift', plain(c.lines[2]) === 'ab' && near(K.ls(c.lines[2]), 40) && near(c.lines[2].units[1].s, 41) && near(c.lines[2].end, 42) && near(c.lines[1].units[1].s, 31) && near(c.lines[1].end, 32), out.lrcC);
        let thrown = false; try { K.parseLrc('hello\nworld'); } catch (e) { thrown = true; }
        ok('lrcNoTimestampsThrows', thrown);
        ok('lrcFuriganaSyntax', P('[00:01.00]星{ほし}の').lines[0].units[0].r === 'ほし');
        // 通过“拖入文件”这条路径导入（和 SRT 同一套确认 / 排队逻辑）
        const f = new File(['[ti:Dropped]\n[00:01.00]hello\n[00:03.00]world\n'], 'x.lrc', { type: '' }); const dt = new DataTransfer(); dt.items.add(f); K.dirty = false;
        window.dispatchEvent(new DragEvent('drop', { dataTransfer: dt, bubbles: true, cancelable: true })); await until(() => K.project.title === 'Dropped');
        ok('lrcDropImports', K.project.title === 'Dropped' && K.project.lines.length === 2 && K.doc.src === 'import' && [...document.querySelectorAll('#toasts .toast')].some((t) => t.textContent.includes(K.t('msg.lrc'))), [K.project.title, K.project.lines.length, K.doc.src]); }

      /* S3. 导出：LRC 往返 / SRT / ASS */
      for (const si of [0, 1]) {
        K.setProject(K.normalizeProject(K.SAMPLES[si].project)); const O = K.S().offset;
        const src = K.project.lines.filter((x) => plain(x).trim()).sort((p, q) => K.ls(p) - K.ls(q));
        const back = K.normalizeProject(K.parseLrc(K.exportLrcText(true))).lines; let worst = 0, bad = null;
        if (back.length !== src.length) bad = 'count ' + back.length + '/' + src.length;
        else src.forEach((x, i) => {
          // 增强 LRC 每组（字母音节 / 其余的字）一个标签：只比较组开头的时间；音节里其余字母读回时在标签之间插值
          const gs = new Set(K.groups(x).map((g) => g.i)), sc = []; x.units.forEach((q, ui) => Array.from(q.t).forEach((ch, ci) => sc.push([ch, ci || !gs.has(ui) ? null : Math.max(0, q.s + O)]))); const bc = back[i].units.map((q) => [q.t, q.s]);
          const trim = (a) => { a = a.slice(); while (a.length && !a[0][0].trim()) a.shift(); while (a.length && !a[a.length - 1][0].trim()) a.pop(); return a; };
          const A2 = trim(sc), B2 = trim(bc);
          if (A2.map((q) => q[0]).join('') !== B2.map((q) => q[0]).join('')) { bad = bad || 'text ' + i + ' ' + JSON.stringify([A2.map((q) => q[0]).join(''), B2.map((q) => q[0]).join('')]); return; }
          A2.forEach((q, k) => { if (q[1] != null) worst = Math.max(worst, Math.abs(q[1] - B2[k][1])); });
          worst = Math.max(worst, Math.abs(Math.max(0, x.end + O) - back[i].end));
        });
        ok('lrcRoundTrip:' + si, !bad && worst <= 0.01, { bad, worst, lines: src.length });
        ok('lrcTagPerGroup:' + si, K.exportLrcText(true).split('\n').filter((x) => /^\[\d/.test(x)).every((x, i) => (x.match(/<\d/g) || []).length === K.groups(src[i]).length + 1));
        ok('lrcReimportStable:' + si, back.every((x, i) => (src[i].units.some((u) => u.r) || K.bounds(x).length === K.bounds(src[i]).length) && x.units.every((u, k, a) => !k || u.s >= a[k - 1].s)));
        // SRT：一行一条，起止 = 行的开始 / 结束；能被应用自己的 SRT 导入读回
        const srt = K.exportSrtText(), cues = K.parseSrt(srt);
        ok('srtShape:' + si, /^1\n\d\d:\d\d:\d\d,\d{3} --> \d\d:\d\d:\d\d,\d{3}\n.+/.test(srt) && cues.length === src.length && new RegExp('\\n\\n' + src.length + '\\n').test(srt), srt.slice(0, 120));
        ok('srtTimes:' + si, cues.every((c, i) => Math.abs(c.start - (K.ls(src[i]) + O)) < 0.002 && Math.abs(c.end - (src[i].end + O)) < 0.002 && c.text === plain(src[i]).trim()), cues[0]);
      }
      { K.setProject(K.normalizeProject(K.SAMPLES[0].project)); const S = K.S(); Object.assign(S, { baseFill: '#112233', highFill: '#ffd84d', baseStroke: '#445566', W: 1280, H: 720, font: "'Meiryo', 'Yu Gothic UI', sans-serif", weight: 'bold' });
        ok('assColorConversion', K.assColor('#ffd84d') === '4DD8FF' && K.assColor('#112233') === '332211' && K.assColor('#ff0000') === '0000FF' && K.assColor('nonsense') === 'FFFFFF');
        const ass = K.exportAssText(), ls = ass.split('\n'), sty = ls.find((x) => x.startsWith('Style: Default,')).split(',');
        ok('assHeader', ls[0] === '[Script Info]' && ass.includes('[V4+ Styles]') && ass.includes('[Events]') && ass.includes('PlayResX: 1280') && ass.includes('PlayResY: 720'), ls.slice(0, 8));
        ok('assStyle', sty[1] === 'Meiryo' && +sty[2] === S.size && sty[3] === '&H004DD8FF' && sty[4] === '&H00332211' && sty[5] === '&H00665544' && sty[7] === '-1', sty);
        const src = K.screen().ord.filter((x) => plain(x).trim()), dl = ls.filter((x) => x.startsWith('Dialogue:'));
        ok('assOneDialoguePerLine', dl.length === src.length && src.length > 10, [dl.length, src.length]);
        let bad = null;
        dl.forEach((d, i) => {
          const f = d.split(','), text = f.slice(9).join(','), kf = [...text.matchAll(/\\kf(\d+)/g)].map((m) => +m[1]), l = src[i];
          const sum = kf.reduce((a, b) => a + b, 0), want = (l.end - K.ls(l)) * 100;
          if (!/^\d:\d\d:\d\d\.\d\d$/.test(f[1]) || !/^\d:\d\d:\d\d\.\d\d$/.test(f[2])) bad = bad || ['time', d.slice(0, 60)];
          if (kf.length !== l.units.length || Math.abs(sum - want) > 1.01) bad = bad || ['kf', i, kf.length, l.units.length, sum, want];
          if (text.replace(/\{[^}]*\}/g, '') !== plain(l)) bad = bad || ['text', i, text];
        });
        ok('assKaraokeDurations', !bad, bad);
        ok('assDropsFurigana', !dl.join('\n').includes('おうどう') && src.some((x) => x.units.some((q) => q.r)));
        K.setProject(K.normalizeProject(K.SAMPLES[0].project)); }

      /* S4. 自动注音（分词器用桩，不联网） */
      { const WORDS = { '受け入れ': [['受け入れ', 'ウケイレ']], 'お嬢さん': [['お嬢さん', 'オジョウサン']], '飲み干そう': [['飲み干そ', 'ノミホソ'], ['う', 'ウ']], 'ロシ': [['ロシ', undefined]], '死刑': [['死刑', 'シキョウ']], '判決': [['判決', 'ハンケツ']], '王道': [['王道', 'オウドウ']] };
        const KEYS = Object.keys(WORDS).sort((a, b) => b.length - a.length);
        const stub = { tokenize: (t) => { const o = []; let i = 0; while (i < t.length) { const k = KEYS.find((w) => t.startsWith(w, i)); if (k) { WORDS[k].forEach((x) => o.push({ surface_form: x[0], reading: x[1] })); i += k.length; } else { o.push({ surface_form: t[i], reading: undefined }); i++; } } return o; } };
        const mk = (text, ts, end) => { const l = K.newLine({ units: K.parseText(text), end }); l.units.forEach((u, i) => (u.s = ts[i])); return l; };
        const show = (l) => l.units.map((u) => u.t + (u.r ? '{' + u.r + '}' : '')).join('|');
        const F = K.furi; F.tokenizer = stub;
        // 词 → 单元：汉字块只拿自己的读音
        const sp = (s, r) => F.tokenSpecs(s, r).specs.map((x) => x.t + (x.r ? '{' + x.r + '}' : '')).join('|');
        ok('furiAnchorUkeire', sp('受け入れ', 'ウケイレ') === '受{う}|け|入{い}|れ', sp('受け入れ', 'ウケイレ'));
        ok('furiAnchorOjousan', sp('お嬢さん', 'オジョウサン') === 'お|嬢{じょう}|さ|ん', sp('お嬢さん', 'オジョウサン'));
        ok('furiAnchorNomihosou', sp('飲み干そ', 'ノミホソ') === '飲{の}|み|干{ほ}|そ', sp('飲み干そ', 'ノミホソ'));
        ok('furiKatakanaWord', sp('ロシ', 'ロシ') === 'ロ|シ' && sp('ロシ', undefined) === 'ロ|シ');
        ok('furiWholeKanjiWordKeepsOneUnit', sp('王道', 'オウドウ') === '王道{おうどう}' && sp('死刑', 'シケイ') === '死刑{しけい}');
        ok('furiUnmatchableReadingSkipped', sp('受け入れ', 'アイウエオ') === '受|け|入|れ' && F.tokenSpecs('受け入れ', 'アイウエオ').miss === 1 && F.tokenSpecs('受け入れ', undefined).miss === 1);
        ok('furiCatakanaToHiragana', sp('今日', 'キョウ') === '今日{きょう}' && sp('一ヶ月', 'イッカゲツ') === '一ヶ月{いっかげつ}');
        // 整个项目：一步撤销
        K.setProject(K.blank());
        const lines = [mk('受け入れ', [1, 1.5, 2, 2.7], 3.5), mk('お嬢さん', [4, 4.2, 4.4, 4.6], 5), mk('飲み干そう', [6, 6.2, 6.4, 6.6, 6.8], 7.5), mk('ロシ', [8, 8.4], 9), mk('王道を', [10, 10.4, 10.8], 11.5)];
        K.project.lines = lines; K.commit('edit'); const snapBefore = JSON.stringify(K.project);
        const r = F.run('all', false);
        out.furi = K.project.lines.map(show);
        ok('furiRunAll', out.furi.join(' / ') === '受{う}|け|入{い}|れ / お|嬢{じょう}|さ|ん / 飲{の}|み|干{ほ}|そ|う / ロ|シ / 王道{おうどう}|を' && r.added === 6 && r.lines === 4 && r.kanji === 4, [out.furi, r]);
        ok('furiTimingKept', K.project.lines[0].units.map((u) => u.s).join() === '1,1.5,2,2.7' && K.project.lines[0].end === 3.5 && K.project.lines[1].units.map((u) => u.s).join() === '4,4.2,4.4,4.6' && K.project.lines[2].units.map((u) => u.s).join() === '6,6.2,6.4,6.6,6.8');
        ok('furiMergedUnitStartsAtFirstChar', K.project.lines[4].units[0].t === '王道' && K.project.lines[4].units[0].s === 10 && K.project.lines[4].units[1].s === 10.8 && K.project.lines[4].end === 11.5, K.project.lines[4].units);
        ok('furiPureKatakanaLineUntouched', JSON.stringify(K.project.lines[3].units) === JSON.stringify(lines[3].units) && !K.project.lines[3].units.some((u) => u.r));
        ok('furiRoundTripsThroughText', K.project.lines.every((x) => K.parseText(K.unitsToText(x.units)).map((u) => u.t + (u.r || '')).join() === x.units.map((u) => u.t + (u.r || '')).join()));
        ok('furiAllLinesOneUndoStep', K.undoWhy() === 'furi' && (K.undo(), JSON.stringify(K.project) === snapBefore && K.undoWhy() === 'edit'));
        // 已有注音保留（含逐拍时间），overwrite 时才替换
        K.setProject(K.blank());
        const ex = mk('死刑判決', [20, 21, 22], 23); ex.units = [{ t: '死刑', r: 'しけい', s: 20, m: [20.3, 20.6] }, { t: '判', r: null, s: 21 }, { t: '決', r: null, s: 22 }]; K.fixLine(ex);
        K.project.lines = [ex]; K.commit('edit');
        const r1 = F.run('all', false), u1 = K.project.lines[0].units;
        ok('furiKeepsExistingReading', show(K.project.lines[0]) === '死刑{しけい}|判決{はんけつ}' && r1.added === 1 && r1.kept === 1 && u1[0].m && u1[0].m.join() === '20.3,20.6' && u1[0].s === 20 && u1[1].s === 21 && K.project.lines[0].end === 23, [show(K.project.lines[0]), r1, u1]);
        K.undo(); const r2 = F.run('all', true);
        ok('furiOverwriteReplaces', show(K.project.lines[0]) === '死刑{しきょう}|判決{はんけつ}' && r2.added === 2 && r2.kept === 0, [show(K.project.lines[0]), r2]);
        K.undo();
        // 选中的一行
        K.project.lines = [mk('受け入れ', [1, 2, 3, 4], 5), mk('お嬢さん', [6, 7, 8, 9], 10)]; K.commit('edit'); K.select(K.project.lines[1].id);
        const r3 = F.run('line', false);
        ok('furiSelectedLineOnly', show(K.project.lines[0]) === '受|け|入|れ' && show(K.project.lines[1]) === 'お|嬢{じょう}|さ|ん' && r3.total === 1, [show(K.project.lines[0]), show(K.project.lines[1])]);
        // 分词结果对不上原文时不动这一行
        F.tokenizer = { tokenize: () => [{ surface_form: 'xx', reading: 'ヤ' }] };
        ok('furiMismatchedTokensIgnored', F.plan('受け入れ') === null);
        F.tokenizer = null;
        // 应用内流程：没有分词器时先解释要下载什么（不联网、不加载脚本），取消后什么都不发生
        K.setProject(K.normalizeProject({ lines: [{ start: 1, end: 3, text: '受け入れ' }, { start: 4, end: 6, text: 'お嬢さん' }] })); K.select(K.project.lines[0].id); await frames(1);
        let pr = K.autoFurigana('line'); await frames(1);
        let fd = document.querySelector('dialog.furi');
        ok('furiAskDialogExplainsDownload', !!(fd && fd.open) && fd.querySelector('.callout') && /jsdelivr/i.test(fd.querySelector('.callout').textContent) && /18/.test(fd.querySelector('.callout').textContent) && fd.querySelector('input[value="line"]').checked, fd && fd.textContent.slice(0, 200));
        fd.querySelector('.dacts button').click(); await pr; await frames(1);
        ok('furiCancelDoesNotLoad', !document.querySelector('dialog') && !document.querySelector('script[src*="jsdelivr"]') && !window.kuromoji && F.tokenizer === null && !F.busy && !K.undoWhy());
        // 分词器已就绪：不再提示下载，点“添加注音”一步完成，提示里有数量和“请检查”
        F.tokenizer = stub; K.select(null); pr = K.autoFurigana('line'); await frames(1); fd = document.querySelector('dialog.furi');
        ok('furiReadyDialogNoDownloadNote', !!fd && !fd.querySelector('.callout') && fd.querySelector('input[value="line"]').disabled && fd.querySelector('input[value="all"]').checked);
        fd.querySelector('.dacts .pri').click(); await pr; await frames(2);
        ok('furiDialogAppliesAll', K.project.lines.map(show).join(' / ') === '受{う}|け|入{い}|れ / お|嬢{じょう}|さ|ん' && K.undoWhy() === 'furi', K.project.lines.map(show));
        ok('furiResultToastAsksToProofread', [...document.querySelectorAll('#toasts .toast')].some((t) => t.textContent.includes(K.t('furi.done', { n: 3, lines: 2 }))));
        F.tokenizer = null; }

      /* S5. ZIP 写入器 */
      { ok('crc32Known', K.crc32('123456789') === 0xCBF43926 && K.crc32('The quick brown fox jumps over the lazy dog') === 0x414FA339 && K.crc32('') === 0 && K.crc32(new Uint8Array([0, 0, 0, 0])) === 0x2144DF1C, K.crc32('123456789').toString(16));
        ok('crc32Chunked', K.crc32('456789', K.crc32('123')) === 0xCBF43926);
        const parseZip = async (blob) => {
          const buf = new Uint8Array(await blob.arrayBuffer()), dv = new DataView(buf.buffer), e = buf.length - 22, res = { ok: true, entries: [], err: null }, dec = new TextDecoder();
          if (dv.getUint32(e, true) !== 0x06054b50) return { ok: false, err: 'no EOCD' };
          const n = dv.getUint16(e + 10, true), cdSize = dv.getUint32(e + 12, true), cdOff = dv.getUint32(e + 16, true); let p = cdOff;
          if (dv.getUint16(e + 8, true) !== n || cdOff + cdSize !== e) return { ok: false, err: 'bad EOCD' };
          for (let i = 0; i < n; i++) {
            if (dv.getUint32(p, true) !== 0x02014b50) return { ok: false, err: 'bad central record ' + i };
            const crc = dv.getUint32(p + 16, true), cs = dv.getUint32(p + 20, true), us = dv.getUint32(p + 24, true), nl = dv.getUint16(p + 28, true), lo = dv.getUint32(p + 42, true), method = dv.getUint16(p + 10, true);
            const name = dec.decode(buf.subarray(p + 46, p + 46 + nl));
            if (dv.getUint32(lo, true) !== 0x04034b50) return { ok: false, err: 'bad local header ' + name };
            const lnl = dv.getUint16(lo + 26, true), lxl = dv.getUint16(lo + 28, true), data = buf.subarray(lo + 30 + lnl + lxl, lo + 30 + lnl + lxl + us);
            res.entries.push({ name, crc, size: us, stored: method === 0 && cs === us, crcOk: K.crc32(data) === crc && dv.getUint32(lo + 14, true) === crc, nameOk: dec.decode(buf.subarray(lo + 30, lo + 30 + lnl)) === name, data });
            p += 46 + nl + dv.getUint16(p + 30, true) + dv.getUint16(p + 32, true);
          }
          res.consumed = p === e; return res;
        };
        const zw = new K.ZipWriter(); await zw.add('a.txt', 'hello'); await zw.add('dir/b.bin', new Uint8Array([0, 1, 2, 255])); await zw.add('é.txt', new Blob(['blob data é']));
        const Z = await parseZip(zw.finish()), dec = new TextDecoder();
        out.zip3 = Z.entries && Z.entries.map((x) => [x.name, x.size, x.crc.toString(16)]);
        ok('zipCentralDirectory', Z.ok && Z.consumed && Z.entries.length === 3 && Z.entries.map((x) => x.name).join() === 'a.txt,dir/b.bin,é.txt', Z);
        ok('zipSizesCrcsAndData', Z.entries.every((x) => x.stored && x.crcOk && x.nameOk) && Z.entries[0].size === 5 && dec.decode(Z.entries[0].data) === 'hello' && Z.entries[1].data.join() === '0,1,2,255' && dec.decode(Z.entries[2].data) === 'blob data é' && Z.entries[0].crc === K.crc32('hello'), out.zip3);
        // 分卷
        const saved = [], sink = K.zipSink({ total: 5, per: 2, base: 't', save: (b, nm) => saved.push([nm, b]) });
        for (let i = 0; i < 5; i++) await sink.put('f' + i + '.png', new Blob([new Uint8Array(10 + i)]));
        await sink.end(); const parts = await Promise.all(saved.map((x) => parseZip(x[1])));
        ok('zipSplitsIntoParts', saved.map((x) => x[0]).join() === 't_part01.zip,t_part02.zip,t_part03.zip' && sink.files() === 3 && parts.map((p) => p.entries.length).join() === '2,2,1' && parts.every((p) => p.ok && p.entries.every((x) => x.crcOk)), saved.map((x) => x[0]));
        ok('zipFrameNumbersContinueAcrossParts', parts.flatMap((p) => p.entries.map((x) => x.name)).join() === 'f0.png,f1.png,f2.png,f3.png,f4.png');
        const one = [], s1 = K.zipSink({ total: 3, per: 2000, base: 'one', save: (b, nm) => one.push(nm) }); await s1.put('x', new Blob(['x'])); await s1.end(); ok('zipSingleNoSuffix', one.join() === 'one.zip');
        // 重复使用同一个 Blob（空白帧）：CRC 只算一次、内容各自完整
        const bl = new Blob([new Uint8Array(1000).fill(7)]), zb = new K.ZipWriter(); await zb.add('1', bl); await zb.add('2', bl); const ZB = await parseZip(zb.finish());
        ok('zipReusedBlankBlob', ZB.ok && ZB.entries.length === 2 && ZB.entries[0].crc === ZB.entries[1].crc && ZB.entries.every((x) => x.crcOk && x.size === 1000));
        /* 端到端：点“下载为 ZIP…”，得到合法的 ZIP，里面是真正的 PNG */
        K.setProject(K.normalizeProject(K.SAMPLES[0].project)); await K.ensureFont(); K.S().fps = 24; document.getElementById('s_fps').value = '24';
        document.getElementById('eStart').value = '28'; document.getElementById('eEnd').value = '28.2'; document.getElementById('eEnd').dispatchEvent(new Event('input', { bubbles: true }));
        const g2 = document.createElement('canvas'); g2.width = K.S().W; g2.height = K.S().H; const est = await K.estimateSequence(g2.getContext('2d'), 'none', 28, 5, 24);
        ok('zipEstimate', est.drew && est.sample > 1000 && est.lyric >= 1 && est.lyric <= 5 && est.bytes >= est.sample && K.countLyricFrames(0, 10, 24) === 0, est);
        const od = K.download, dl = []; K.download = (b, nm) => dl.push([nm, b]);
        const zb2 = document.getElementById('bZip'); ok('zipButtonPresent', !!zb2 && !zb2.hidden && !!document.getElementById('bPng'));
        // 估计太大时先在应用内问一声；取消就什么都不下载
        const w0 = K.ZIP_WARN; K.ZIP_WARN = 1; zb2.click(); await until(() => document.querySelector('dialog.small'), 100);
        const bd = document.querySelector('dialog.small'); ok('zipBigWarning', !!bd && bd.textContent.includes(K.t('zip.bigTitle')) && /MB|GB/.test(bd.textContent), bd && bd.textContent);
        bd.querySelector('.dacts button').click(); await frames(3); ok('zipBigCancelDownloadsNothing', !dl.length && !document.getElementById('bZip').disabled); K.ZIP_WARN = w0;
        zb2.click(); await untilReal(() => dl.length && !zb2.disabled);
        const ZE = dl.length ? await parseZip(dl[0][1]) : null; K.download = od;
        out.zipE2E = ZE && { name: dl[0][0], n: ZE.entries.length, first: ZE.entries[0].name, bytes: ZE.entries.map((x) => x.size) };
        ok('zipExportFileName', dl.length === 1 && dl[0][0] === 'lyrics_png.zip', dl.map((x) => x[0]));
        ok('zipExportContents', ZE && ZE.ok && ZE.entries.length === 5 && ZE.entries.map((x) => x.name).join() === 'lyrics_000001.png,lyrics_000002.png,lyrics_000003.png,lyrics_000004.png,lyrics_000005.png' && ZE.entries.every((x) => x.crcOk && x.stored && x.data[0] === 0x89 && x.data[1] === 0x50 && x.data[2] === 0x4e && x.data[3] === 0x47), out.zipE2E);
        ok('zipExportMessage', document.getElementById('expMsg').textContent === K.t('exp.doneZip', { n: 5, w: K.S().W, h: K.S().H, fps: 24, t0: 28, z: 1 }), document.getElementById('expMsg').textContent);
        /* 画面指纹：空白是 ''；正在擦的两帧不同；同一时刻相同 */
        { const W = K.S().W, H = K.S().H; ok('frameKey', K.frameKey(0, W, H) === '' && K.frameKey(28, W, H) !== '' && K.frameKey(28, W, H) === K.frameKey(28, W, H) && K.frameKey(28, W, H) !== K.frameKey(28.1, W, H), K.frameKey(28, W, H)); }
        /* PNG 编码线程池：Worker 里编出来的是真正的 PNG，尺寸对 */
        { const pool = await real(K.pngPool(2)); out.pngPool = !!pool;
          if (pool) { K.render(g2.getContext('2d'), 28, { bg: 'none' }); const b = await real(createImageBitmap(g2).then((x) => pool.encode(x))), bm = await real(createImageBitmap(b)), h = new Uint8Array(await real(b.slice(0, 4).arrayBuffer()));
            ok('pngPoolEncodes', b.type === 'image/png' && h.join() === '137,80,78,71' && bm.width === g2.width && bm.height === g2.height && b.size > 1000, [b.type, b.size]); pool.close(); } }
        /* 端到端：点“导出视频 (MP4)…”，得到结构完整的 MP4（ftyp + mdat + moov，帧数对） */
        { const W = K.S().W + (K.S().W & 1), H = K.S().H + (K.S().H & 1), cfg = await real(K.videoConfig(W, H, 24)), vb = document.getElementById('bMp4'), msg = document.getElementById('expMsg'); out.mp4Cfg = cfg && cfg.codec;
          ok('mp4ButtonPresent', !!vb && !vb.hidden);
          if (cfg) { const dv = []; K.download = (b, nm) => dv.push([nm, b]); msg.textContent = ''; vb.click(); await untilReal(() => dv.length && !vb.disabled); K.download = od;
            const u = dv.length ? new Uint8Array(await real(dv[0][1].arrayBuffer())) : new Uint8Array(0), d = new DataView(u.buffer), tag = (o) => String.fromCharCode(u[o + 4], u[o + 5], u[o + 6], u[o + 7]), top = [];
            for (let o = 0; o + 8 <= u.length;) { const s = d.getUint32(o) === 1 ? d.getUint32(o + 8) * 4294967296 + d.getUint32(o + 12) : d.getUint32(o); top.push(tag(o)); if (s < 8) break; o += s; if (o === u.length) top.push('END'); }
            const find = (t) => { for (let i = 0; i + 4 <= u.length; i++) if (u[i] === t.charCodeAt(0) && u[i + 1] === t.charCodeAt(1) && u[i + 2] === t.charCodeAt(2) && u[i + 3] === t.charCodeAt(3)) return i; return -1; }, sz = find('stsz');
            out.mp4 = { name: dv[0] && dv[0][0], bytes: u.length, top, frames: sz > 0 ? d.getUint32(sz + 12) : -1, msg: msg.textContent };
            ok('mp4Export', dv.length === 1 && dv[0][0] === 'lyrics.mp4' && top.join() === 'ftyp,mdat,moov,END' && out.mp4.frames === 5 && find('avcC') > 0 && find('co64') > 0, out.mp4);
            ok('mp4ExportMessage', msg.textContent === K.t('exp.doneMp4', { n: 5, w: W, h: H, fps: 24, t0: 28, size: K.fmtBytes(u.length) }), msg.textContent);
            /* 导出提示跟着界面语言走 */
            const zhMsg = msg.textContent; K.setLang('en'); await frames(1); const enMsg = msg.textContent; K.setLang('zh-CN'); await frames(1);
            ok('exportMessageFollowsLanguage', enMsg !== zhMsg && enMsg === K.I18N.en['exp.doneMp4'].replace(/\{(\w+)\}/g, (m, k) => ({ n: 5, w: W, h: H, fps: 24, t0: 28, size: K.fmtBytes(u.length) })[k]) && msg.textContent === zhMsg, [zhMsg, enMsg]); } } }
      K.setProject(K.normalizeProject(K.SAMPLES[0].project)); K.dirty = false;
    }

    // ---- T. 字母按音节定时：分组 / 边界 / 按比例重排 / 硬推最小间隔 / 修复 / 手动音节 / 日语不变 ----
    { const mkL = (txt, s, e) => { const l = K.newLine({ units: K.parseText(txt), end: e }); K.evenSplit(l, s, e); K.fixLine(l); return l; };
      const syl = (l) => K.groups(l).map((g) => (g.w ? K.gText(l, g) + (g.e > g.c ? '[' + l.units.slice(g.c, g.e).map((u) => u.t).join('') + ']' : '') : '<' + l.units[g.i].t + '>')).join('|');
      const P = (txt) => syl(mkL(txt, 0, 10));
      const starts = (l) => K.groups(l).map((g) => l.units[g.i].s);
      const sound = (u) => /[^\s\p{P}]/u.test(u.t);
      /* 同一个词里有发音的字母时间互不相同（词的区间够用时）、整行单调 */
      const tidy = (l) => { const bad = []; let p = -1;
        l.units.forEach((u, i) => { if (u.s < p - 1e-9) bad.push(['mono', i]); p = u.s; });
        const G = K.groups(l); for (let a = 0; a < G.length; a++) { if (!G[a].w || !G[a].f) continue; let z = a + 1; while (z < G.length && G[z].w && !G[z].f) z++;
          const ts = []; for (let y = G[a].i; y < G[z - 1].c; y++) if (sound(l.units[y])) ts.push(l.units[y].s);
          const N = z < G.length ? l.units[G[z].i].s : l.end;
          if (N - ts[0] > 0.002 * ts.length && new Set(ts).size !== ts.length) bad.push(['tie', K.gText(l, G[a]), ts]); }
        return bad; };
      out.syl = {};
      const cases = { "L'eau s'élève, ô reine!": "L'eau[ ]|s'é|lè|ve[, ]|ô[ ]|rei|ne[!]", fontaine: 'fon|tai|ne', Hydro: 'Hy|dro', karaoke: 'ka|rao|ke', strength: 'strength', rhythm: 'rhythm', 'королева': 'ко|ро|ле|ва',
        '愛してるbaby': '<愛>|<し>|<て>|<る>|ba|by', "jusqu'à": "jus|qu'à", 'Louez-la !': 'Louez-|la[ !]', royale: 'ro|ya|le', 'MP3 2026年': 'MP3[ ]|2026|<年>' };
      Object.keys(cases).forEach((w) => { out.syl[w] = P(w); ok('sylPartition:' + w, out.syl[w] === cases[w], [w, out.syl[w]]); });
      // 带注音的汉字 / 假名不变：一个字一组，按拍定时
      { const l = mkL('王道{おうどう}をGo', 0, 4), B = K.bounds(l);
        ok('sylRubyKanjiUntouched', syl(l) === '<王道>|<を>|Go' && B.length === 4 + 1 + 1 && B.slice(0, 4).every((b, j) => b.i === 0 && b.j === j), [syl(l), B]); }
      { const l = mkL("L'eau s'élève, ô reine!", 0, 5); ok('sylBoundsCount', K.bounds(l).length === 7 && K.bounds(l).every((b) => !b.j), K.bounds(l).length); }
      // ---- 舞台 / 时间线拖动：法语示例 ----
      K.setProject(K.normalizeProject(K.SAMPLES[1].project)); await K.ensureFont(); await wait(60);
      const fl = K.screen().ord[2], fid = fl.id; K.select(fid);
      out.frLine = { text: K.lineText(fl), syl: syl(fl) };
      ok('frBoundsPerSyllable', K.bounds(fl).length === K.groups(fl).length && K.bounds(fl).length < fl.units.length / 2, [K.bounds(fl).length, fl.units.length]);
      ok('frSampleTidyBefore', !tidy(fl).length, tidy(fl));
      /* 舞台：不推挤的拖动 —— 只有目标音节开头变，前一个音节和这个音节里的字母按比例跟着走 */
      { const B = K.bounds(fl), bi = 3, b = B[bi], t0 = K.boundTime(fl, B[bi - 1]), t1 = K.boundTime(fl, b), t2 = K.boundTime(fl, B[bi + 1]), T1 = K.r3(t1 + (t2 - t1) * 0.4);
        const G = K.groups(fl), gp = G[bi - 1], gc = G[bi], rel = (l, g, S, N) => l.units.slice(g.i + 1, g.e).map((u) => (u.s - S) / (N - S));
        const r0p = rel(fl, gp, t0, t1), r0c = rel(fl, gc, t1, t2), before = starts(fl);
        K.seek(T1 + K.S().offset); await wait(40);
        const I = K.screen().info.get(fid), Gm = K.geo(fl, I, cv.width, cv.height), rc = cv.getBoundingClientRect(), cx = (X) => rc.left + X * rc.width / cv.width, cy = rc.top + (Gm.y - K.S().size * 0.4) * rc.height / cv.height;
        ev(cv, 'pointerdown', cx(Gm.x0 + K.progressEdge(fl, Gm.L, T1) * Gm.s), cy); ev(cv, 'pointermove', cx(Gm.x0 + Gm.L.units[b.i].x * Gm.s + 1), cy); ev(cv, 'pointerup', cx(Gm.x0 + Gm.L.units[b.i].x * Gm.s + 1), cy);
        const L1 = K.line(fid), after = starts(L1), r1p = rel(L1, gp, t0, T1), r1c = rel(L1, gc, T1, t2);
        out.stageSyl = { syl: K.gText(fl, gc), t1, T1, before: before.slice(bi - 1, bi + 2), after: after.slice(bi - 1, bi + 2) };
        ok('stageSylRetime', near(after[bi], T1) && after.every((v, i) => i === bi || near(v, before[i])) && K.undoWhy() === 'retime', out.stageSyl);
        ok('stageSylProportional', r0p.length && r0c.length && r0p.every((v, i) => near(v, r1p[i], 0.03)) && r0c.every((v, i) => near(v, r1c[i], 0.03)), [r0p, r1p, r0c, r1c]);
        ok('stageSylTidy', !tidy(L1).length, tidy(L1));
        /* 舞台：推挤 —— 把当前时间钉到后面两个音节之后的音节上，被越过的音节开头之间至少隔 30 ms */
        K.undo(); const L2 = K.line(fid), B2 = K.bounds(L2), T2 = K.r3(K.boundTime(L2, B2[bi + 3]) + 0.01), b0 = starts(L2);
        K.seek(T2 + K.S().offset); await wait(40);
        const G2 = K.geo(L2, K.screen().info.get(fid), cv.width, cv.height), xb = cx(G2.x0 + G2.L.units[B2[bi].i].x * G2.s + 1);
        ev(cv, 'pointerdown', cx(G2.x0 + K.progressEdge(L2, G2.L, T2) * G2.s), cy); ev(cv, 'pointermove', xb, cy);
        const tip = document.getElementById('tip').textContent; ev(cv, 'pointerup', xb, cy);
        const s2 = starts(K.line(fid)), gaps = s2.slice(1).map((v, i) => +(v - s2[i]).toFixed(3)), moved = s2.map((v, i) => (i !== bi && !near(v, b0[i]) ? i : -1)).filter((i) => i >= 0);
        out.stagePush = { T2, starts: s2.slice(bi, bi + 6), moved, tip };
        ok('stagePushMinGap', near(s2[bi], T2) && moved.length >= 3 && moved.every((i, k) => i === bi + 1 + k && near(s2[i] - s2[i - 1], 0.03, 1.5e-3)) && gaps.every((v) => v > 0), out.stagePush);
        ok('stagePushTooltip', tip.includes(K.t('tip.pushed', { n: moved.length })) && tip.includes('·'), tip);
        ok('stagePushTidy', !tidy(K.line(fid)).length, tidy(K.line(fid)));
        K.undo(); }
      /* 时间线：拖音节刻度（夹在左右两个音节之间，不推挤），提示里有音节和整个词 */
      { K.tl.pps = 800; const L = K.line(fid), B = K.bounds(L), bi = 2, tb = K.boundTime(L, B[bi]); K.tl.scroll = tb + K.S().offset - 0.5; K.seek(tb + K.S().offset + 0.3); await wait(60);
        const r = tlc.getBoundingClientRect(), TX = (t) => r.left + K.tl.gut + (t + K.S().offset - K.tl.scroll) * 800, y = r.top + 22 + K.screen().info.get(fid).row * 46 + 36, before = starts(L);
        ev(tlc, 'pointerdown', TX(tb), y); ev(tlc, 'pointermove', TX(tb) + 8, y);
        const tip = document.getElementById('tip').textContent; ev(tlc, 'pointerup', TX(tb) + 8, y);
        const after = starts(K.line(fid));
        out.tlSyl = { tb, now: after[bi], tip };
        ok('tlSylTick', near(after[bi] - tb, 0.01, 1.5e-3) && after.every((v, i) => i === bi || near(v, before[i])) && K.undoWhy() === 'timing', out.tlSyl);
        ok('tlSylTip', tip.includes(K.gText(L, K.groups(L)[bi])) && tip.includes('·'), tip);
        ok('tlSylTidy', !tidy(K.line(fid)).length, tidy(K.line(fid)));
        // 右键刻度：音节菜单在最前面
        tlc.dispatchEvent(new MouseEvent('contextmenu', { clientX: TX(after[bi]), clientY: y, bubbles: true, cancelable: true }));
        const mb = [...document.querySelectorAll('#menu button')].map((b) => b.textContent);
        ok('tlTickMenuHasSyllable', !document.getElementById('menu').hidden && mb[0] === K.t('menu.sylSplit') && mb.includes(K.t('menu.sylMerge')) && mb.includes(K.t('menu.evenSyl')) && mb.includes(K.t('menu.evenSylAll')), mb);
        document.getElementById('menu').hidden = true; K.undo(); K.tl.pps = 80; }
      /* 打点 T：一次一个音节（空格、标点自动带过） */
      { const L = K.line(fid), B = K.bounds(L), t0 = K.ls(L); K.select(fid); K.ui.tapIdx = 0;
        K.ops.tap(K.r3(t0 + 0.01)); K.ops.tap(K.r3(t0 + 0.2)); K.ops.tap(K.r3(t0 + 0.35));
        const L2 = K.line(fid), s2 = starts(L2);
        out.tapSyl = { idx: K.ui.tapIdx, s: s2.slice(0, 4), syl: K.groups(L2).slice(0, 3).map((g) => K.gText(L2, g)) };
        ok('tapPerSyllable', K.ui.tapIdx === 3 && near(s2[0], t0 + 0.01) && near(s2[1], t0 + 0.2) && near(s2[2], t0 + 0.35) && B.length === K.bounds(L2).length, out.tapSyl);
        ok('tapSylTidy', !tidy(L2).length, tidy(L2));
        K.undo(); K.undo(); K.undo(); }
      /* 行面板：一个音节一行，字段是整个音节；右键音节行 → 拆分 → 选字母，一步撤销 */
      { K.showTab('line'); await wait(60); const L = K.line(fid), rows = [...document.querySelectorAll('#tab-line tbody tr')], G = K.groups(L);
        ok('lineTabRowPerSyllable', rows.length === G.length && rows.every((tr, i) => tr.cells[0].textContent.replace('·', '') === K.gText(L, G[i])), rows.map((r) => r.cells[0].textContent));
        const gi = G.findIndex((g) => g.c - g.i >= 3), tr = rows[gi];
        tr.dispatchEvent(new MouseEvent('contextmenu', { clientX: 300, clientY: 300, bubbles: true, cancelable: true }));
        let mb = [...document.querySelectorAll('#menu button')]; ok('lineTabSylMenu', mb[0] && mb[0].textContent === K.t('menu.sylSplit'), mb.map((b) => b.textContent));
        mb[0].click(); mb = [...document.querySelectorAll('#menu button')];
        const want = K.gText(L, G[gi]).slice(0, 1) + ' | ' + K.gText(L, G[gi]).slice(1);
        ok('lineTabSylSplitChoices', !document.getElementById('menu').hidden && mb.length === G[gi].c - G[gi].i - 1 && mb[0].textContent === want, mb.map((b) => b.textContent));
        mb[0].click(); await wait(40);
        const L2 = K.line(fid);
        ok('sylSplitCommits', K.groups(L2).length === G.length + 1 && K.undoWhy() === 'syl' && L2.units[G[gi].i + 1].k === 1 && K.unitsToText(L2.units).includes(want.replace(' | ', '|')), [K.undoWhy(), syl(L2)]);
        K.undo(); ok('sylSplitUndo', K.groups(K.line(fid)).length === G.length && !K.line(fid).units.some((u) => u.k != null)); }
      /* 手动音节：拆分 / 合并 / 恢复自动；工程读写往返；文本里的 | ；retext 保留没改动的字的 k=0；fixLine 清掉无意义的 k */
      { K.setProject(K.blank()); const l = mkL('fontaine reine', 10, 12); K.project.lines = [l]; K.commit('edit');
        K.ops.syl(l, 5, 1); ok('sylManualSplit', syl(K.project.lines[0]) === 'fon|ta|i|ne[ ]|rei|ne' && K.undoWhy() === 'syl', syl(K.project.lines[0]));
        K.ops.syl(K.project.lines[0], 6, 0); ok('sylManualMerge', syl(K.project.lines[0]) === 'fon|ta|ine[ ]|rei|ne', syl(K.project.lines[0]));
        K.ops.syl(K.project.lines[0], 3, 0); ok('sylMergeAuto', syl(K.project.lines[0]) === 'fonta|ine[ ]|rei|ne' && K.project.lines[0].units[3].k === 0, syl(K.project.lines[0]));
        const rt = K.normalizeProject(JSON.parse(JSON.stringify(K.project)));
        ok('sylProjectRoundTrip', JSON.stringify(rt.lines) === JSON.stringify(K.project.lines) && syl(rt.lines[0]) === 'fonta|ine[ ]|rei|ne', syl(rt.lines[0]));
        ok('sylTextSyntax', K.unitsToText(K.project.lines[0].units) === 'fonta|ine reine', K.unitsToText(K.project.lines[0].units));
        K.retext(K.project.lines[0], 'fonta|ine reines'); K.commit('text');
        ok('sylRetextKeepsK0', syl(K.project.lines[0]) === 'fonta|ine[ ]|rei|nes' && K.project.lines[0].units[3].k === 0, syl(K.project.lines[0]));
        K.retext(K.project.lines[0], 'fontaine reines'); ok('sylRetextTextWinsForSplit', syl(K.project.lines[0]) === 'fontaine[ ]|rei|nes' && !K.project.lines[0].units.some((u) => u.k === 1), syl(K.project.lines[0]));
        K.undo(); K.undo(); K.undo(); K.undo();
        ok('sylUndoSteps', syl(K.project.lines[0]) === 'fon|tai|ne[ ]|rei|ne' && !K.project.lines[0].units.some((u) => u.k != null), syl(K.project.lines[0]));
        K.ops.syl(K.project.lines[0], 5, 1); K.ops.sylReset(K.project.lines[0]);
        ok('sylReset', syl(K.project.lines[0]) === 'fon|tai|ne[ ]|rei|ne' && K.undoWhy() === 'syl' && !K.project.lines[0].units.some((u) => 'k' in u));
        ok('sylPipeParse', K.parseText('Fonta|ine')[5].k === 1 && K.parseText('a | b').map((u) => u.t).join('') === 'a | b' && K.parseText('星|ほし').length === 4);
        const bad = K.newLine({ units: [{ t: 'a', r: null, s: 0, k: 1 }, { t: 'b', r: null, s: 1, k: 7 }, { t: 'い', r: null, s: 2, k: 1 }, { t: 'c', r: null, s: 3, k: 0 }], end: 4 }); K.fixLine(bad);
        ok('sylFixLineSanitises', bad.units.map((u) => u.k).join() === ',,,', bad.units.map((u) => u.k));
        const np = K.normalizeProject({ lines: [{ units: [{ t: 'a', s: 0 }, { t: 'b', s: 1, k: true }, { t: 'c', s: 2, k: '<x>' }], end: 3 }] });
        ok('sylNormalizeK', np.lines[0].units[1].k === 1 && !('k' in np.lines[0].units[2]), np.lines[0].units);
        // 拆分 / 合并 / 复制为和声行都带着 k
        const l2 = mkL('ab cd', 1, 3); l2.units[1].k = 1; l2.units[4].k = 1; K.fixLine(l2); K.project.lines = [l2]; K.commit('edit');
        const dupl = K.ops.dup(l2); ok('sylDupKeepsK', dupl.units[1].k === 1 && dupl.units[4].k === 1);
        K.undo(); const nl = K.ops.split(K.project.lines[0], K.project.lines[0].units[3].s - 0.001);
        ok('sylSplitLineKeepsK', nl && K.lineText(nl) === 'cd' && nl.units[1].k === 1 && K.project.lines.find((x) => x !== nl).units[1].k === 1, nl && syl(nl));
        K.ops.merge(K.project.lines.find((x) => x !== nl)); ok('sylMergeLineKeepsK', syl(K.project.lines[0]) === 'a|b[ ]|c|d', syl(K.project.lines[0])); }
      /* 硬推：最小间隔 / 空间不够时平均挤 / 完全没空间才重合；日语也一样 */
      { const l = mkL('fontaine reine', 10, 12), G = K.groups(l);
        K.setBoundary(l, G[3].i, 0, 10.2); const s1 = starts(l);
        ok('pushMinGap', s1[0] === 10 && near(s1[1], 10.14) && near(s1[2], 10.17) && s1[3] === 10.2 && !tidy(l).length, s1);
        const l2 = mkL('fontaine reine', 10, 12); K.setBoundary(l2, G[3].i, 0, 10.05); const s2 = starts(l2);
        ok('pushSqueeze', s2[0] === 10 && near(s2[1], 10.017, 1.5e-3) && near(s2[2], 10.033, 1.5e-3) && s2[3] === 10.05 && new Set(l2.units.slice(0, 8).map((u) => u.s)).size === 8, [s2, l2.units.map((u) => u.s)]);
        const l3 = mkL('fontaine reine', 10, 12); K.setBoundary(l3, G[1].i, 0, 11.7); const s3 = starts(l3);
        ok('pushRightMinGap', near(s3[2], 11.73) && near(s3[3], 11.76) && near(s3[4], 11.79) && l3.end === 12 && !tidy(l3).length, [s3, l3.end]);
        const l3b = mkL('fontaine reine', 10, 12); K.setBoundary(l3b, G[1].i, 0, 11.9); const s3b = starts(l3b);
        ok('pushRightSqueeze', s3b[1] === 11.9 && s3b.every((v, i) => !i || v > s3b[i - 1]) && s3b[4] <= l3b.end - 0.05 + 1e-9 && l3b.end === 12, [s3b, l3b.end]);
        const l4 = mkL('fontaine', 10, 12); K.setEnd(l4, 11); ok('setEndRescales', l4.end === 11 && l4.units.every((u) => u.s < 11) && !tidy(l4).length, l4.units.map((u) => u.s));
        const J = mkL('あいうえお', 10, 15); K.setBoundary(J, 4, 0, 10.5); const sj = J.units.map((u) => u.s);
        ok('pushMinGapCJK', sj.join() === '10,10.41,10.44,10.47,10.5', sj); }
      /* 修复：故意把字母、音节开头挤在一起，再“音节内字母均分”（一步撤销） */
      { K.setProject(K.blank()); const l = mkL('fontaine reine', 10, 12), S0 = starts(l);
        for (let i = 1; i < 8; i++) l.units[i].s = 10.6; l.units[8].s = 10.6; K.fixLine(l);            // fon 的 o、n 挤在 10.6，后面的 tai、ne 也挤在 10.6
        const l2 = mkL('Hydro rhythm', 20, 22); l2.units.forEach((u, i) => { if (i > 0 && i < 6) u.s = 20; }); K.fixLine(l2);
        K.project.lines = [l, l2]; K.commit('edit'); const snapB = JSON.stringify(K.project);
        ok('evenSylBrokenBefore', tidy(l).length > 0 && tidy(l2).length > 0);
        K.select(l.id); K.ops.evenSyl(K.project.lines[0]);
        const a = K.project.lines[0], sa = starts(a);
        out.evenSyl = { syl: syl(a), s: a.units.map((u) => u.s) };
        ok('evenSylRepairs', !tidy(a).length && sa[0] === 10 && sa[3] === S0[3] && sa[4] === S0[4] && sa[1] > sa[0] && sa[2] > sa[1] && sa[2] < sa[3], out.evenSyl);
        ok('evenSylLettersEven', near(a.units[1].s - a.units[0].s, a.units[2].s - a.units[1].s, 1.5e-3), a.units.slice(0, 3).map((u) => u.s));
        ok('evenSylOneUndo', K.undoWhy() === 'evenSyl' && (K.undo(), JSON.stringify(K.project) === snapB));
        K.ops.evenSylAll(); ok('evenSylAllLines', K.project.lines.every((x) => !tidy(x).length) && K.undoWhy() === 'evenSyl' && (K.undo(), JSON.stringify(K.project) === snapB));
        const n0 = K.undoWhy(); K.ops.evenSyl(mkL('あいう', 0, 3)); ok('evenSylNoopNoCommit', K.undoWhy() === n0);
        // 读工程文件不偷偷改时间
        const pj = K.normalizeProject(JSON.parse(snapB)); ok('noRewriteOnLoad', JSON.stringify(pj.lines) === JSON.stringify(JSON.parse(snapB).lines)); }
      /* 日语：没有字母的行，边界和以前完全一样；不推挤的拖动（含按拍）结果和旧算法逐字节相同 */
      { const oldSB = (l, i, j, T) => { const u = l.units[i], n = K.nMora(u);
          if (j > 0) { u.m = K.subTimes(l, i).slice(1, n); u.m[j - 1] = T; } else { if (u.m) u.m = K.subTimes(l, i).slice(1, n); u.s = T; }
          l.units.forEach((x, k) => { if (k < i) { if (x.s > T) x.s = T; if (x.m) x.m = x.m.map((v) => Math.min(v, T)); } else if (k > i) { if (x.s < T) x.s = T; if (x.m) x.m = x.m.map((v) => Math.max(v, T)); } else { if (j > 0 && x.s > T) x.s = T; if (x.m) x.m = x.m.map((v, q) => (q < j - 1 ? Math.min(v, T) : q > j - 1 ? Math.max(v, T) : v)); } });
          if (l.end < T + 0.05) l.end = T + 0.05; K.fixLine(l); };
        const jp = K.normalizeProject(K.SAMPLES[0].project).lines.filter((x) => !/[A-Za-zÀ-ɏЀ-ӿ0-9]/.test(K.lineText(x)));
        let bcount = 0, diffs = [], tried = 0;
        jp.forEach((l) => {
          const oldB = []; l.units.forEach((u, i) => { for (let j = 0; j < K.nMora(u); j++) oldB.push({ i, j }); });
          if (JSON.stringify(oldB) !== JSON.stringify(K.bounds(l))) bcount++;
          const B = K.bounds(l);
          B.forEach((b, x) => { const lo = x ? K.boundTime(l, B[x - 1]) : K.ls(l) - 0.3, hi = x + 1 < B.length ? K.boundTime(l, B[x + 1]) : l.end;
            if (hi - lo < 0.004) return;
            const T = K.r3(lo + (hi - lo) * 0.37), a = JSON.parse(JSON.stringify(l)), c = JSON.parse(JSON.stringify(l)); tried++;
            oldSB(a, b.i, b.j, T); K.setBoundary(c, b.i, b.j, T);
            if (JSON.stringify(a) !== JSON.stringify(c)) diffs.push([K.lineText(l), b, T]); }); });
        out.jpSame = { lines: jp.length, tried, diffs: diffs.slice(0, 3) };
        ok('jpBoundsUnchanged', jp.length > 30 && bcount === 0, { jp: jp.length, bcount });
        ok('jpNonPushDragIdentical', tried > 300 && !diffs.length, out.jpSame); }
      K.setProject(K.normalizeProject(K.SAMPLES[0].project)); K.dirty = false; }

    // ---- U. 行属性（局部样式 / 位置）与行内换行 ----
    { const mkP = (lines, st) => K.normalizeProject({ settings: Object.assign({ W: 1920, H: 1080, rows: 2 }, st), lines });
      const toC = (cx, cy) => { const r = cv.getBoundingClientRect(); return [r.left + cx * r.width / cv.width, r.top + cy * r.height / cv.height]; };
      const geoOf = (l) => K.geo(l, K.screen().info.get(l.id), cv.width, cv.height);
      const flat = (G) => JSON.stringify({ s: G.s, w: G.w, x0: G.x0, y: G.y, top: G.top, bottom: G.bottom, rows: G.rows, u: G.L.units, t: G.L.total });

      /* U1. 不回归：空的 o / 和全局相同的覆盖 / 没有换行 —— 几何与像素都和没有这个字段时完全一样；几何也和旧公式一致 */
      for (const si of [0, 1]) {
        K.setProject(K.normalizeProject(K.SAMPLES[si].project)); await K.ensureFont(); await wait(30);
        const S = K.S(), W = 1280, H = 720, c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d');
        const hash = () => { const d = g.getImageData(0, 0, W, H).data; let h = 2166136261; for (let i = 0; i < d.length; i += 3) h = Math.imul(h ^ d[i], 16777619); return h >>> 0; };
        const ts = K.screen().ord.filter((x, i) => i % 9 === 2).map((x) => (K.ls(x) + x.end) / 2 + S.offset).concat([K.ls(K.screen().ord[0]) - 1 + S.offset]);
        const snap = () => ({ geo: K.project.lines.map((l) => flat(K.geo(l, K.screen().info.get(l.id), W, H))), scr: JSON.stringify([...K.screen().info.values()]), px: ts.map((t) => (K.render(g, t, { bg: 'none' }), hash())) });
        const A = snap();
        /* 旧公式（改动前的 layout / geo）独立算一遍 */
        const mc = document.createElement('canvas').getContext('2d'), fb = K.fontBase(), fr = K.fontRuby();
        const oldGeo = (l, I) => { let x = 0; const us = l.units.map((u) => { mc.font = fb; const bw = mc.measureText(u.t).width + S.spacing * [...u.t].length; let rw = 0; if (u.r) { mc.font = fr; rw = mc.measureText(u.r).width + S.spacing * 0.5 * [...u.r].length; } const w = Math.max(bw, rw), o = { x, w }; x += w; return o; });
          const s = x ? Math.min(1, (S.maxW * W) / x) : 1, w = x * s, m = S.marginX * W; return { us, s, w, x0: I.align === 'left' ? m : I.align === 'right' ? W - m - w : (W - w) / 2, y: S.posY * H + I.row * K.rowStep() }; };
        const badOld = K.project.lines.filter((l) => { const I = K.screen().info.get(l.id), G = K.geo(l, I, W, H), o = oldGeo(l, I); return G.s !== o.s || G.w !== o.w || G.x0 !== o.x0 || G.y !== o.y || G.rows.length !== 1 || o.us.some((q, i) => q.x !== G.L.units[i].x || q.w !== G.L.units[i].w); });
        ok('noRegressGeoMatchesOldFormula:' + si, !badOld.length, badOld.map(K.lineText).slice(0, 3));
        K.project.lines.forEach((l) => (l.o = {})); K.touch(); const B = snap();
        ok('noRegressEmptyOverrides:' + si, JSON.stringify(A) === JSON.stringify(B), { a: A.px, b: B.px });
        const same = {}; K.LSTYLE.forEach((k) => (same[k] = S[k])); K.project.lines.forEach((l) => (l.o = Object.assign({}, same))); K.touch();
        ok('accessorMergedPath', K.LS(K.project.lines[0]) !== S && K.LS(K.project.lines[0]).size === S.size);
        const C = snap();
        ok('noRegressOverridesEqualToGlobal:' + si, JSON.stringify(A) === JSON.stringify(C), { a: A.px, c: C.px });
        ok('noRegressNoBreaks:' + si, K.project.lines.every((l) => !l.units.some((u) => 'n' in u) && K.nRows(l) === 1));
        K.project.lines.forEach((l) => delete l.o); K.touch();
      }

      /* U2. 工程文件里的行属性不可信：未知键 / 坏值丢掉，空了就没有 o，键顺序固定；读写往返不变 */
      { const X = '"><img src=x onerror="window.__pwn=3">';
        const raw = JSON.parse(JSON.stringify({ lines: [
          { start: 1, end: 3, text: 'ab', o: { evil: X, size: X, baseFill: '#GGG', highFill: '#ABCDEF', dx: 5, dy: '0.1', grow: 'sideways', W: 100, rows: 3, layout: 'stack', font: X, dotFill: '', dotsDur: 1e9, glow: -4, weight: 'heavy' } },
          { start: 4, end: 5, text: 'cd', o: [1, 2] }, { start: 6, end: 7, text: 'ef', o: { size: 'big', grow: 'auto', dx: 0 } }, { start: 8, end: 9, text: 'gh', o: 'nope' },
          { start: 10, end: 11, text: 'ij', o: { grow: 'center', dy: -0.2, size: 60 } }] }).replace('"evil":', '"__proto__":{"size":1},"evil":'));
        const p = K.normalizeProject(raw), o0 = p.lines[0].o;
        out.sanOv = p.lines.map((l) => l.o);
        ok('sanOvKeys', o0 && Object.keys(o0).join() === 'font,glow,highFill,dotsDur,dotFill,dx,dy', o0);
        ok('sanOvValues', o0.highFill === '#abcdef' && o0.dotsDur === K.RANGE.dotsDur[1] && o0.glow === 0 && o0.dotFill === '' && o0.dx === 1 && o0.dy === 0.1 && !/[<>]/.test(o0.font) && !('size' in o0) && !('W' in o0) && !('evil' in o0), o0);
        ok('sanOvEmptyRemoved', !('o' in p.lines[1]) && !('o' in p.lines[2]) && !('o' in p.lines[3]), p.lines.slice(1, 4).map((l) => l.o));
        ok('sanOvLineOnly', JSON.stringify(p.lines[4].o) === '{"size":60,"dy":-0.2,"grow":"center"}', p.lines[4].o);
        ok('sanOvNoProto', !({}).size && Object.getPrototypeOf(o0) === Object.prototype);
        const rt = K.normalizeProject(JSON.parse(JSON.stringify(p)));
        ok('ovRoundTrip', JSON.stringify(rt.lines) === JSON.stringify(p.lines));
        K.setProject(p); K.select(p.lines[0].id); K.pref('lsOpen', true); K.showTab('line'); await wait(60);
        ok('ovNoInjection', !document.querySelector('#tab-line img, #list img') && !window.__pwn && document.querySelector('#tab-line details.lso[open]'), document.querySelectorAll('img').length);
        ok('listMarksOverrides', document.querySelectorAll('#list .li .lso').length === 2 && document.querySelector(`#list .li[data-id="${p.lines[0].id}"] .lso`));
        K.pref('lsOpen', null); delete K.prefs.lsOpen; }

      /* U3. 有效设置：继承 / 覆盖 / 全局改了会跟着变；setOv 清空时删掉 o */
      { K.setProject(mkP([{ start: 1, end: 3, text: 'あいう' }, { start: 4, end: 6, text: 'あいう' }])); const [a, b] = K.project.lines, S = K.S();
        ok('lsNoOvIsGlobal', K.LS(a) === S && K.LS(b) === S);
        K.setOv(a, 'size', 120); K.setOv(a, 'baseFill', '#123456'); K.touch();
        const E = K.LS(a);
        ok('lsInherits', E.size === 120 && E.baseFill === '#123456' && E.font === S.font && E.strokeW === S.strokeW && E.dx === 0 && E.grow === 'auto' && K.LS(b) === S, E);
        S.strokeW = 3; K.touch(); ok('lsFollowsGlobal', K.LS(a).strokeW === 3 && K.LS(a).size === 120);
        ok('layoutUsesEffective', near(K.layout(a).units[0].w, K.layout(b).units[0].w * 120 / S.size, 0.6), [K.layout(a).units[0].w, K.layout(b).units[0].w]);
        K.setOv(a, 'size', null); K.setOv(a, 'baseFill', null); ok('setOvRemovesEmpty', !('o' in a) && K.LS(a) === S);
        K.setOv(a, 'dx', 0); ok('dxZeroIsNoOverride', !('o' in a));
        /* 每行自己的字体也要加载 */
        K.setOv(a, 'font', "'Georgia', serif"); K.commit('lineStyle');
        const seen = [], ol = document.fonts.load.bind(document.fonts); document.fonts.load = (f, s) => { seen.push(f); return ol(f, s); };
        await K.ensureFont(); document.fonts.load = ol;
        ok('ensureFontPerLine', seen.some((f) => /Georgia/.test(f)) && seen.some((f) => f === K.fontBase()), seen); }

      /* U4. 行面板：本行独立样式 —— 显示继承值、改了成为覆盖、单项恢复、复制 / 粘贴 / 本段 / 全部 / 全部恢复，各一步撤销 */
      { K.setProject(K.normalizeProject(K.SAMPLES[0].project)); await wait(30); const sc0 = K.screen(), l = sc0.ord[2], id = l.id; K.select(id); K.showTab('line'); await wait(60);
        const tab = document.getElementById('tab-line'), q = (s) => tab.querySelector(s);
        ok('lsoClosedWithoutOverrides', q('details.lso') && !q('details.lso').open);
        const num = q('input[data-o="size"][type="number"]');
        ok('lsoShowsInherited', num && +num.value === K.S().size && !num.closest('.row').classList.contains('ov'));
        const rg = q('input[data-o="size"][type="range"]'); rg.value = '100'; rg.dispatchEvent(new Event('input', { bubbles: true }));
        ok('lsoLivePreviewNoCommit', K.line(id).o && K.line(id).o.size === 100 && K.undoWhy() !== 'lineStyle');
        num.value = '130'; num.dispatchEvent(new Event('change', { bubbles: true })); await wait(40);
        ok('lsoEditCreatesOverride', K.line(id).o.size === 130 && K.undoWhy() === 'lineStyle' && q('input[data-o="size"]').closest('.row').classList.contains('ov') && q('details.lso').open, K.line(id).o);
        const fs = q('select[data-of]'); fs.value = 'Georgia'; fs.dispatchEvent(new Event('change', { bubbles: true })); await wait(40);
        ok('lsoFontPick', /^'Georgia', /.test(K.line(id).o.font), K.line(id).o.font);
        q('button[data-ovr="font"]').click(); await wait(40);
        ok('lsoFieldReset', !('font' in K.line(id).o) && K.line(id).o.size === 130 && K.undoWhy() === 'lineStyle');
        K.undo(); ok('lsoFieldResetUndo', /Georgia/.test(K.line(id).o.font)); K.redo(); await wait(40);
        q('input[data-o="dx"][type="number"]').value = '0.05'; q('input[data-o="dx"][type="number"]').dispatchEvent(new Event('change', { bubbles: true })); await wait(40);
        // 复制 → 粘贴到另一行：样式过去，位置不过去
        q('button[data-a="ovCopy"]').click(); await wait(30);
        const other = sc0.ord[5]; K.select(other.id); await wait(40); const before = JSON.stringify(K.project);
        tab.querySelector('button[data-a="ovPaste"]').click(); await wait(30);
        ok('lsoPaste', JSON.stringify(K.line(other.id).o) === '{"size":130}' && K.undoWhy() === 'lineStyle', K.line(other.id).o);
        K.undo(); ok('lsoPasteOneUndo', JSON.stringify(K.project) === before);
        // 应用到本段 / 全部：一步撤销；目标行原来的位置保留
        K.select(id); await wait(40); const pi = K.screen().info.get(id).pi, mates = K.screen().ord.filter((x) => x.id !== id && K.screen().info.get(x.id).pi === pi);
        K.setOv(mates[0], 'dy', -0.1); K.commit('linePos'); const b2 = JSON.stringify(K.project);
        tab.querySelector('button[data-a="ovPara"]').click(); await wait(30);
        ok('lsoApplyPara', mates.length > 0 && mates.every((x) => K.line(x.id).o && K.line(x.id).o.size === 130 && !('dx' in K.line(x.id).o)) && K.line(mates[0].id).o.dy === -0.1 && K.screen().ord.filter((x) => K.screen().info.get(x.id).pi !== pi).every((x) => !x.o), mates.length);
        ok('lsoApplyParaOneUndo', K.undoWhy() === 'lineStyle' && (K.undo(), JSON.stringify(K.project) === b2));
        tab.querySelector('button[data-a="ovAll"]').click(); await wait(30);
        ok('lsoApplyAll', K.project.lines.every((x) => x.o && x.o.size === 130) && K.undoWhy() === 'lineStyle');
        K.undo(); ok('lsoApplyAllOneUndo', JSON.stringify(K.project) === b2);
        tab.querySelector('button[data-a="ovReset"]').click(); await wait(30);
        ok('lsoResetAll', !('o' in K.line(id)) && K.undoWhy() === 'lineStyle'); K.undo(); await wait(40);
        ok('lsoMarkedInList', !!document.querySelector(`#list .li[data-id="${id}"] .lso`));
        // 折叠状态记在偏好里
        q('summary.lsoS').click(); await wait(30); ok('lsoCollapsePref', K.pref('lsOpen') === false);
        K.select(other.id); await wait(40); ok('lsoStaysCollapsed', !tab.querySelector('details.lso').open); delete K.prefs.lsOpen; }

      /* U4b. 预备点位置（全局 dotPos + 行覆盖）：top = 行首上方，left = 行首左边、和文字同高 */
      { K.setProject(K.normalizeProject(K.SAMPLES[0].project)); K.S().offset = 0; K.touch(); const sc1 = K.screen();
        const l = sc1.ord.find((x) => sc1.info.get(x.id).dotsDur === 3), I = sc1.info.get(l.id), t = K.ls(l) - 2.9;
        const cv = document.createElement('canvas'); cv.width = 1920; cv.height = 1080; const g = cv.getContext('2d', { willReadFrequently: true });
        const ink = (x0, y0, x1, y1) => { const d = g.getImageData(Math.max(0, x0), Math.max(0, y0), Math.max(1, x1 - Math.max(0, x0)), Math.max(1, y1 - y0)).data; let c = 0; for (let i = 3; i < d.length; i += 4) if (d[i] > 128) c++; return c; };
        const probe = () => { K.touch(); K.render(g, t, { bg: 'none' }); const G = K.geo(l, K.screen().info.get(l.id), 1920, 1080), R0 = G.rows[0], top = R0.y - G.top * G.s, E = K.LS(l);
          return { above: ink(Math.round(R0.x0), Math.round(top - E.size), Math.round(R0.x0 + E.size * 2), Math.round(top - 2)), left: ink(Math.round(R0.x0 - E.size * 2), Math.round(R0.y - E.size * 0.7), Math.round(R0.x0 - E.strokeW - 2), Math.round(R0.y)) }; };
        ok('dotPosDefault', K.DEF.dotPos === 'top' && K.S().dotPos === 'top' && K.cleanSetting('dotPos', 'left') === 'left' && K.cleanSetting('dotPos', 'bottom') === undefined && K.LSTYLE.includes('dotPos'));
        const pTop = probe(); K.S().dotPos = 'left'; const pLeft = probe();
        K.setOv(l, 'dotPos', 'top'); const pOvTop = probe(); K.S().dotPos = 'top'; K.setOv(l, 'dotPos', 'left'); const pOvLeft = probe();
        out.dotPos = { pTop, pLeft, pOvTop, pOvLeft, o: l.o };
        ok('dotPosTop', pTop.above > 50 && pTop.left === 0 && pOvTop.above > 50 && pOvTop.left === 0, out.dotPos);
        ok('dotPosLeft', pLeft.left > 50 && pLeft.above === 0 && pOvLeft.left > 50 && pOvLeft.above === 0, out.dotPos);
        ok('dotPosOverrideSaved', l.o && l.o.dotPos === 'left' && K.cleanOverrides({ dotPos: 'x' }) === null);
        K.select(l.id); await wait(60);
        ok('dotPosForms', !!document.querySelector('#tab-layout select[data-s="dotPos"]') && !!document.querySelector('#tab-line select[data-o="dotPos"]') && document.querySelector('#tab-line select[data-o="dotPos"]').value === 'left');
        K.setOv(l, 'dotPos', null); K.touch(); }

      /* U4c. 擦完的行：最后一个字右边的描边也是已唱色（裁剪边不能停在字的右边界上） */
      { K.setProject(K.normalizeProject({ settings: { size: 60, strokeW: 12, baseStroke: '#0000ff', highStroke: '#ff0000', baseFill: '#0000ff', highFill: '#ff0000', dots: false, hold: 3, offset: 0 }, lines: [{ start: 1, end: 2, text: 'one' }] })); K.touch();
        const l = K.project.lines[0], cv = document.createElement('canvas'); cv.width = 1920; cv.height = 1080; const g = cv.getContext('2d', { willReadFrequently: true });
        const blue = (t) => { K.render(g, t, { bg: 'none' }); const G = K.geo(l, K.screen().info.get(l.id), 1920, 1080), R0 = G.rows[0], x = Math.round(R0.x0 + R0.w) - 2;
          const d = g.getImageData(x, Math.round(R0.y - 70), 40, 90).data; let c = 0; for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 128 && d[i + 2] > 128 && d[i] < 128) c++; return c; };
        out.wipeEnd = { before: blue(0.9), after: blue(2.2) };
        ok('wipeCoversTrailingStroke', out.wipeEnd.before > 50 && out.wipeEnd.after === 0, out.wipeEnd); }

      /* U5. 预备点时长按行：screen 的出现时间 / 预备点时长跟着变；时间线拖动预备点起点、双击恢复自动 */
      { K.setProject(K.normalizeProject(K.SAMPLES[0].project)); K.S().offset = 0; K.touch(); const sc1 = K.screen();
        const l = sc1.ord.find((x, i) => { const I = sc1.info.get(x.id); return i > 0 && I.para && I.dotsDur === 3 && x.showAt == null && K.ls(x) - Math.max(...sc1.ord.slice(0, i).map((y) => sc1.info.get(y.id).hide + K.S().fadeOut)) > 5; }), id = l.id, I0 = sc1.info.get(id), s = K.ls(l);
        ok('dotsFoundLine', !!l);
        K.setOv(l, 'dotsDur', 4.5); K.touch(); let I1 = K.screen().info.get(id);
        out.dotsOv = { before: [I0.show, I0.dotsDur], after: [I1.show, I1.dotsDur] };
        ok('dotsOverrideScreen', I1.dotsDur === 4.5 && near(I1.show, s - 4.9, 1e-6) && I1.show < I0.show, out.dotsOv);
        ok('dotsOtherLinesGlobal', K.screen().ord.every((x) => x === l || !K.screen().info.get(x.id).dotsDur || K.screen().info.get(x.id).dotsDur <= 3));
        K.setOv(l, 'dotsDur', null); K.touch(); K.select(id);
        K.tl.pps = 80; K.tl.scroll = s - 8; await wait(60);
        const r = tlc.getBoundingClientRect(), TX = (t) => r.left + K.tl.gut + (t - K.tl.scroll) * 80, Ic = K.screen().info.get(id), y = r.top + 22 + Ic.row * 46 + 20, xd = TX(s - Ic.dotsDur);
        ev(tlc, 'pointermove', xd, y); const tipHover = document.getElementById('tip').textContent;
        ev(tlc, 'pointerdown', xd, y, { shiftKey: true }); ev(tlc, 'pointermove', xd - 80, y, { shiftKey: true });
        const tipDrag = document.getElementById('tip').textContent; ev(tlc, 'pointerup', xd - 80, y, { shiftKey: true });
        let L1 = K.line(id); I1 = K.screen().info.get(id);
        out.dotsDrag = { o: L1.o, dots: I1.dotsDur, show: I1.show, s, tipHover, tipDrag };
        ok('tlDotsDrag', L1.o && near(L1.o.dotsDur, 4, 0.02) && near(I1.dotsDur, L1.o.dotsDur, 1e-6) && I1.show <= s - I1.dotsDur - 0.05 + 1e-6 && K.undoWhy() === 'lineStyle', out.dotsDrag);
        ok('tlDotsTooltip', tipHover.includes(K.t('tip.dots', { d: K.fmt3(3), t: K.fmt3(s - 3) })) && tipDrag.includes(K.fmt3(L1.o.dotsDur)), [tipHover, tipDrag]);
        /* 拖得太远：被上一段挡住，存下来的值收到实际能显示的长度 */
        const xd2 = TX(s - I1.dotsDur); await wait(30);
        ev(tlc, 'pointerdown', xd2, y, { shiftKey: true }); ev(tlc, 'pointermove', xd2 - 2000, y, { shiftKey: true }); ev(tlc, 'pointerup', xd2 - 2000, y, { shiftKey: true });
        L1 = K.line(id); I1 = K.screen().info.get(id);
        ok('tlDotsClampedToWindow', L1.o.dotsDur < 25 && near(L1.o.dotsDur, I1.dotsDur, 1e-3) && I1.show >= K.screen().info.get(K.screen().ord[K.screen().ord.indexOf(L1) - 1].id).hide - 1e-6, [L1.o.dotsDur, I1.dotsDur, I1.show]);
        await wait(30); const xd3 = TX(s - I1.dotsDur);
        tlc.dispatchEvent(new MouseEvent('dblclick', { clientX: xd3, clientY: y, bubbles: true }));
        ok('tlDotsDblClickReset', !K.line(id).o && K.screen().info.get(id).dotsDur === 3 && K.undoWhy() === 'lineStyle', K.line(id).o); }

      /* U6. 文本 <-> 单元：换行 / \n 字面 / 往返；retext 保留时间；fixLine 清洗 */
      { const P = (s) => K.parseText(s), T2 = (s) => K.unitsToText(P(s));
        ok('brkParse', P('ab\ncd')[2].n === 1 && P('ab\ncd').length === 4 && !P('ab\ncd').slice(0, 2).some((u) => u.n), P('ab\ncd'));
        ok('brkLiteral', JSON.stringify(P('ab\\ncd')) === JSON.stringify(P('ab\ncd')) && T2('ab\\ncd') === 'ab\ncd');
        ok('brkRoundTrip', ['ab\ncd', '王道{おうどう}を\n征{ゆ}く', 'Fon|taine\nreine', 'a b\n c'].every((s) => T2(s) === s), ['ab\ncd', 'a b\n c'].map(T2));
        ok('brkCollapseEdges', T2('\n\nab\n\n\ncd\n') === 'ab\ncd' && T2('a\r\nb') === 'a\nb');
        const fx = (s) => { const l = K.newLine({ units: P(s), end: 9 }); l.units.forEach((u, i) => (u.s = i)); K.fixLine(l); return K.unitsToText(l.units); };
        ok('brkFixLineDropsEmptyRows', fx('a\n \nb') === 'a \nb' && fx('a\n ') === 'a ' && fx(' \na') === ' a', [fx('a\n \nb'), fx('a\n '), fx(' \na')]);
        const np = K.normalizeProject({ lines: [{ end: 3, units: [{ t: 'a', s: 0, n: 1 }, { t: 'b', s: 1, n: true }, { t: 'c', s: 2, n: '<x>' }] }, { start: 5, end: 8, text: 'xy\nzw' }] });
        ok('brkNormalize', np.lines[0].units.map((u) => u.n || 0).join() === '0,1,0' && K.unitsToText(np.lines[1].units) === 'xy\nzw', np.lines.map((l) => K.unitsToText(l.units)));
        // retext：插入 / 去掉换行，没改动的字时间不变
        K.setProject(mkP([{ start: 10, end: 16, text: 'あいうえおか' }])); const l = K.project.lines[0], s0 = l.units.map((u) => u.s);
        K.retext(l, 'あいう\nえおか'); ok('retextBreakKeepsTiming', l.units.map((u) => u.s).join() === s0.join() && l.units[3].n === 1);
        K.retext(l, 'あいう えおか'); ok('retextBreakToSpace', l.units.length === 7 && l.units[0].s === s0[0] && l.units[6].s === s0[5] && !l.units.some((u) => u.n));
        K.retext(l, 'あいうえおか'); K.retext(l, 'あい\\nうえおか'); ok('retextLiteralBreak', l.units.map((u) => u.s).join() === s0.join() && l.units[2].n === 1);
        K.retext(l, 'あいうえおか'); ok('retextBreakRemoved', l.units.map((u) => u.s).join() === s0.join() && !l.units.some((u) => u.n));
        // 行面板：Shift+Enter 插入换行，提交后成为行内换行
        K.commit('text'); K.select(l.id); K.showTab('line'); await wait(60);
        const ta = document.getElementById('lnText'); ta.focus(); ta.setSelectionRange(3, 3);
        ta.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', shiftKey: true, bubbles: true, cancelable: true }));
        out.shiftEnter = ta.value;
        ok('shiftEnterInsertsNewline', ta.value === 'あいう\nえおか' && ta.dataset.dirty === '1', ta.value);
        ta.dispatchEvent(new Event('change', { bubbles: true })); ta.blur(); await wait(40);
        ok('shiftEnterCommitsBreak', K.project.lines[0].units[3].n === 1 && K.project.lines[0].units.map((u) => u.s).join() === s0.join() && K.undoWhy() === 'text' && document.getElementById('lnText').value === 'あいう\nえおか' && document.getElementById('lnText').rows >= 3);
        ok('listShowsBreakMark', document.querySelector('#list .li .x').textContent.includes('⏎'));
        // 粘贴歌词：一行一句，行里的 \n 字面 = 行内换行
        const A = K.addLyrics('ab\\ncd\nef', { mode: 'replace', start: 0, dur: 2, gap: 4 });
        ok('pasteLiteralBreak', A.length === 2 && K.unitsToText(A[0].units) === 'ab\ncd' && K.unitsToText(A[1].units) === 'ef'); K.undo(); }

      /* U7. 音节：换行处一定分组；词中间的换行强制新音节；组从不跨过换行 */
      { const mk = (s) => { const l = K.newLine({ units: K.parseText(s), end: 10 }); K.evenSplit(l, 0, 10); K.fixLine(l); return l; };
        const gt = (l) => K.groups(l).map((g) => K.gText(l, g)).join('|');
        const a = mk('fontaine'), b = mk('fonta\naine'), c = mk('rock-\nroll here');
        out.brkSyl = [gt(a), gt(b), gt(c)];
        ok('brkForcesSyllable', gt(a) === 'fon|tai|ne' && gt(b) === 'fon|ta|ai|ne' && K.groups(b).find((g) => g.i === 5).f === 1, out.brkSyl);
        ok('brkGroupsNeverCross', [a, b, c, mk('a, \nb. c\nd')].every((l) => K.groups(l).every((g) => !l.units.slice(g.i + 1, g.e).some((u) => u.n))), out.brkSyl);
        ok('brkHyphenStaysBefore', gt(c) === 'rock|roll|he|re' && K.lineText(c).indexOf('-') === 4 && K.groups(c)[0].e === 5, [gt(c), K.groups(c)[0]]); }

      /* U8. 多排几何：2 排 / 3 排 × 对齐 × 生长方向 */
      { const txt = ['あいうえおかき\nくけ', 'あいうえ\nおかきくけこさし\nすせ'];
        const lines = []; let t = 1;
        ['left', 'center', 'right'].forEach((al) => ['up', 'down', 'center', 'auto'].forEach((gr) => txt.forEach((tx) => { lines.push({ start: t, end: t + 1, text: tx, align: al, row: 0, o: gr === 'auto' ? undefined : { grow: gr } }); t += 2; })));
        K.setProject(mkP(lines, { paraGap: 0.5 })); await wait(40);
        const S = K.S(), W = 1920, H = 1080, m = S.marginX * W, bad = [];
        K.project.lines.forEach((l) => {
          const I = K.screen().info.get(l.id), G = K.geo(l, I, W, H), R = G.rows, N = R.length, E = K.LS(l), st = K.wrapStep(E, G.L) * G.s, base = S.posY * H + I.row * K.rowStep(), gr = (l.o && l.o.grow) || 'auto', eff = K.grow(l, I);
          if (N !== K.nRows(l) || N < 2) bad.push(['rows', N]);
          if (gr === 'auto' && eff !== 'up') bad.push(['autoRow0Up', eff]);
          if (eff === 'up' && !near(R[N - 1].y, base)) bad.push(['up', R.map((r) => r.y)]);
          if (eff === 'down' && !near(R[0].y, base)) bad.push(['down', R.map((r) => r.y)]);
          if (eff === 'center' && !near((R[0].y + R[N - 1].y) / 2, base)) bad.push(['center', R.map((r) => r.y)]);
          R.forEach((r, k) => {
            if (k && !near(r.y - R[k - 1].y, st)) bad.push(['step', k]);
            if (I.align === 'left' && !near(r.x0, m)) bad.push(['left', k, r.x0]);
            if (I.align === 'right' && !near(r.x0 + r.w, W - m)) bad.push(['right', k]);
            if (I.align === 'center' && !near(r.x0 + r.w / 2, W / 2)) bad.push(['center', k]);
          });
          if (!near(Math.max(...R.map((r) => r.w)), G.L.total * G.s) || st < S.size * G.s) bad.push(['widest/step']);
          const B = K.blockBox(G); if (!near(B.top, R[0].y - G.top * G.s) || !near(B.bot, R[N - 1].y + G.bottom * G.s) || !near(B.x0, Math.min(...R.map((r) => r.x0)))) bad.push(['box']);
        });
        ok('multiRowGeometry', !bad.length && K.project.lines.length === 24, bad.slice(0, 4));
        // 自动方向：行位在上半部分往上长，其余往下；只有一个行位也往上
        const I0 = { row: 0 }, I1 = { row: 1 }, I2 = { row: 2 };
        const dirs = (rows) => { S.rows = rows; K.touch(); return [I0, I1, I2].map((I) => K.growAuto(I)).join(); };
        out.autoGrow = [dirs(1), dirs(2), dirs(3)];
        ok('autoGrowRule', out.autoGrow[0].startsWith('up') && out.autoGrow[1].startsWith('up,down') && out.autoGrow[2] === 'up,up,down', out.autoGrow);
        S.rows = 2; K.touch();
        // 最大宽度：按最宽的一排缩放整块；有注音的第二排行距更大
        const wide = K.normalizeProject({ lines: [{ start: 1, end: 2, text: 'あ'.repeat(40) + '\nい' }, { start: 3, end: 4, text: 'あい\n王道{おうどう}' }, { start: 5, end: 6, text: 'あい\nうえ' }] }).lines;
        K.project.lines = wide; K.touch();
        const Gw = geoOf(wide[0]), Gr = geoOf(wide[1]), Gn = geoOf(wide[2]);
        ok('fitByWidestRow', near(Gw.rows[0].w, S.maxW * cv.width, 0.5) && Gw.s < 1 && near(Gw.rows[1].w, Gw.L.rows[1].w * Gw.s), [Gw.rows[0].w, S.maxW * cv.width, Gw.s]);
        ok('wrapStepRuby', near(Gr.rows[1].y - Gr.rows[0].y, S.size * (1 + S.wrapGap) + S.size * S.rubyRatio + S.rubyGap) && near(Gn.rows[1].y - Gn.rows[0].y, S.size * (1 + S.wrapGap)), [Gr.rows[1].y - Gr.rows[0].y, Gn.rows[1].y - Gn.rows[0].y]);
        // 换行旁边的空白不占位置
        const sp = K.normalizeProject({ lines: [{ start: 1, end: 2, text: 'ab \n cd' }] }).lines[0]; K.project.lines = [sp]; K.touch(); const Ls = K.layout(sp);
        ok('brkEdgeSpaceZeroWidth', Ls.units[2].w === 0 && Ls.units[3].w === 0 && Ls.rows.length === 2 && near(Ls.rows[0].w, Ls.units[0].w + Ls.units[1].w), Ls.units.map((u) => u.w)); }

      /* U9. 擦除位置 ↔ 时间：跨排单调、互逆；光标画在正在唱的那一排；拖到第二排校对的字 */
      { K.setProject(mkP([{ start: 10, end: 20, text: 'あいうえお\nかきくけこ', align: 'center', row: 0 }])); await K.ensureFont(); const l = K.project.lines[0], id = l.id; K.select(id);
        K.seek(12.5); await wait(60);
        const G = geoOf(l), L = G.L; let mono = true, inv = 0, prev = -1;
        for (let t = 9.9; t <= 20.1; t += 0.05) { const X = K.progressEdge(l, L, t); if (X < prev - 1e-9) mono = false; prev = X; if (t > 10 && t < 20) inv = Math.max(inv, Math.abs(K.edgeToTime(l, L, X) - t)); }
        ok('edgeMonotoneAcrossRows', mono && near(K.progressEdge(l, L, 20), L.span) && L.rows.length === 2, prev);
        ok('edgeTimeInverse', inv < 1e-6, inv);
        const e1 = K.edgePt(G, K.progressEdge(l, L, 12.5)), e2 = K.edgePt(G, K.progressEdge(l, L, 17.5)), e3 = K.edgePt(G, K.progressEdge(l, L, 15));
        ok('edgeRowOfCursor', e1.k === 0 && e2.k === 1 && e3.k === 1 && near(e3.x, G.rows[1].x0) && near(e1.y, G.rows[0].y) && near(e2.y, G.rows[1].y), [e1, e2, e3]);
        ok('ptToXOnRow', near(K.ptX(G, G.rows[1].x0 + 1e-9, 1), L.rows[1].off) && near(K.ptX(G, G.rows[0].x0 + G.rows[0].w + 300, 0), L.rows[0].off + L.rows[0].w) && K.ptRow(G, G.rows[1].y - 10) === 1 && K.ptRow(G, G.rows[0].y - 10) === 0);
        // 拖光标：从第一排拖到第二排的「き」，这个字的开始 = 当前时间
        const T0 = 12.5, ex = e1, [cx, cy] = toC(ex.x, ex.y - K.S().size * 0.4), tx = G.rows[1].x0 + (L.units[6].x - L.rows[1].off) * G.s + 1, [mx, my] = toC(tx, G.rows[1].y - K.S().size * 0.4);
        ev(cv, 'pointerdown', cx, cy); ev(cv, 'pointermove', mx, my); const tip = document.getElementById('tip').textContent; ev(cv, 'pointerup', mx, my);
        const L2 = K.line(id); out.row2Retime = { s: L2.units.map((u) => u.s), tip };
        ok('cursorDragSecondRow', near(L2.units[6].s, T0) && L2.units[6].t === 'き' && L2.units.every((u, i, a) => !i || u.s >= a[i - 1].s) && K.undoWhy() === 'retime' && tip.includes('き'), out.row2Retime);
        K.undo();
        // 指着第二排的开头：选中的是第二排第一个字，不是第一排的行尾
        ev(cv, 'pointerdown', cx, cy); const [hx, hy] = toC(G.rows[1].x0 + 2, G.rows[1].y - 20); ev(cv, 'pointermove', hx, hy); ev(cv, 'pointerup', hx, hy);
        ok('cursorDragRowStart', near(K.line(id).units[5].s, T0) && K.line(id).units[5].t === 'か', K.line(id).units.map((u) => u.s)); K.undo();
        // 浏览模式：拖到第二排 = 第二排那个位置的时间
        K.ui.tool = 'scrub'; ev(cv, 'pointerdown', cx, cy); const [sx, sy] = toC(G.rows[1].x0 + (L.units[7].x - L.rows[1].off) * G.s + 0.5 * L.units[7].w * G.s, G.rows[1].y - 20); ev(cv, 'pointermove', sx, sy); ev(cv, 'pointerup', sx, sy); K.ui.tool = 'retime';
        ok('scrubSecondRow', near(K.now() - K.S().offset, 17.5, 0.02), K.now());
        // 命中：选择框盖住整块；光标在第二排时能抓住
        K.seek(17.5 + K.S().offset); await wait(30); const e4 = K.edgePt(G, K.progressEdge(l, L, 17.5)), [qx, qy] = toC(e4.x, e4.y - 20), before = JSON.stringify(K.line(id).units);
        ev(cv, 'pointerdown', qx, qy); ev(cv, 'pointerup', qx, qy); ok('cursorOnSecondRowGrabbable', JSON.stringify(K.line(id).units) === before && K.ui.sel === id); }

      /* U10. Alt+拖动 = 位置偏移（按画布像素），吸附；Ctrl+方向键微移；右键菜单“位置恢复原样”；换画布尺寸后比例不变 */
      { K.setProject(K.normalizeProject(K.SAMPLES[0].project)); await K.ensureFont(); const l = K.screen().ord[2], id = l.id; K.select(id); K.seek(28 + K.S().offset); await wait(60);
        const G0 = geoOf(l), B0 = K.blockBox(G0), [ax, ay] = toC(G0.x0 + G0.w * 0.3, (B0.top + B0.bot) / 2), r = cv.getBoundingClientRect(), k = r.width / cv.width;
        ev(cv, 'pointerdown', ax, ay, { altKey: true }); ev(cv, 'pointermove', ax + 150 * k, ay - 90 * k, { altKey: true, shiftKey: true }); const tip = document.getElementById('tip').textContent; ev(cv, 'pointerup', ax + 150 * k, ay - 90 * k, { altKey: true });
        const L1 = K.line(id), G1 = geoOf(L1);
        out.altDrag = { o: L1.o, dx: G1.x0 - G0.x0, dy: G1.y - G0.y, tip };
        ok('altDragMoves', near(G1.x0 - G0.x0, 150, 1) && near(G1.y - G0.y, -90, 1) && near(L1.o.dx * cv.width, G1.x0 - G0.x0, 1e-3) && K.undoWhy() === 'linePos' && K.ui.sel === id && JSON.stringify(L1.units) === JSON.stringify(l.units), out.altDrag);
        ok('altDragTooltip', tip.includes(String(Math.round(L1.o.dx * K.S().W))) && tip.includes(String(Math.round(L1.o.dy * K.S().H))), tip);
        // 选择框 / 光标跟着走（命中测试用新位置）
        const B1 = K.blockBox(G1), [bx2, by2] = toC((B1.x0 + B1.x1) / 2, (B1.top + B1.bot) / 2); K.select(null);
        ev(cv, 'pointerdown', bx2, by2); ev(cv, 'pointerup', bx2, by2); ok('hitFollowsOffset', K.ui.sel === id);
        // 吸附到原位：拖回去差 5px 也会归零
        const [cx2, cy2] = toC((B1.x0 + B1.x1) / 2, (B1.top + B1.bot) / 2);
        ev(cv, 'pointerdown', cx2, cy2, { altKey: true }); ev(cv, 'pointermove', cx2 - 145 * k, cy2 + 87 * k, { altKey: true }); const tipS = document.getElementById('tip').textContent; ev(cv, 'pointerup', cx2 - 145 * k, cy2 + 87 * k, { altKey: true });
        ok('altDragSnapsToZero', !K.line(id).o && tipS.includes(K.t('tip.posSnap')), [K.line(id).o, tipS]);
        // 吸附到画面中线（整块中心）
        const G2 = geoOf(K.line(id)), B2 = K.blockBox(G2), c0 = (B2.x0 + B2.x1) / 2, [px, py] = toC(c0, (B2.top + B2.bot) / 2), want = cv.width / 2 - c0 + 4;
        ev(cv, 'pointerdown', px, py, { altKey: true }); ev(cv, 'pointermove', px + want * k, py + 40 * k, { altKey: true }); ev(cv, 'pointerup', px + want * k, py + 40 * k, { altKey: true });
        const G3 = geoOf(K.line(id)); ok('altDragSnapsToCenter', near((G3.x0 + G3.x0 + G3.w) / 2, cv.width / 2, 0.02), [(G3.x0 + G3.x0 + G3.w) / 2, cv.width / 2]);
        // Ctrl+方向键
        const dx0 = K.line(id).o.dx; document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', ctrlKey: true, bubbles: true, cancelable: true }));
        ok('ctrlArrowNudges', near(K.line(id).o.dx - dx0, 4 / K.S().W, 1e-5) && K.undoWhy() === 'linePos', K.line(id).o);
        document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', ctrlKey: true, shiftKey: true, bubbles: true, cancelable: true }));
        ok('ctrlShiftArrowNudges', near(K.line(id).o.dy * K.S().H - 40, 20, 0.5), K.line(id).o.dy * K.S().H);
        // 比例在换画布尺寸后保持
        const fx = K.line(id).o.dx; K.S().W = 1280; K.touch(); const G4 = K.geo(K.line(id), K.screen().info.get(id), 1280, K.S().H); K.undo(); K.redo();
        ok('offsetIsFraction', K.line(id).o.dx === fx && near(G4.x0 - K.geo(Object.assign({}, K.line(id), { o: undefined }), K.screen().info.get(id), 1280, K.S().H).x0, fx * 1280, 1e-6));
        K.S().W = 2582; K.touch();
        // 右键预览里的歌词 = 行菜单，含“位置恢复原样”
        await wait(30); const G5 = geoOf(K.line(id)), B5 = K.blockBox(G5), [rx, ry] = toC((B5.x0 + B5.x1) / 2, (B5.top + B5.bot) / 2);
        cv.dispatchEvent(new MouseEvent('contextmenu', { clientX: rx, clientY: ry, bubbles: true, cancelable: true }));
        const mb = [...document.querySelectorAll('#menu button')], rp = mb.find((b) => b.textContent === K.t('menu.resetPos'));
        ok('stageContextMenu', !document.getElementById('menu').hidden && !!rp && mb.some((b) => b.textContent === K.t('menu.split')), mb.map((b) => b.textContent));
        rp.click(); ok('resetPosition', !K.line(id).o && K.undoWhy() === 'linePos'); }

      /* U11. 拆分 / 合并 / 和声行：换行和行属性 */
      { K.setProject(mkP([{ start: 1, end: 7, text: 'ab cd\nef gh', o: { size: 100, dx: 0.1 } }, { start: 8, end: 10, text: 'ij\nkl' }])); const [a, b] = K.project.lines;
        const d = K.ops.dup(a);
        ok('dupCopiesOvAndBreaks', JSON.stringify(d.o) === JSON.stringify(a.o) && d.o !== a.o && K.unitsToText(d.units) === 'ab cd\nef gh');
        K.undo(); const a2 = K.project.lines[0], at = a2.units[5].s;
        const nl = K.ops.split(a2, at - 0.001);
        ok('splitAtBreak', nl && K.unitsToText(nl.units) === 'ef gh' && !nl.units.some((u) => u.n) && K.unitsToText(K.project.lines[0].units) === 'ab cd' && JSON.stringify(nl.o) === '{"size":100,"dx":0.1}' && nl.o !== K.project.lines[0].o, nl && [K.unitsToText(nl.units), nl.o]);
        K.undo(); const a3 = K.project.lines[0], n2 = K.ops.split(a3, a3.units[3].s - 0.001);
        ok('splitKeepsLaterBreak', n2 && K.unitsToText(n2.units) === 'cd\nef gh' && n2.units[2].n === 1 && n2.o.size === 100);
        K.undo(); K.ops.merge(K.project.lines[0]); const mg = K.project.lines[0];
        ok('mergeKeepsFirstOvNoNewBreak', K.unitsToText(mg.units) === 'ab cd\nef gh ij\nkl' && mg.units.filter((u) => u.n).length === 2 && JSON.stringify(mg.o) === '{"size":100,"dx":0.1}', K.unitsToText(mg.units)); }

      /* U12. 导出：ASS \N、SRT 往返、LRC 用空格；ASS 带行属性；自动注音不跨换行 */
      { K.setProject(mkP([{ start: 1, end: 3, text: 'あい\nうえ' }, { start: 4, end: 6, text: 'Hello \nworld', o: { size: 120, baseFill: '#123456' } }, { start: 7, end: 9, text: 'plain line' }])); K.S().offset = 0;
        const ass = K.exportAssText(), dl = ass.split('\n').filter((x) => x.startsWith('Dialogue:')), txt = (d) => d.split(',').slice(9).join(',');
        out.assBrk = dl.map(txt);
        ok('assBreak', txt(dl[0]).replace(/\{[^}]*\}/g, '') === 'あい\\Nうえ' && (txt(dl[0]).match(/\\kf/g) || []).length === 4 && txt(dl[1]).replace(/\{[^}]*\}/g, '') === 'Hello \\Nworld', out.assBrk);
        ok('assLineOverrides', /\\fs120/.test(txt(dl[1])) && /\\2c&H563412&/.test(txt(dl[1])) && !/\\fs/.test(txt(dl[0])) && !/\\fs/.test(txt(dl[2])), out.assBrk);
        const srt = K.exportSrtText(), back = K.normalizeProject({ lines: K.parseSrt(srt) }).lines;
        out.srtBrk = srt;
        ok('srtBreakNewline', srt.includes('\nあい\nうえ\n') && srt.includes('\nHello\nworld\n'), srt);
        ok('srtRoundTrip', back.length === 3 && K.unitsToText(back[0].units) === 'あい\nうえ' && K.unitsToText(back[1].units) === 'Hello\nworld' && K.unitsToText(back[2].units) === 'plain line' && back.every((x, i) => near(K.ls(x), K.ls(K.project.lines[i]), 0.002) && near(x.end, K.project.lines[i].end, 0.002)), back.map((x) => K.unitsToText(x.units)));
        const lrc = K.exportLrcText(false), lrcW = K.exportLrcText(true), rw = K.normalizeProject(K.parseLrc(lrcW)).lines;
        ok('lrcBreakIsSpace', /\]あい うえ$/m.test(lrc) && /\]Hello world$/m.test(lrc) && !/\n(?!\[)/.test(lrc.trim()), lrc);
        ok('lrcWordsBreakIsSpace', rw.map((x) => K.lineText(x)).join('|') === 'あい うえ|Hello world|plain line' && (lrcW.match(/\n/g) || []).length === 6, [rw.map(K.lineText), lrcW]);
        // 自动注音：分词不跨换行，换行标记留在那一排的第一个字上
        const stubW = { '王道': 'オウドウ', '王': 'オウ', '道': 'ドウ' }, KW = Object.keys(stubW).sort((p, q) => q.length - p.length);
        K.furi.tokenizer = { tokenize: (t) => { const o = []; let i = 0; while (i < t.length) { const w = KW.find((x) => t.startsWith(x, i)); if (w) { o.push({ surface_form: w, reading: stubW[w] }); i += w.length; } else { o.push({ surface_form: t[i] }); i++; } } return o; } };
        K.setProject(mkP([{ start: 1, end: 4, text: '王\n道を' }, { start: 5, end: 8, text: '王道を' }]));
        K.furi.run('all', false); K.furi.tokenizer = null;
        out.furiBrk = K.project.lines.map((x) => K.unitsToText(x.units));
        ok('furiRespectsBreaks', out.furiBrk[0] === '王{おう}\n道{どう}を' && out.furiBrk[1] === '王道{おうどう}を' && K.project.lines[0].units[1].n === 1, out.furiBrk); }
      K.setProject(K.normalizeProject(K.SAMPLES[0].project)); K.dirty = false; }

    // ---- H. 拖入多个文件：全部处理（工程在前，媒体在后） ----
    { const mk = (title) => new File([JSON.stringify({ title, lines: [{ start: 1, end: 2, text: title }] })], title + '.kara.json', { type: 'application/json' });
      const dt = new DataTransfer(); dt.items.add(mk('DropA')); dt.items.add(mk('DropB'));
      // 1.5 秒静音 WAV：验证媒体加载后导出结束时间跟着刷新
      const sr = 8000, ns = sr * 1.5, buf = new ArrayBuffer(44 + ns * 2), v = new DataView(buf), w = (o, s) => [...s].forEach((ch, i) => v.setUint8(o + i, ch.charCodeAt(0)));
      w(0, 'RIFF'); v.setUint32(4, 36 + ns * 2, true); w(8, 'WAVEfmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true); v.setUint32(24, sr, true); v.setUint32(28, sr * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true); w(36, 'data'); v.setUint32(40, ns * 2, true);
      const wav = new File([buf], 'tone.wav', { type: 'audio/wav' });
      const dt2 = new DataTransfer(); dt2.items.add(wav); dt2.items.add(mk('DropC'));
      const seen = [], unsub = K.on('load', () => seen.push(K.project.title)); K.dirty = false;
      window.dispatchEvent(new DragEvent('drop', { dataTransfer: dt, bubbles: true, cancelable: true })); await until(() => seen.includes('DropB'));
      ok('dropMultiple', seen.includes('DropA') && seen.includes('DropB') && K.project.title === 'DropB', seen);
      window.dispatchEvent(new DragEvent('drop', { dataTransfer: dt2, bubbles: true, cancelable: true }));
      await until(() => K.project.title === 'DropC' && Math.abs(K.dur() - 1.5) < 0.02 && K.peaks && K.project.mediaName, 100);
      out.media = { title: K.project.title, mediaName: K.project.mediaName, eEnd: document.getElementById('eEnd').value, dur: K.dur(), peaks: !!K.peaks };
      ok('dropMediaAfterProject', K.project.title === 'DropC' && K.project.mediaName === 'tone.wav', out.media);
      ok('eEndFollowsMedia', near(parseFloat(out.media.eEnd), 1.5, 0.02), out.media);
      ok('mediaLabelShowsName', document.getElementById('mediaName').textContent === 'tone.wav');
      await frames(2); ok('bannerHiddenWithMedia', document.getElementById('mbanner').hidden && document.getElementById('clock').hidden);
      const md = document.getElementById('media'); K.setSpeed(0.75);
      ok('mediaRatePitch', md.playbackRate === 0.75 && md.preservesPitch === true, [md.playbackRate, md.preservesPitch]); K.setSpeed(1);
      ok('volumeEnabledWithMedia', !document.getElementById('vol').disabled && !document.getElementById('bMute').disabled);
      document.getElementById('bMute').click(); ok('muteToggles', md.muted === true && K.pref('muted') === true); document.getElementById('bMute').click(); ok('unmute', md.muted === false);
      // 两次拖放紧挨着：排队处理，不交错
      unsub(); seen.length = 0; K.dirty = false;
      const dA = new DataTransfer(); dA.items.add(mk('Q1')); dA.items.add(mk('Q2'));
      const dB = new DataTransfer(); dB.items.add(mk('Q3')); dB.items.add(mk('Q4'));
      const un2 = K.on('load', (why) => { if (why === 'project') seen.push(K.project.title); });
      window.dispatchEvent(new DragEvent('drop', { dataTransfer: dA, bubbles: true, cancelable: true }));
      window.dispatchEvent(new DragEvent('drop', { dataTransfer: dB, bubbles: true, cancelable: true }));
      await until(() => seen.length >= 4); un2();
      ok('dropsSerialised', seen.join() === 'Q1,Q2,Q3,Q4', seen); }

    // ---- I. YouTube：链接解析、工程字段、用假的 YT.Player 驱动播放时钟、内置示例 ----
    { const ID = '4pzuHoWYn0Q', yb = document.getElementById('ytBox');
      const cases = [[ID, ID], ['https://www.youtube.com/watch?v=' + ID + '&t=10s', ID], ['https://youtu.be/' + ID + '?si=abc', ID], ['youtube.com/shorts/' + ID, ID],
        ['https://m.youtube.com/watch?v=' + ID, ID], ['https://music.youtube.com/watch?v=' + ID + '&list=x', ID], ['https://www.youtube-nocookie.com/embed/' + ID, ID], ['  https://www.youtube.com/live/' + ID + '  ', ID],
        ['https://example.com/watch?v=' + ID, ''], ['https://www.youtube.com/watch?v=short', ''], ['hello', ''], ['', ''], [null, ''], ['javascript:alert(1)', '']];
      out.ytIds = cases.map(([s, e]) => [s, K.ytId(s), e]).filter((c) => c[1] !== c[2]);
      ok('ytIdParse', !out.ytIds.length, out.ytIds);
      ok('ytProjectField', K.normalizeProject({ youtube: 'https://youtu.be/' + ID, lines: [] }).youtube === ID && K.normalizeProject({ youtube: '<b>x</b>', lines: [] }).youtube === '' && K.blank().youtube === '');
      ok('ytOffWithoutApi', K.yt.available() === false && K.mediaMode() !== 'yt');      // ?noyt 且没有 window.YT：不联网

      /* 假播放器：行为照 IFrame API（状态变化事件是异步的；未开始时 seekTo 会开始播放） */
      const calls = [];
      function FakePlayer(el, o) {
        const self = this; let st = -1, t0 = 0, at = performance.now(), rate = 1, vol = 100, mut = false;
        const cur = () => (st === 1 ? t0 + ((performance.now() - at) / 1000) * rate : t0);
        const set = (s) => { t0 = cur(); at = performance.now(); st = s; setTimeout(() => o.events.onStateChange({ data: s, target: self })); };
        const ifr = document.createElement('iframe'); el.replaceWith(ifr);
        Object.assign(this, {
          getCurrentTime: () => cur(), getDuration: () => 200, getPlayerState: () => st, getVideoData: () => ({ title: 'Fake ' + o.videoId }),
          playVideo: () => { calls.push('play'); if (st !== 1) set(1); }, pauseVideo: () => { calls.push('pause'); set(2); },
          seekTo: (t) => { calls.push('seek:' + t.toFixed(2)); t0 = t; at = performance.now(); if (st !== 1 && st !== 2) set(1); },
          setPlaybackRate: (r) => { t0 = cur(); at = performance.now(); rate = r; }, setVolume: (v) => { vol = v; }, mute: () => { mut = true; }, unMute: () => { mut = false; },
          destroy: () => { calls.push('destroy'); ifr.remove(); }, _s: () => ({ vol, mut, rate, st, videoId: o.videoId, host: o.host }),
        });
        FakePlayer.last = this; FakePlayer.opts = o; FakePlayer.n = (FakePlayer.n || 0) + 1;
        setTimeout(() => o.events.onReady({ target: self }), 10);
      }
      window.YT = { Player: FakePlayer };
      const ytReady = () => until(() => K.mediaMode() === 'yt' && K.yt.ready(), 60);

      // 从本地文件（H 里载入的 tone.wav）换成 YouTube
      const was = K.mediaMode(); K.dirty = false;
      K.setYouTube(ID); await ytReady();
      const fp = () => FakePlayer.last._s();
      out.yt = { was, mode: K.mediaMode(), proj: K.project.youtube, why: K.undoWhy(), host: fp().host, vid: fp().videoId, box: !yb.hidden && !!yb.querySelector('iframe'),
        src: document.getElementById('media').getAttribute('src'), label: document.getElementById('mediaName').textContent, dur: K.dur() };
      ok('ytAttach', was === 'file' && out.yt.mode === 'yt' && out.yt.proj === ID && out.yt.vid === ID && K.dirty && out.yt.why === 'media', out.yt);
      ok('ytNoCookieHost', /youtube-nocookie\.com$/.test(out.yt.host), out.yt.host);
      ok('ytReplacesFile', out.yt.box && !out.yt.src && !K.peaks, out.yt);
      ok('ytLabelAndDur', out.yt.label === 'YouTube · Fake ' + ID && out.yt.dur === 200, out.yt);
      await frames(2);
      ok('ytUiState', document.getElementById('clock').hidden && document.getElementById('mbanner').hidden && !document.getElementById('vol').disabled);
      // 还没开始播放：跳转只记下来（真播放器这时 seekTo 会自动开始播放）
      // 载入后预热：静音播一下马上暂停在原来的时间，音量恢复，按钮仍是暂停
      ok('ytPrimed', fp().st === 2 && !fp().mut && !K.playing() && near(K.now(), out.yt.t0 || K.now(), 0.01), fp());
      calls.length = 0; K.seek(30); await wait(150);
      ok('ytSeekWhilePaused', near(K.now(), 30) && calls.join() === 'seek:30.00' && !K.playing() && fp().st === 2, { now: K.now(), calls });
      K.play(); await wait(30);
      ok('ytPlayFromSeek', calls.includes('play') && K.playing() && K.now() >= 30 && K.now() < 30.3, { calls, now: K.now() });
      await wait(400); const tp = K.now();
      ok('ytClockAdvances', tp > 30.2 && tp < 31.5, tp);
      { const ts = []; for (let i = 0; i < 12; i++) { await frames(1); ts.push(K.now()); }
        ok('ytMonotonic', ts.every((x, i) => !i || x >= ts[i - 1]), ts); }
      // 播放中跳转：立刻反映；连续拖动时节流（最后一次一定发出）
      calls.length = 0; K.seek(50); ok('ytSeekImmediate', near(K.now(), 50, 0.05), K.now());
      for (let i = 1; i <= 20; i++) K.seek(60 + i / 20);
      await wait(250);
      const sk = calls.filter((c) => c.startsWith('seek:'));
      ok('ytSeekThrottled', sk.length <= 3 && sk[sk.length - 1] === 'seek:61.00' && K.now() >= 61 && K.now() < 62, { sk, now: K.now() });
      K.setSpeed(0.75); ok('ytRate', fp().rate === 0.75, fp()); K.setSpeed(1);
      K.setVolume(0.4, true); ok('ytVolume', fp().vol === 40 && fp().mut === true, fp()); K.setVolume(1, false); ok('ytUnmute', fp().vol === 100 && !fp().mut);
      K.pause(); await wait(60); const pz = K.now(); await wait(200);
      ok('ytPause', !K.playing() && calls.includes('pause') && near(K.now(), pz, 1e-6), { pz, now: K.now() });
      // 播放器盖住画布；视频背景开 = 原样，关 = 调暗；开视频背景时画布不画抠像底色（录屏模式也透明）
      const cvv = document.getElementById('cv'); K.S().useVideoBg = true; K.invalidate(); await frames(2);
      ok('ytBoxCoversCanvas', yb.offsetWidth === cvv.offsetWidth && yb.offsetHeight === cvv.offsetHeight && yb.offsetLeft === cvv.offsetLeft && !yb.classList.contains('dim'), [yb.offsetWidth, cvv.offsetWidth, yb.offsetLeft, cvv.offsetLeft]);
      document.body.classList.add('rec'); K.invalidate(); await frames(2);
      { const px = cvv.getContext('2d').getImageData(2, 2, 1, 1).data; ok('ytRecTransparent', px[3] === 0, [...px]); }
      document.body.classList.remove('rec');
      K.S().useVideoBg = false; await frames(2); ok('ytDimWithoutVideoBg', yb.classList.contains('dim'));
      // 播放器设置模式：换成带控制条的播放器、放到歌词上面；完成 / Esc 换回来；时间不变
      { const bs = document.getElementById('bYtSet'), bar = document.getElementById('ytBar'), n0 = FakePlayer.n;
        ok('ytSetButtonShown', !bs.hidden);
        bs.click(); await ytReady();
        out.ytSet = { ctl: FakePlayer.opts.playerVars.controls, kb: FakePlayer.opts.playerVars.disablekb, front: yb.classList.contains('front'), bar: !bar.hidden, n: FakePlayer.n - n0, now: K.now(), z: getComputedStyle(yb).zIndex, pe: getComputedStyle(yb).pointerEvents };
        ok('ytSettingsOpen', out.ytSet.ctl === 1 && out.ytSet.kb === 0 && out.ytSet.front && out.ytSet.bar && out.ytSet.n === 1 && out.ytSet.pe === 'auto' && +out.ytSet.z > 1 && near(K.now(), pz, 0.01) && K.yt.inSettings(), out.ytSet);
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })); await ytReady();
        ok('ytSettingsEsc', !K.yt.inSettings() && FakePlayer.opts.playerVars.controls === 0 && !yb.classList.contains('front') && bar.hidden && near(K.now(), pz, 0.01));
        K.yt.settings(true); await ytReady(); bar.querySelector('button').click(); await ytReady();
        ok('ytSettingsDone', !K.yt.inSettings() && FakePlayer.opts.playerVars.controls === 0 && FakePlayer.n === n0 + 4, FakePlayer.n - n0);
        K.yt.settings(true); await ytReady(); K.play(); await wait(200);
        ok('ytSettingsKeepsPlaying', K.playing() && K.now() > pz + 0.1, K.now());
        K.yt.settings(false); await ytReady(); await wait(100);
        ok('ytSettingsCloseKeepsPlaying', K.playing() && !K.yt.inSettings(), K.playing());
        K.pause(); K.seek(pz); await wait(100); }
      // 撤销 / 重做跟着切换播放器
      const n0 = FakePlayer.n; K.undo(); await frames(2);
      ok('ytUndoDetaches', K.project.youtube === '' && K.mediaMode() === '' && yb.hidden && calls.includes('destroy') && near(K.now(), pz, 0.01), { mode: K.mediaMode(), now: K.now() });
      K.redo(); await ytReady(); ok('ytRedoAttaches', K.mediaMode() === 'yt' && FakePlayer.n === n0 + 1 && near(K.now(), pz, 0.01), { n: FakePlayer.n, now: K.now() });
      // 新建 / 导入沿用正在用的视频
      K.dirty = false; await K.newProject(); await frames(2);
      ok('ytKeptOnNew', K.project.youtube === ID && K.mediaMode() === 'yt' && FakePlayer.n === n0 + 1, { y: K.project.youtube, n: FakePlayer.n });
      // 播放器报错：退回无声时钟，提示原因；之后的撤销等不再自动重试
      FakePlayer.opts.events.onError({ data: 150 }); await frames(2);
      const tl = [...document.querySelectorAll('#toasts .toast')].map((x) => x.dataset.msg).join('|');
      ok('ytErrorFallsBack', K.mediaMode() === '' && yb.hidden && tl.includes(K.t('yt.e.file')) && !document.getElementById('clock').hidden, { mode: K.mediaMode(), tl });
      ok('ytErrorBanner', !document.getElementById('mbanner').hidden && document.querySelector('#mbanner .tx').textContent === K.t('mb.yt'));
      const n1 = FakePlayer.n; K.emit('load'); await frames(2); ok('ytNoAutoRetry', FakePlayer.n === n1 && K.mediaMode() === '');
      // 载入本地文件优先，工程里的链接保留
      K.setYouTube(ID); await ytReady();
      const wav = new File([new Uint8Array([82, 73, 70, 70])], 'x.wav', { type: 'audio/wav' });
      K.loadMedia(wav);
      ok('ytFileWins', K.mediaMode() === 'file' && yb.hidden && K.project.youtube === ID, { mode: K.mediaMode(), y: K.project.youtube });
      // 这个文件放不了：退回工程里的 YouTube 视频
      ok('ytAfterFileError', await until(() => K.mediaMode() === 'yt' && K.yt.ready(), 80), K.mediaMode());
      // 拖入 YouTube 链接
      { const dt = new DataTransfer(); dt.setData('text/uri-list', 'https://youtu.be/dQw4w9WgXcQ');
        window.dispatchEvent(new DragEvent('drop', { dataTransfer: dt, bubbles: true, cancelable: true }));
        await until(() => K.yt.ready() && fp().videoId === 'dQw4w9WgXcQ');
        ok('ytDropLink', K.project.youtube === 'dQw4w9WgXcQ' && fp().videoId === 'dQw4w9WgXcQ', K.project.youtube); }
      // 对话框：无效链接时「使用」不可点；有效链接 → 换视频；「移除链接」
      { const p = K.youtubeDialog(); await frames(1);
        const d = document.querySelector('dialog.yt'), i = d && d.querySelector('#ytUrl'), go = d && d.querySelector('.dacts .pri');
        ok('ytDialogPrefill', i && i.value === 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' && !go.disabled && !!d.querySelector('.dacts .danger'), i && i.value);
        i.value = 'not a link'; i.dispatchEvent(new Event('input', { bubbles: true }));
        ok('ytDialogInvalid', go.disabled && d.querySelector('#ytMsg').textContent === K.t('yt.bad'));
        i.value = 'https://www.youtube.com/watch?v=' + ID; i.dispatchEvent(new Event('input', { bubbles: true })); go.click(); await p; await ytReady();
        ok('ytDialogUse', K.project.youtube === ID && fp().videoId === ID && !document.querySelector('dialog.yt'));
        const p2 = K.youtubeDialog(); await frames(1); document.querySelector('dialog.yt .dacts .danger').click(); await p2; await frames(1);
        ok('ytDialogRemove', K.project.youtube === '' && K.mediaMode() === '' && yb.hidden); }

      // 内置示例（发布的 samples/，不是测试用的固定数据）：数据完整、带 YouTube 链接，载入后自动用这个视频
      const saved = K.SAMPLES; K.SAMPLES = [];
      for (const f of ['hydro_king_jp', 'hydro_king_fr']) await new Promise((r) => { const s = document.createElement('script'); s.src = 'samples/' + f + '.js'; s.onload = s.onerror = r; document.head.appendChild(s); });
      const real = K.SAMPLES; K.SAMPLES = saved;
      out.real = real.map((s) => { const p = K.normalizeProject(s.project); return { title: p.title, yt: p.youtube, lines: p.lines.length, raw: s.project.lines.length, dur: p.duration, bad: p.lines.filter((l) => !l.units.every((u) => isFinite(u.s)) || !(l.end > K.ls(l))).length }; });
      ok('shippedSamples', out.real.length === 2 && out.real.every((r) => r.yt === ID && r.lines === r.raw && r.lines > 60 && !r.bad && r.dur > 200) && out.real.map((r) => r.title).join() === 'hydro_king_jp,hydro_king_fr', out.real);
      ok('shippedSampleNames', real.every((s) => K.has('sample.' + s.project.title)));
      K.dirty = false; K.setProject(K.normalizeProject(real[0].project), false, { src: 'sample' }); await ytReady();
      ok('sampleUsesYouTube', K.mediaMode() === 'yt' && fp().videoId === ID, { mode: K.mediaMode() });
      K.setYouTube(''); delete window.YT;
      K.setProject(K.normalizeProject(K.SAMPLES[0].project)); K.dirty = false; await frames(2);
      ok('ytCleanup', K.mediaMode() === '' && K.yt.available() === false && document.getElementById('bYtSet').hidden && document.getElementById('ytBar').hidden); }

    /* ---- 代码审查修复的回归：输入框里的 ?、清空的数字框、拖入普通文字、歌曲末尾的循环 ---- */
    { K.setProject(K.normalizeProject(K.SAMPLES[0].project)); K.dirty = false; await frames(2);
      const l = K.screen().ord[0]; K.select(l.id); await frames(2);
      const q = (k) => document.querySelector('#tab-line [data-k="' + k + '"]');
      const kd = (el, k, code) => { const e = new KeyboardEvent('keydown', { key: k, code: code || k, shiftKey: k === '?', bubbles: true, cancelable: true }); el.dispatchEvent(e); return e.defaultPrevented; };
      // 输入框里按 ? 是打字，不是打开帮助；F1 仍然打开帮助
      const ta = document.getElementById('lnText'); ta.focus();
      const p1 = kd(ta, '?', 'Slash'); await frames(1);
      ok('questionMarkTypesInField', !p1 && !document.querySelector('dialog.help'), { prevented: p1 });
      const ti = document.getElementById('title'); ti.focus(); const p2 = kd(ti, '?', 'Slash'); await frames(1);
      ok('questionMarkTypesInTitle', !p2 && !document.querySelector('dialog.help')); ti.blur();
      ta.focus(); const p3 = kd(ta, 'F1'); await frames(1); const hd = document.querySelector('dialog.help');
      ok('f1StillOpensHelpInField', p3 && !!hd); if (hd) hd.querySelector('[data-x]').click(); await frames(1);
      document.activeElement && document.activeElement.blur(); kd(document.body, '?', 'Slash'); await frames(1); const hd2 = document.querySelector('dialog.help');
      ok('questionMarkOpensHelpOutsideFields', !!hd2); if (hd2) hd2.querySelector('[data-x]').click(); await frames(2);
      // 清空「开始」：时间不变（以前整行被压到 0 秒、行结束变成 NaN）
      const snap = () => JSON.stringify([K.sel().units.map((u) => u.s), K.sel().end]), s0 = snap();
      let f = q('start'); f.value = ''; f.dispatchEvent(new Event('change', { bubbles: true })); await frames(2);
      ok('emptyStartKeepsTiming', snap() === s0 && isFinite(K.sel().end) && q('start').value === K.ls(K.sel()).toFixed(2), { now: snap().slice(0, 80) });
      f = q('start'); f.value = '-5'; f.dispatchEvent(new Event('change', { bubbles: true })); await frames(2);
      ok('negativeStartClampsToZero', K.ls(K.sel()) === 0 && K.sel().units.every((u) => isFinite(u.s) && u.s >= 0)); K.undo(); await frames(2); K.select(K.screen().ord[0].id); await frames(2);
      // 清空「出现 / 消失时间」= 恢复自动（以前写进 NaN）
      f = q('showAt'); f.value = (K.ls(K.sel()) - 1).toFixed(2); f.dispatchEvent(new Event('change', { bubbles: true })); await frames(2);
      const hadShow = K.sel().showAt != null;
      f = q('showAt'); f.value = ''; f.dispatchEvent(new Event('change', { bubbles: true })); await frames(2);
      ok('emptyShowAtIsAuto', hadShow && K.sel().showAt === null && isFinite(K.screen().info.get(K.sel().id).show));
      f = q('hideAt'); f.value = ''; f.dispatchEvent(new Event('change', { bubbles: true })); await frames(2);
      ok('emptyHideAtIsAuto', K.sel().hideAt === null && isFinite(K.screen().info.get(K.sel().id).hide) && !/NaN/.test(document.getElementById('tab-line').innerHTML));
      K.ops.shift(K.sel(), NaN); ok('shiftIgnoresNaN', snap() === s0);
      // 拖进来一个普通的词（碰巧 11 个字母）不当作 YouTube ID；拖到输入框里的文字交给浏览器
      const drop = (target, text) => { const dt = new DataTransfer(); dt.setData('text/plain', text); const e = new DragEvent('drop', { dataTransfer: dt, bubbles: true, cancelable: true }); target.dispatchEvent(e); return e.defaultPrevented; };
      const pd = drop(document.body, 'information'); await K.fileQueue(); await frames(1);
      ok('dropPlainWordIgnored', pd && K.project.youtube === '', K.project.youtube);
      const pf = drop(document.getElementById('lnText'), 'https://youtu.be/dQw4w9WgXcQ'); await K.fileQueue(); await frames(1);
      ok('dropIntoFieldIsNative', !pf && K.project.youtube === '', { prevented: pf, yt: K.project.youtube });
      // 循环：最后一行贴着歌曲结尾时照样跳回去（以前内部时钟到头就停了）
      const last = K.screen().ord.slice(-1)[0]; K.project.duration = K.r3(last.end + 0.1); K.select(last.id); K.pause(); K.toggleLoop(true);
      const lr = K.loopRange(); let ts = performance.now(), wrapped = false, prev = K.now();
      for (let i = 0; i < 400; i++) { ts += 50; K.tick(ts); if (K.now() < prev - 0.5) wrapped = true; prev = K.now(); }
      ok('loopWrapsAtSongEnd', wrapped && K.playing() && lr && near(lr[1], K.dur(), 1e-6) && K.now() >= lr[0] - 1e-6 && K.now() <= lr[1] + 1e-6, { wrapped, playing: K.playing(), now: K.now(), lr });
      K.toggleLoop(false); K.pause(); K.setProject(K.normalizeProject(K.SAMPLES[0].project)); K.dirty = false; await frames(2); }

  } catch (e) { out.error = String(e && e.stack || e); }
  const pre = document.createElement('pre'); pre.id = 'result';
  const head = out.error ? `FAIL: exception (${fails.length} failed of ${n} checks before it)` : fails.length ? `FAIL: ${fails.length} of ${n} checks failed` : `PASS: ${n} checks`;
  pre.textContent = head + '\n' + JSON.stringify({ failures: fails, error: out.error, out }, null, 1);
  document.body.appendChild(pre);
});
