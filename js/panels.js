/* 左侧歌词列表、右侧属性面板（行 / 样式 / 版面 / 导出）、右键菜单 */
(function () {
  const K = window.K, $ = (id) => document.getElementById(id), T = K.t;
  const esc = K.esc, et = (k, p) => esc(T(k, p));          // et = 翻译后转义（拼 innerHTML 用）
  const fmt = (t) => { const m = Math.floor(t / 60); return m + ':' + (t % 60).toFixed(2).padStart(5, '0'); };
  K.fmt = fmt;

  /* ---------- 右键菜单 ---------- */
  K.menu = (x, y, items) => {
    const m = $('menu'); m.innerHTML = '';
    items.forEach((it) => {
      if (!it) { m.appendChild(document.createElement('hr')); return; }
      const b = document.createElement('button'); b.textContent = it[0]; if (it[2]) b.classList.add('on');
      b.setAttribute('role', 'menuitem'); b.onclick = () => { m.hidden = true; it[1](); }; m.appendChild(b);
    });
    m.hidden = false;
    m.style.left = Math.min(x, innerWidth - m.offsetWidth - 8) + 'px'; m.style.top = Math.min(y, innerHeight - m.offsetHeight - 8) + 'px';
  };
  addEventListener('pointerdown', (e) => { const m = $('menu'); if (!m.hidden && !m.contains(e.target)) m.hidden = true; }, true);
  /* 音节菜单（右键时间线刻度 / 行面板里的音节行）：在某个字母处分开…、和前一个音节合并、整行恢复自动 */
  const sylItems = (l, i, x, y) => {
    const G = K.groups(l), g = G.find((q) => q.w && q.i === i), U = l.units, out = [];
    if (!g) return out;
    const txt = (a, b) => U.slice(a, b).map((u) => u.t).join(''), at = [];
    for (let k = g.i + 1; k < g.c; k++) if (K.isLetter(U[k])) at.push(k);
    if (at.length) out.push([T('menu.sylSplit'), () => K.menu(x, y, at.map((k) => [txt(g.i, k) + ' | ' + txt(k, g.c), () => K.ops.syl(l, k, 1)]))]);
    if (!g.f) out.push([T('menu.sylMerge'), () => K.ops.syl(l, g.i, 0)]);
    return out;
  };
  const hasSyl = (l) => K.groups(l).some((g) => g.w);
  K.sylMenu = (l, i, x, y) => { const it = sylItems(l, i, x, y); if (l.units.some((u) => u.k != null)) it.push([T('menu.sylReset'), () => K.ops.sylReset(l)]); if (it.length) K.menu(x, y, it); };
  K.lineMenu = (l, x, y, b) => {
    const I = K.screen().info.get(l.id), set = (k, v) => () => K.ops.set(l, k, v), syl = b && !b.j ? sylItems(l, b.i, x, y) : [];
    const ew = hasSyl(l) ? [[T('menu.evenSyl'), () => K.ops.evenSyl(l)]] : [];
    if (K.project.lines.some(hasSyl)) ew.push([T('menu.evenSylAll'), () => K.ops.evenSylAll()]);
    if (l.units.some((u) => u.k != null)) ew.push([T('menu.sylReset'), () => K.ops.sylReset(l)]);
    K.menu(x, y, [
      ...syl, syl.length ? null : undefined,
      [I.para ? T('menu.paraOn') : T('menu.paraSet'), set('newPara', I.para ? (l.newPara === true ? null : false) : true), I.para],
      l.newPara != null ? [T('menu.paraAuto'), set('newPara', null)] : null,
      null,
      [T('menu.dotsAuto'), set('dots', null), l.dots == null], [T('menu.dotsOn'), set('dots', true), l.dots === true], [T('menu.dotsOff'), set('dots', false), l.dots === false],
      null,
      [T('menu.rowAuto'), set('row', null), l.row == null], ...[0, 1, 2, 3].map((r) => [T('menu.row', { n: r + 1 }), set('row', r), l.row === r]),
      null,
      [T('menu.dup'), () => K.ops.dup(l)],
      [T('menu.split'), () => K.ops.split(l, K.now() - K.S().offset)],
      [T('menu.merge'), () => K.ops.merge(l)],
      [T('menu.resetShow'), () => { l.showAt = null; l.hideAt = null; K.commit('showHide'); }],
      l.o && (l.o.dx != null || l.o.dy != null) ? [T('menu.resetPos'), () => K.ops.resetPos(l)] : undefined,
      K.hasOv(l) ? [T('line.ovReset'), () => K.ops.clearStyle(l)] : undefined,
      null,
      [T('menu.furiLine'), () => K.autoFurigana('line')], [T('menu.furiAll'), () => K.autoFurigana('all')],
      null, ...ew, ew.length ? null : undefined,
      [T('menu.del'), () => K.ops.del(l)],
    ].filter((v) => v !== undefined).filter((v, i, a) => !(v === null && a[i - 1] === null)));
  };

  /* ---------- 歌词列表 ---------- */
  function buildList() {
    const sc = K.screen();
    $('list').innerHTML = sc.ord.map((l) => {
      const I = sc.info.get(l.id);
      return `<div class="li${I.para ? ' para' : ''}${l.id === K.ui.sel ? ' sel' : ''}" data-id="${esc(l.id)}"><span class="t">${fmt(K.ls(l))}</span><span class="rw${I.auto ? '' : ' man'}" title="${et(I.auto ? 'list.rowAuto' : 'list.rowManual')}">${I.row + 1}</span><span class="x">${I.dotsDur ? '<i class="dot">●●●</i> ' : ''}${esc(K.lineLabel(l))}</span>${K.hasOv(l) ? `<i class="lso" title="${et('list.ov')}" aria-label="${et('list.ov')}">Aa</i>` : ''}</div>`;
    }).join('') || K.emptyListHtml();
  }
  let lastNow = '';
  K.markNow = (t) => {
    const ids = K.screen().ord.filter((l) => t >= K.ls(l) - 0.05 && t <= l.end).map((l) => l.id), key = ids.join();
    if (key === lastNow) return; lastNow = key;
    [...$('list').children].forEach((el) => el.classList.toggle('now', ids.includes(el.dataset.id)));
    if (K.playing() && ids.length) { const el = $('list').querySelector('.now'); if (el) el.scrollIntoView({ block: 'nearest' }); }
  };

  /* ---------- 行属性 ---------- */
  const tri = (v) => (v == null ? '' : v ? '1' : '0'), untri = (s) => (s === '' ? null : s === '1');
  const opt = (v, cur, label) => `<option value="${esc(v)}"${String(cur) === String(v) ? ' selected' : ''}>${esc(label)}</option>`;
  function buildLine() {
    const l = K.sel(), el = $('tab-line');
    if (!l) { el.innerHTML = `<div class="hint pad">${T('line.help_html')}</div>`; return; }
    const I = K.screen().info.get(l.id), foc = document.activeElement && el.contains(document.activeElement) ? document.activeElement.dataset.k : null;
    const nB = K.bounds(l).length, atTip = et('line.atTip'), moraTip = et('line.atMoraTip'), hs = hasSyl(l), sylTip = et('line.sylMenu');
    el.innerHTML = `
      <h4>${et('line.gText')}</h4>
      <label class="blk" for="lnText">${et('line.text')}</label>
      <textarea id="lnText" data-k="text" rows="${Math.min(8, Math.max(2, K.nRows(l) + (K.nRows(l) > 1 ? 1 : 0)))}" spellcheck="false">${esc(K.unitsToText(l.units))}</textarea>
      <div class="hint">${et('line.brkHint')}</div>
      <div class="btns"><button data-a="furi" title="${et('line.furiTip')}">${et('line.furi')}</button></div>
      <h4>${et('line.gTiming')}</h4>
      <div class="row"><label>${et('line.startEnd')}</label><input data-k="start" type="number" step="0.01" value="${K.ls(l).toFixed(2)}" aria-label="${et('line.start')}"><input data-k="end" type="number" step="0.01" value="${l.end.toFixed(2)}" aria-label="${et('line.end')}"></div>
      <div class="btns ind"><button data-a="m50" title="${et('line.nudgeTip')}">−50ms</button><button data-a="p50" title="${et('line.nudgeTip')}">+50ms</button><button data-a="even" title="${et('line.evenTip')}">${et('line.even')}</button>${hs ? `<button data-a="evenSyl" title="${et('line.evenSylTip')}">${et('line.evenSyl')}</button>` : ''}</div>
      <h4>${et('line.gDisplay')}</h4>
      <div class="row"><label>${et('line.rowAlign')}</label><select data-k="row" aria-label="${et('line.rowLabel')}">${opt('', l.row == null ? '' : 'x', T('line.rowAutoN', { n: I.row + 1 }))}${[0, 1, 2, 3].map((r) => opt(r, l.row, T('line.rowN', { n: r + 1 }))).join('')}</select>
        <select data-k="align" aria-label="${et('line.alignLabel')}">${opt('', l.align || '', T('line.alignAuto'))}${opt('left', l.align, T('line.left'))}${opt('center', l.align, T('line.center'))}${opt('right', l.align, T('line.right'))}</select></div>
      <div class="row"><label>${et('line.para')}</label><select data-k="newPara">${opt('', tri(l.newPara), T(I.para ? 'line.paraAutoY' : 'line.paraAutoN'))}${opt('1', tri(l.newPara), T('line.paraOn'))}${opt('0', tri(l.newPara), T('line.paraOff'))}</select></div>
      <div class="row"><label>${et('line.dots')}</label><select data-k="dots">${opt('', tri(l.dots), T(I.dotsDur ? 'line.dotsAutoY' : 'line.dotsAutoN'))}${opt('1', tri(l.dots), T('line.dotsOn'))}${opt('0', tri(l.dots), T('line.dotsOff'))}</select></div>
      <div class="row"><label>${et('line.show')}</label><input data-k="showAt" type="number" step="0.05" value="${I.show.toFixed(2)}"><button data-a="autoShow" ${l.showAt == null ? 'disabled' : ''}>${et(l.showAt == null ? 'line.auto' : 'line.resetAuto')}</button></div>
      <div class="row"><label>${et('line.hide')}</label><input data-k="hideAt" type="number" step="0.05" value="${I.hide.toFixed(2)}"><button data-a="autoHide" ${l.hideAt == null ? 'disabled' : ''}>${et(l.hideAt == null ? 'line.auto' : 'line.resetAuto')}</button></div>
      ${lineStyleHtml(l, I)}
      <h4>${et('line.gActions')}</h4>
      <div class="btns acts"><button data-a="dup">${et('line.dup')}</button><button data-a="split">${et('line.split')}</button><button data-a="merge">${et('line.merge')}</button><button data-a="del" class="danger">${et('line.del')}</button></div>
      <h4>${et('line.gChars')}</h4>
      <div class="hint">${T('line.tap_html', { cur: Math.min(K.ui.tapIdx + 1, nB), total: nB })}</div>
      ${hs ? `<div class="hint">${T('line.syl_html')}</div><div class="btns"><button data-a="sylReset" ${l.units.some((u) => u.k != null) ? '' : 'disabled'}>${et('menu.sylReset')}</button></div>` : ''}
      <div class="tblWrap"><table><thead><tr><th scope="col">${et('line.thChar')}</th><th scope="col">${et('line.thRuby')}</th><th scope="col">${et('line.thStart')}</th><th scope="col"><span class="sr">${et('line.thSet')}</span></th></tr></thead><tbody>${(() => { const B = K.bounds(l), cur = B[K.ui.tapIdx] || {}; return K.groups(l).map((g) => { const i = g.i, u = l.units[i], Ts = K.subTimes(l, i), ms = g.w ? [] : K.moras(u.r), bi = B.findIndex((b) => b.i === i), lab = g.w ? K.gText(l, g) : u.t;
        const first = g.w ? `<td class="syl${g.f ? '' : ' in'}">${g.f ? '' : '·'}${esc(lab)}</td><td><button class="sylb" data-syl="${i}" title="${sylTip}" aria-label="${sylTip}">⋯</button></td>` : `<td>${esc(u.t) || '&nbsp;'}</td><td><input data-k="r${i}" data-r="${i}" value="${esc(u.r || '')}" aria-label="${et('line.rubyFor', { c: u.t })}"></td>`;
        return `<tr class="${cur.i === i && !cur.j ? 'cur' : ''}"${g.w ? ` data-g="${i}"` : ''}>${first}<td><input data-k="s${i}" data-b="${bi}" type="number" step="0.01" value="${u.s.toFixed(2)}" aria-label="${et('line.startFor', { c: lab })}"></td><td><button data-n="${bi}" title="${atTip}" aria-label="${atTip}">＠</button></td></tr>` +
          ms.slice(1).map((m, q) => `<tr class="sub${cur.i === i && cur.j === q + 1 ? ' cur' : ''}"><td></td><td class="mora">└ ${esc(m)}</td><td><input data-k="b${bi + q + 1}" data-b="${bi + q + 1}" type="number" step="0.01" value="${Ts[q + 1].toFixed(2)}" aria-label="${et('line.startFor', { c: m })}"></td><td><button data-n="${bi + q + 1}" title="${moraTip}" aria-label="${moraTip}">＠</button></td></tr>`).join('');}).join(''); })()}</tbody></table></div>`;
    K.selTitles(el);
    if (foc) { const f = el.querySelector(`[data-k="${foc}"]`); if (f) f.focus(); }
  }
  function lineEvents() {
    const el = $('tab-line');
    el.addEventListener('input', (e) => { if (e.target.dataset.o) applyOv(e, false); });
    /* 歌词文字框：Shift+Enter = 行内换行（Enter 照旧换行；提交时换行和写成 \n 的都变成行内换行） */
    el.addEventListener('keydown', (e) => {
      const t = e.target; if (t.id !== 'lnText' || e.key !== 'Enter' || !e.shiftKey || e.isComposing || e.keyCode === 229) return;
      e.preventDefault(); t.setRangeText('\n', t.selectionStart, t.selectionEnd, 'end'); t.dispatchEvent(new Event('input', { bubbles: true }));
    });
    /* 折叠 / 展开“本行独立样式”：记在界面偏好里（只认用户点击，重建面板时不改） */
    el.addEventListener('click', (e) => { const s = e.target.closest && e.target.closest('summary.lsoS'); if (s) K.pref('lsOpen', !s.parentElement.open); }, true);
    el.addEventListener('change', (e) => {
      const l = K.sel(), d = e.target.dataset, v = e.target.value; if (!l) return;
      if (d.o) { applyOv(e, true); return; }
      if (d.of) { K.setOv(l, 'font', K.cleanSetting('font', `'${v.replace(/'/g, '')}', ${FALLBACK}`) || FALLBACK); K.commit('lineStyle'); K.ensureFont(); return; }
      if (d.k === 'text') { if (K.retext(l, v)) K.commit('text'); else buildLine(); }
      else if (d.k === 'start') { const v2 = parseFloat(v); if (isFinite(v2)) K.ops.shift(l, Math.max(0, v2) - K.ls(l)); else buildLine(); }          // 清空 / 不是数字：恢复原值
      else if (d.k === 'end') { const v2 = parseFloat(v); if (isFinite(v2)) { K.setEnd(l, Math.max(v2, K.minEnd(l))); K.commit('timing'); } else buildLine(); }
      else if (d.k === 'row') K.ops.set(l, 'row', v === '' ? null : +v);
      else if (d.k === 'align') K.ops.set(l, 'align', v || null);
      else if (d.k === 'newPara') K.ops.set(l, 'newPara', untri(v));
      else if (d.k === 'dots') K.ops.set(l, 'dots', untri(v));
      /* 出现 / 消失时间：清空 = 恢复自动 */
      else if (d.k === 'showAt') { const v2 = parseFloat(v); K.ops.set(l, 'showAt', isFinite(v2) ? Math.min(v2, K.ls(l) - 0.05) : null); }
      else if (d.k === 'hideAt') { const v2 = parseFloat(v); K.ops.set(l, 'hideAt', isFinite(v2) ? Math.max(v2, K.ls(l) + 0.1) : null); }
      else if (d.r != null) { l.units[+d.r].r = v || null; K.commit('text'); }
      else if (d.b != null) { const b = K.bounds(l)[+d.b]; if (b && !isNaN(parseFloat(v))) { K.setBoundary(l, b.i, b.j, parseFloat(v)); K.commit('timing'); } }
    });
    el.addEventListener('click', (e) => {
      const l = K.sel(), d = e.target.dataset; if (!l) return;
      const t = K.now() - K.S().offset;
      if (d.n != null) { K.ui.tapIdx = +d.n; K.ops.tap(K.r3(t)); return; }
      if (d.syl != null) { const r = e.target.getBoundingClientRect(); K.sylMenu(l, +d.syl, r.left, r.bottom + 2); return; }
      if (d.ovr) { d.ovr.split(',').forEach((k) => K.setOv(l, k, null)); K.commit('lineStyle'); if (d.ovr === 'font') K.ensureFont(); return; }
      if (/^ov/.test(d.a || '')) { styleAction(l, d.a); return; }
      ({ m50: () => K.ops.shift(l, -0.05), p50: () => K.ops.shift(l, 0.05), even: () => K.ops.even(l), dup: () => K.ops.dup(l), split: () => K.ops.split(l, t), merge: () => K.ops.merge(l), del: () => K.ops.del(l),
        autoShow: () => K.ops.set(l, 'showAt', null), autoHide: () => K.ops.set(l, 'hideAt', null), furi: () => K.autoFurigana('line'),
        evenSyl: () => K.ops.evenSyl(l), sylReset: () => K.ops.sylReset(l) }[d.a] || (() => {}))();
    });
    /* 右键音节行 = 音节菜单 */
    el.addEventListener('contextmenu', (e) => { const tr = e.target.closest('tr[data-g]'), l = K.sel(); if (!tr || !l) return; e.preventDefault(); K.sylMenu(l, +tr.dataset.g, e.clientX, e.clientY); });
  }

  /* ---------- 设置表单 ---------- */
  /* label / opts / hint 都是翻译 key，建表单时再翻译 */
  const R = (k, label, min, max, step, dec) => ({ k, label, type: 'range', min, max, step, dec });
  const FORMS = {
    'tab-style': [
      ['f.font'],
      { html: () => `<div class="row"><label>${et('f.font')}</label><select id="fontPick"></select></div>` },
      { k: 'font', label: 'f.fontCss', type: 'text' },
      { html: () => `<div class="btns ind"><button id="bFonts">${et('f.sysFonts')}</button><button id="bFontFile">${et('f.fontFile')}</button><input id="fFont" type="file" accept=".ttf,.otf,.woff,.woff2" hidden></div>` },
      { k: 'weight', label: 'f.weight', type: 'select', opts: [['normal', 'f.wNormal'], ['bold', 'f.wBold'], ['900', 'f.wBlack']] },
      R('size', 'f.size', 20, 320, 1), R('rubyRatio', 'f.rubyRatio', 0.2, 0.8, 0.01), R('rubyGap', 'f.rubyGap', -20, 60, 1), R('spacing', 'f.spacing', -10, 40, 1),
      ['f.colors'],
      { label: 'f.fill', type: 'colors', ks: ['baseFill', 'highFill'] }, { label: 'f.stroke', type: 'colors', ks: ['baseStroke', 'highStroke'] },
      { label: 'f.rubyFill', type: 'colors', ks: ['rubyFill', 'rubyHighFill'] }, { label: 'f.rubyStroke', type: 'colors', ks: ['rubyStroke', 'rubyHighStroke'] },
      R('strokeW', 'f.strokeW', 0, 30, 0.5), R('rubyStrokeW', 'f.rubyStrokeW', 0, 20, 0.5),
      { label: 'f.glowColor', type: 'colors', ks: ['glowColor'] }, R('glow', 'f.glow', 0, 60, 1),
      ['f.bg'],
      { k: 'bgMode', label: 'f.bgMode', type: 'select', opts: [['transparent', 'f.bgNone'], ['color', 'f.bgColor']] },
      { label: 'f.bgColors', type: 'colors', ks: ['bgColor', 'keyColor'] },
      { k: 'useVideoBg', label: 'f.videoBg', type: 'check', hint: 'f.videoBgHint' },
    ],
    'tab-layout': [
      ['f.canvas'],
      { label: 'f.size2', type: 'nums', ks: ['W', 'H'], min: 160, max: 7680, step: 2 },
      { k: 'layout', label: 'f.layout', type: 'select', opts: [['duet', 'f.duet'], ['stack', 'f.stack']] },
      { k: 'rows', label: 'f.rows', type: 'select', opts: [1, 2, 3].map((n) => [n, () => T(n === 1 ? 'f.rowsOne' : 'f.rowsN', { n })]), num: true },
      R('posY', 'f.posY', 0.1, 0.98, 0.005), R('lineGap', 'f.lineGap', 0, 1.5, 0.01), R('wrapGap', 'f.wrapGap', 0, 1.5, 0.01), R('marginX', 'f.marginX', 0, 0.3, 0.005), R('maxW', 'f.maxW', 0.3, 1, 0.01),
      ['f.showHide'],
      R('preShow', 'f.preShow', 0.5, 20, 0.5), R('lead', 'f.lead', 0, 3, 0.05), R('hold', 'f.hold', 0, 3, 0.05),
      { label: 'f.fade', type: 'nums', ks: ['fadeIn', 'fadeOut'], min: 0, max: 2, step: 0.05 },
      ['f.paraDots'],
      R('paraGap', 'f.paraGap', 1, 15, 0.5),
      { k: 'dots', label: 'f.dots', type: 'check', hint: 'f.dotsHint' },
      R('dotsDur', 'f.dotsDur', 1.5, 6, 0.5), R('dotSize', 'f.dotSize', 0.15, 0.7, 0.01),
      { k: 'dotPos', label: 'f.dotPos', type: 'select', opts: [['top', 'f.dotTop'], ['left', 'f.dotLeft']] },
      { label: 'f.dotColors', type: 'colors', ks: ['dotFill', 'dotHighFill'], opt: 1 },
      ['f.sync'],
      R('offset', 'f.offset', -2, 2, 0.01),
    ],
  };
  const fv = (v, dec) => (dec ? (+v).toFixed(dec) : Math.abs(v) < 10 && v % 1 ? (+v).toFixed(2) : String(+(+v).toFixed(1)));
  /* 一个表单项 → HTML。样式 / 版面标签页和“本行独立样式”共用：
     val(k) = 显示的值；A(k, 第几个输入框) = 绑定属性（全局 data-s，行属性 data-o）；row(f, 内容) = 包成一行（行属性那边加上“恢复全局”按钮） */
  const optLabel = (o) => (typeof o === 'function' ? o() : T(o));
  const fieldHtml = (f, val, A, row) => {
    const V = (k) => esc(val(k)), lab = `<label title="${et(f.label)}">${et(f.label)}</label>`;
    let inner = null;
    if (f.type === 'range') inner = `<input ${A(f.k)} type="range" min="${f.min}" max="${f.max}" step="${f.step}" value="${V(f.k)}"><input ${A(f.k, 1)} data-num="1" class="v" type="number" min="${f.min}" max="${f.max}" step="${f.step}" value="${esc(fv(val(f.k), f.dec))}">`;
    else if (f.type === 'text') inner = `<input ${A(f.k)} type="text" value="${V(f.k)}">`;
    else if (f.type === 'select') inner = `<select ${A(f.k)} ${f.num ? 'data-num="1"' : ''}>${f.opts.map((o) => opt(o[0], val(f.k), optLabel(o[1]))).join('')}</select>`;
    else if (f.type === 'check') inner = `<input ${A(f.k)} type="checkbox" ${val(f.k) ? 'checked' : ''}><span class="hint">${f.hint ? et(f.hint) : ''}</span>`;
    else if (f.type === 'colors') inner = f.ks.map((k, i) => `<input ${A(k, i)} type="color" value="${V(k)}">`).join('');
    else if (f.type === 'nums') inner = f.ks.map((k, i) => `<input ${A(k, i)} data-num="1" type="number" min="${f.min}" max="${f.max}" step="${f.step}" value="${V(k)}">`).join('');
    return inner == null ? '' : row(f, lab + inner);
  };
  /* 显示用的值：留空的预备点颜色显示成它实际用的颜色（歌词填充色）；行属性的位置键没设时是 LDEF */
  const shown = (E, k) => (k === 'dotFill' ? E.dotFill || E.baseFill : k === 'dotHighFill' ? E.dotHighFill || E.highFill : E[k] != null ? E[k] : K.LDEF[k]);
  /* 字体下拉：常用字体 + 载入的字体文件 + （授权后）本机全部字体 */
  const COMMON = ['Yu Gothic UI', 'Yu Gothic', 'Meiryo', 'MS Gothic', 'Yu Mincho', 'MS Mincho', 'BIZ UDGothic', 'Microsoft YaHei', 'SimHei', 'SimSun', 'KaiTi', 'Microsoft JhengHei', 'Malgun Gothic', 'Segoe UI', 'Arial', 'Arial Black', 'Impact', 'Georgia', 'Times New Roman', 'Consolas'];
  const FALLBACK = "'Yu Gothic UI', 'Meiryo', 'Microsoft YaHei', sans-serif";
  const firstFam = (font) => ((font.match(/^\s*(?:'([^']+)'|"([^"]+)"|([^,]+))/) || []).slice(1).find(Boolean) || '').trim();
  const fontOpts = (font) => {
    const cur = firstFam(font), grp = (label, arr) => (arr.length ? `<optgroup label="${et(label)}">${arr.map((f) => `<option value="${esc(f)}"${f === cur ? ' selected' : ''}>${esc(f)}</option>`).join('')}</optgroup>` : '');
    const loaded = K.userFonts || [], local = K.localFonts || [], known = new Set([...loaded, ...COMMON, ...local]);
    return (cur && !known.has(cur) ? `<option value="${esc(cur)}" selected>${et('f.current', { name: cur })}</option>` : '') + grp('f.grpLoaded', loaded) + grp('f.grpCommon', COMMON) + grp('f.grpLocal', local);
  };

  /* ---------- 本行独立样式（行属性 l.o）：同一套表单项，没覆盖的显示全局值，改了就成为这一行的覆盖 ---------- */
  const fdesc = (k) => { for (const id in FORMS) { const f = FORMS[id].find((x) => !Array.isArray(x) && (x.k === k || (x.ks && x.ks.includes(k)))); if (f) return f; } return null; };
  const LFORM = (l, I) => [
    ['line.gPos'], R('dx', 'f.dx', -0.5, 0.5, 0.001, 3), R('dy', 'f.dy', -0.5, 0.5, 0.001, 3),
    { k: 'grow', label: 'f.grow', type: 'select', opts: [['auto', () => T('f.growAuto', { d: T(K.growAuto(I) === 'up' ? 'f.growUp' : 'f.growDown') })], ['up', 'f.growUp'], ['down', 'f.growDown'], ['center', 'f.growCenter']] },
    ['line.gTextS'], 'FONT', ...['font', 'weight', 'size', 'spacing', 'maxW', 'wrapGap', 'strokeW', 'glowColor', 'glow'].map(fdesc),
    ['line.gColors'], fdesc('baseFill'), fdesc('baseStroke'),
    ['line.gRuby'], ...['rubyRatio', 'rubyGap', 'rubyFill', 'rubyStroke', 'rubyStrokeW'].map(fdesc),
    ['line.gDots'], ...['dotsDur', 'dotSize', 'dotPos', 'dotFill'].map(fdesc),
  ];
  function lineStyleHtml(l, I) {
    const E = K.LS(l), o = l.o || {}, n = Object.keys(o).length, rs = et('line.ovFieldReset');
    const open = K.pref('lsOpen') === true || (n > 0 && K.pref('lsOpen') !== false);
    const row = (f, inner, ks) => { ks = ks || (f.k ? [f.k] : f.ks); const ov = ks.some((k) => k in o);
      return `<div class="row${ov ? ' ov' : ''}">${inner}<button class="rs" data-ovr="${ks.join(',')}" title="${rs}" aria-label="${rs}"${ov ? '' : ' disabled'}>↺</button></div>`; };
    const A = (k, i) => `data-o="${k}" data-k="o.${k}${i ? '.' + i : ''}"`;
    const body = LFORM(l, I).map((f) => {
      if (Array.isArray(f)) return `<h5>${et(f[0])}</h5>`;
      if (f === 'FONT') return row({ k: 'font' }, `<label>${et('f.font')}</label><select data-of="font" data-k="o.fontPick" aria-label="${et('f.font')}">${fontOpts(E.font)}</select>`);
      return fieldHtml(f, (k) => shown(E, k), A, row);
    }).join('');
    const clip = !!K.ui.styleClip;
    return `<details class="lso"${open ? ' open' : ''}><summary class="lsoS">${et('line.gStyle')}${n ? ` <span class="ovn">${et('line.ovCount', { n })}</span>` : ''}</summary><div class="lsoBody">
      <div class="hint">${et('line.ovLead')}</div>
      <div class="btns"><button data-a="ovCopy" title="${et('line.ovCopyTip')}">${et('line.ovCopy')}</button><button data-a="ovPaste" title="${et('line.ovPasteTip')}"${clip ? '' : ' disabled'}>${et('line.ovPaste')}</button><button data-a="ovPara" title="${et('line.ovParaTip')}">${et('line.ovPara')}</button><button data-a="ovAll" title="${et('line.ovAllTip')}">${et('line.ovAll')}</button><button data-a="ovReset" class="danger" title="${et('line.ovResetTip')}"${n ? '' : ' disabled'}>${et('line.ovReset')}</button></div>
      ${body}<div class="hint">${et('line.ovPosHint')}</div></div></details>`;
  }
  /* 行属性输入：input = 实时预览（不入历史），change = 提交一步撤销 */
  function applyOv(e, commit) {
    const l = K.sel(), t = e.target, k = t.dataset.o; if (!l || !k) return;
    let v = t.type === 'checkbox' ? t.checked : t.type === 'range' || t.dataset.num ? parseFloat(t.value) : t.value;
    if (typeof v === 'number' && isNaN(v)) return;
    if (k === 'grow' && v === 'auto') v = null;
    else { v = K.cleanLineSetting(k, v); if (v === undefined && k !== 'dx' && k !== 'dy') return; }        // dx / dy = 0 → 取消覆盖
    K.setOv(l, k, v);
    const E = K.LS(l), sv = shown(E, k);
    if (commit && typeof sv === 'number' && parseFloat(t.value) !== sv) t.value = t.type === 'range' ? sv : fv(sv, t.type === 'number' ? (k === 'dx' || k === 'dy' ? 3 : 0) : 0);
    $('tab-line').querySelectorAll(`[data-o="${k}"]`).forEach((x) => { if (x !== t && x.type !== 'checkbox') x.value = x.type === 'number' && t.type === 'range' ? fv(sv, k === 'dx' || k === 'dy' ? 3 : 0) : sv; });
    if (k === 'font' || k === 'weight') K.ensureFont();
    commit ? K.commit('lineStyle') : K.touch();
  }
  /* 复制 / 粘贴 / 应用到本段 / 全部 / 恢复全局：每个都是一步撤销（复制不改数据） */
  function styleAction(l, a) {
    const sc = K.screen(), pi = sc.info.get(l.id).pi;
    if (a === 'ovCopy') { K.ui.styleClip = K.ops.styleOf(l); lineDirty = true; K.toast(T('msg.ovCopied')); }
    else if (a === 'ovPaste') { if (K.ui.styleClip) K.ops.applyStyle([l], K.ui.styleClip); }
    else if (a === 'ovPara' || a === 'ovAll') {
      const ls = sc.ord.filter((x) => x !== l && (a === 'ovAll' || sc.info.get(x.id).pi === pi));
      if (!ls.length) { K.toast(T('msg.ovNone')); return; }
      K.ops.applyStyle(ls, K.ops.styleOf(l)); K.toast(T('msg.ovApplied', { n: ls.length }), 'ok');
    } else if (a === 'ovReset') K.ops.clearStyle(l);
    K.ensureFont();
  }

  function buildForms() {
    const S = K.S(), rs = et('f.followLyric');
    Object.keys(FORMS).forEach((id) => {
      $(id).innerHTML = FORMS[id].map((f) => {
        if (Array.isArray(f)) return `<h4>${et(f[0])}</h4>`;
        if (f.html) return f.html();
        /* 留空表示“跟随歌词颜色”的颜色（预备点）：后面带一个恢复按钮 */
        return fieldHtml(f, (k) => shown(S, k), (k) => `data-s="${k}"`, (g, inner) => `<div class="row">${inner}${g.opt ? `<button class="rs" data-sreset="${g.ks.join(',')}" title="${rs}" aria-label="${rs}"${g.ks.some((k) => S[k]) ? '' : ' disabled'}>↺</button>` : ''}</div>`);
      }).join('');
      K.selTitles($(id));
    });
    const fillPick = () => { $('fontPick').innerHTML = fontOpts(K.S().font); };
    fillPick();
    $('fontPick').onchange = (e) => {
      const f = e.target.value; K.S().font = K.cleanSetting('font', `'${f.replace(/'/g, '')}', ${FALLBACK}`) || FALLBACK;
      $('tab-style').querySelector('[data-s="font"]').value = K.S().font; K.commit('settings'); K.ensureFont();
    };
    $('tab-style').querySelector('[data-s="font"]').addEventListener('change', () => setTimeout(fillPick));
    const readLocal = async (quiet) => {
      try { K.localFonts = [...new Set((await window.queryLocalFonts()).map((f) => f.family))].sort(); fillPick(); if (!quiet) K.toast(T('f.localOk', { n: K.localFonts.length })); }
      catch (e) { if (!quiet) K.toast(T('f.localDenied'), 'error'); }
    };
    $('bFonts').onclick = () => { if (!window.queryLocalFonts) { K.toast(T('f.localNA')); return; } readLocal(false); };
    if (!K.localFonts && window.queryLocalFonts && navigator.permissions) navigator.permissions.query({ name: 'local-fonts' }).then((p) => { if (p.state === 'granted') readLocal(true); }).catch(() => {});
    $('bFontFile').onclick = () => $('fFont').click();
    $('fFont').onchange = async (e) => {
      const f = e.target.files[0]; if (!f) return;
      const name = f.name.replace(/\.[^.]+$/, '').replace(/[^\w\- ]/g, '') || 'UserFont';
      try { const ff = new FontFace(name, await f.arrayBuffer()); await ff.load(); document.fonts.add(ff); }
      catch (err) { K.toast(T('f.fileFail', { name: f.name }), 'error'); return; }
      (K.userFonts = K.userFonts || []).push(name); K.S().font = K.cleanSetting('font', `'${name}', ${K.S().font}`) || K.S().font; K.commit('settings'); buildForms(); K.ensureFont(); K.toast(T('f.fileLoaded', { name }), 'ok');
    };
  }
  function formEvents() {
    ['tab-style', 'tab-layout'].forEach((id) => {
      const el = $(id);
      const apply = (e, commit) => {
        const k = e.target.dataset.s; if (!k) return;
        const S = K.S(), t = e.target;
        let v = t.type === 'checkbox' ? t.checked : t.type === 'range' || t.dataset.num ? parseFloat(t.value) : t.value;
        if (typeof v === 'number' && isNaN(v)) return;
        v = K.cleanSetting(k, v); if (v === undefined) return;     // 输入也要过范围 / 类型校验
        S[k] = v;
        if (commit && typeof v === 'number' && parseFloat(t.value) !== v) t.value = t.type === 'range' ? v : fv(v);   // 被夹到范围内时回显
        el.querySelectorAll(`[data-s="${k}"]`).forEach((o) => { if (o !== t && o.type !== 'checkbox') o.value = o.type === 'number' && t.type === 'range' ? fv(v) : v; });
        if (k === 'font' || k === 'weight') K.ensureFont();
        commit ? K.commit('settings') : K.touch();
      };
      el.addEventListener('input', (e) => apply(e, false));
      el.addEventListener('change', (e) => apply(e, true));
      el.addEventListener('click', (e) => { const r = e.target.dataset && e.target.dataset.sreset; if (!r) return; r.split(',').forEach((k) => (K.S()[k] = '')); K.commit('settings'); formsDirty = true; });
    });
  }

  let listDirty = true, lineDirty = true, formsDirty = true;
  K.initPanels = () => {
    lineEvents(); formEvents();
    $('list').addEventListener('click', (e) => { const el = e.target.closest('.li'); if (el) { K.select(el.dataset.id); const l = K.sel(); K.tlReveal(K.ls(l) + K.S().offset); } });
    $('list').addEventListener('dblclick', (e) => { const el = e.target.closest('.li'); if (el) { const l = K.line(el.dataset.id); K.seek(Math.max(0, K.ls(l) + K.S().offset - 0.5)); } });
    $('list').addEventListener('contextmenu', (e) => { const el = e.target.closest('.li'); if (el) { e.preventDefault(); K.select(el.dataset.id); K.lineMenu(K.sel(), e.clientX, e.clientY); } });
    document.querySelectorAll('#tabs button').forEach((b) => (b.onclick = () => { K.showTab(b.dataset.t); K.pref('tab', b.dataset.t); }));
    K.on('change', () => { listDirty = lineDirty = true; });
    /* 全局的预备点颜色改了以后，“恢复跟随”按钮的状态要更新 */
    K.on('change', () => { const b = document.querySelector('#tab-layout [data-sreset]'); if (b) b.disabled = !b.dataset.sreset.split(',').some((k) => K.S()[k]); });
    K.on('select', () => { listDirty = lineDirty = true; if (K.ui.sel) K.showTab('line'); });
    K.on('load', () => { formsDirty = true; });
    K.on('lang', () => { formsDirty = listDirty = lineDirty = true; lastNow = ''; $('menu').hidden = true; });
  };
  K.TABS = ['line', 'style', 'layout', 'export'];
  K.showTab = (t) => {
    if (!K.TABS.includes(t)) t = 'line';
    document.querySelectorAll('#tabs button').forEach((b) => { const on = b.dataset.t === t; b.classList.toggle('on', on); b.setAttribute('aria-selected', on); b.tabIndex = on ? 0 : -1; });
    document.querySelectorAll('.tab').forEach((p) => (p.hidden = p.id !== 'tab-' + t));
  };
  /* 下拉框显示不下的长选项：鼠标悬停时用 title 显示完整文字（自带说明 title 的除外） */
  K.selTitles = (root) => root.querySelectorAll('select:not([data-i18n-title])').forEach((s) => { const o = s.selectedOptions && s.selectedOptions[0]; s.title = o ? o.textContent : ''; });
  document.addEventListener('change', (e) => { if (e.target.tagName === 'SELECT' && !e.target.dataset.i18nTitle) K.selTitles(e.target.parentElement || document); });
  /* 每帧调用：只在有变化时重建 DOM；正在输入时不打断 */
  K.refreshPanels = () => {
    if (formsDirty) { formsDirty = false; buildForms(); }
    if (listDirty) { listDirty = false; lastNow = ''; buildList(); }
    if (lineDirty) {
      const a = document.activeElement, typing = a && $('tab-line').contains(a) && (a.tagName === 'TEXTAREA' || a.tagName === 'INPUT') && a.dataset.dirty;
      if (!typing) { lineDirty = false; buildLine(); }
    }
  };
  document.addEventListener('input', (e) => { if (e.target.closest && e.target.closest('#tab-line')) e.target.dataset.dirty = '1'; });
  document.addEventListener('change', (e) => { if (e.target.dataset) delete e.target.dataset.dirty; }, true);
})();
