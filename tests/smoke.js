/* 冒烟测试：在真实页面里模拟拖动 / 快捷键 / 切换语言等操作，逐条断言。
   结果写进 <pre id="result">：第一行是 PASS/FAIL 汇总，第二行起是 JSON 详情（失败项、异常、原始观测值） */
window.addEventListener('load', async () => {
  const out = {}, fails = [], K = window.K;
  /* 无头 Chrome 的虚拟时间里几乎不出动画帧：由测试自己驱动 K.tick（与 requestAnimationFrame 循环做的事完全相同） */
  const frames = async (k) => { for (let i = 0; i < k; i++) { await new Promise((r) => setTimeout(r, 16)); K.tick(performance.now()); } };
  const wait = async (ms) => { await new Promise((r) => setTimeout(r, ms)); await frames(2); };
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
      const acts = [...document.querySelectorAll('#welcomeActions [data-act]')].map((b) => b.dataset.act);
      ok('welcomeActions', ['sample', 'import', 'open', 'empty'].every((a) => acts.includes(a)) && acts.length === K.welcomeActions.filter((a) => a.where.includes('welcome')).length, acts);
      ok('welcomeFocusInside', wd && wd.contains(document.activeElement));
      key(document.body, ' ', 'Space'); await frames(1); ok('noShortcutsUnderModal', !K.playing());
      wd.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })); await frames(1);
      ok('welcomeEscCloses', !document.querySelector('dialog.welcome') && !K.modalOpen() && K.pref('welcomed') === true);
      // 第二次打开（同一浏览器，有 welcomed 标记、无自动保存）：用 iframe 真正再启动一次
      const boot = async () => { const f = document.createElement('iframe'); f.style.cssText = 'position:fixed;left:-3000px;width:1200px;height:800px'; f.src = 'index.html';
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

  } catch (e) { out.error = String(e && e.stack || e); }
  const pre = document.createElement('pre'); pre.id = 'result';
  const head = out.error ? `FAIL: exception (${fails.length} failed of ${n} checks before it)` : fails.length ? `FAIL: ${fails.length} of ${n} checks failed` : `PASS: ${n} checks`;
  pre.textContent = head + '\n' + JSON.stringify({ failures: fails, error: out.error, out }, null, 1);
  document.body.appendChild(pre);
});
