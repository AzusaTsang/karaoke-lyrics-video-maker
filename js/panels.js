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
  K.lineMenu = (l, x, y) => {
    const I = K.screen().info.get(l.id), set = (k, v) => () => K.ops.set(l, k, v);
    K.menu(x, y, [
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
      null,
      [T('menu.furiLine'), () => K.autoFurigana('line')], [T('menu.furiAll'), () => K.autoFurigana('all')],
      null,
      [T('menu.del'), () => K.ops.del(l)],
    ].filter((v, i, a) => !(v === null && a[i - 1] === null)));
  };

  /* ---------- 歌词列表 ---------- */
  function buildList() {
    const sc = K.screen();
    $('list').innerHTML = sc.ord.map((l) => {
      const I = sc.info.get(l.id);
      return `<div class="li${I.para ? ' para' : ''}${l.id === K.ui.sel ? ' sel' : ''}" data-id="${esc(l.id)}"><span class="t">${fmt(K.ls(l))}</span><span class="rw${I.auto ? '' : ' man'}" title="${et(I.auto ? 'list.rowAuto' : 'list.rowManual')}">${I.row + 1}</span><span class="x">${I.dotsDur ? '<i class="dot">●●●</i> ' : ''}${esc(K.lineText(l))}</span></div>`;
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
    const nB = K.bounds(l).length, atTip = et('line.atTip'), moraTip = et('line.atMoraTip');
    el.innerHTML = `
      <h4>${et('line.gText')}</h4>
      <label class="blk" for="lnText">${et('line.text')}</label>
      <textarea id="lnText" data-k="text" rows="2" spellcheck="false">${esc(K.unitsToText(l.units))}</textarea>
      <div class="btns"><button data-a="furi" title="${et('line.furiTip')}">${et('line.furi')}</button></div>
      <h4>${et('line.gTiming')}</h4>
      <div class="row"><label>${et('line.startEnd')}</label><input data-k="start" type="number" step="0.01" value="${K.ls(l).toFixed(2)}" aria-label="${et('line.start')}"><input data-k="end" type="number" step="0.01" value="${l.end.toFixed(2)}" aria-label="${et('line.end')}"></div>
      <div class="btns ind"><button data-a="m50" title="${et('line.nudgeTip')}">−50ms</button><button data-a="p50" title="${et('line.nudgeTip')}">+50ms</button><button data-a="even" title="${et('line.evenTip')}">${et('line.even')}</button></div>
      <h4>${et('line.gDisplay')}</h4>
      <div class="row"><label>${et('line.rowAlign')}</label><select data-k="row" aria-label="${et('line.rowLabel')}">${opt('', l.row == null ? '' : 'x', T('line.rowAutoN', { n: I.row + 1 }))}${[0, 1, 2, 3].map((r) => opt(r, l.row, T('line.rowN', { n: r + 1 }))).join('')}</select>
        <select data-k="align" aria-label="${et('line.alignLabel')}">${opt('', l.align || '', T('line.alignAuto'))}${opt('left', l.align, T('line.left'))}${opt('center', l.align, T('line.center'))}${opt('right', l.align, T('line.right'))}</select></div>
      <div class="row"><label>${et('line.para')}</label><select data-k="newPara">${opt('', tri(l.newPara), T(I.para ? 'line.paraAutoY' : 'line.paraAutoN'))}${opt('1', tri(l.newPara), T('line.paraOn'))}${opt('0', tri(l.newPara), T('line.paraOff'))}</select></div>
      <div class="row"><label>${et('line.dots')}</label><select data-k="dots">${opt('', tri(l.dots), T(I.dotsDur ? 'line.dotsAutoY' : 'line.dotsAutoN'))}${opt('1', tri(l.dots), T('line.dotsOn'))}${opt('0', tri(l.dots), T('line.dotsOff'))}</select></div>
      <div class="row"><label>${et('line.show')}</label><input data-k="showAt" type="number" step="0.05" value="${I.show.toFixed(2)}"><button data-a="autoShow" ${l.showAt == null ? 'disabled' : ''}>${et(l.showAt == null ? 'line.auto' : 'line.resetAuto')}</button></div>
      <div class="row"><label>${et('line.hide')}</label><input data-k="hideAt" type="number" step="0.05" value="${I.hide.toFixed(2)}"><button data-a="autoHide" ${l.hideAt == null ? 'disabled' : ''}>${et(l.hideAt == null ? 'line.auto' : 'line.resetAuto')}</button></div>
      <h4>${et('line.gActions')}</h4>
      <div class="btns acts"><button data-a="dup">${et('line.dup')}</button><button data-a="split">${et('line.split')}</button><button data-a="merge">${et('line.merge')}</button><button data-a="del" class="danger">${et('line.del')}</button></div>
      <h4>${et('line.gChars')}</h4>
      <div class="hint">${T('line.tap_html', { cur: Math.min(K.ui.tapIdx + 1, nB), total: nB })}</div>
      <div class="tblWrap"><table><thead><tr><th scope="col">${et('line.thChar')}</th><th scope="col">${et('line.thRuby')}</th><th scope="col">${et('line.thStart')}</th><th scope="col"><span class="sr">${et('line.thSet')}</span></th></tr></thead><tbody>${(() => { const B = K.bounds(l), cur = B[K.ui.tapIdx] || {}; return l.units.map((u, i) => { const Ts = K.subTimes(l, i), ms = K.moras(u.r), bi = B.findIndex((b) => b.i === i);
        return `<tr class="${cur.i === i && !cur.j ? 'cur' : ''}"><td>${esc(u.t) || '&nbsp;'}</td><td><input data-k="r${i}" data-r="${i}" value="${esc(u.r || '')}" aria-label="${et('line.rubyFor', { c: u.t })}"></td><td><input data-k="s${i}" data-b="${bi}" type="number" step="0.01" value="${u.s.toFixed(2)}" aria-label="${et('line.startFor', { c: u.t })}"></td><td><button data-n="${bi}" title="${atTip}" aria-label="${atTip}">＠</button></td></tr>` +
          ms.slice(1).map((m, q) => `<tr class="sub${cur.i === i && cur.j === q + 1 ? ' cur' : ''}"><td></td><td class="mora">└ ${esc(m)}</td><td><input data-k="b${bi + q + 1}" data-b="${bi + q + 1}" type="number" step="0.01" value="${Ts[q + 1].toFixed(2)}" aria-label="${et('line.startFor', { c: m })}"></td><td><button data-n="${bi + q + 1}" title="${moraTip}" aria-label="${moraTip}">＠</button></td></tr>`).join(''); }).join(''); })()}</tbody></table></div>`;
    K.selTitles(el);
    if (foc) { const f = el.querySelector(`[data-k="${foc}"]`); if (f) f.focus(); }
  }
  function lineEvents() {
    const el = $('tab-line');
    el.addEventListener('change', (e) => {
      const l = K.sel(), d = e.target.dataset, v = e.target.value; if (!l) return;
      if (d.k === 'text') { if (K.retext(l, v)) K.commit('text'); else buildLine(); }
      else if (d.k === 'start') K.ops.shift(l, parseFloat(v) - K.ls(l));
      else if (d.k === 'end') { l.end = parseFloat(v) || l.end; K.fixLine(l); K.commit('timing'); }
      else if (d.k === 'row') K.ops.set(l, 'row', v === '' ? null : +v);
      else if (d.k === 'align') K.ops.set(l, 'align', v || null);
      else if (d.k === 'newPara') K.ops.set(l, 'newPara', untri(v));
      else if (d.k === 'dots') K.ops.set(l, 'dots', untri(v));
      else if (d.k === 'showAt') K.ops.set(l, 'showAt', Math.min(parseFloat(v), K.ls(l) - 0.05));
      else if (d.k === 'hideAt') K.ops.set(l, 'hideAt', Math.max(parseFloat(v), K.ls(l) + 0.1));
      else if (d.r != null) { l.units[+d.r].r = v || null; K.commit('text'); }
      else if (d.b != null) { const b = K.bounds(l)[+d.b]; if (b && !isNaN(parseFloat(v))) { K.setBoundary(l, b.i, b.j, parseFloat(v)); K.commit('timing'); } }
    });
    el.addEventListener('click', (e) => {
      const l = K.sel(), d = e.target.dataset; if (!l) return;
      const t = K.now() - K.S().offset;
      if (d.n != null) { K.ui.tapIdx = +d.n; K.ops.tap(K.r3(t)); return; }
      ({ m50: () => K.ops.shift(l, -0.05), p50: () => K.ops.shift(l, 0.05), even: () => K.ops.even(l), dup: () => K.ops.dup(l), split: () => K.ops.split(l, t), merge: () => K.ops.merge(l), del: () => K.ops.del(l),
        autoShow: () => K.ops.set(l, 'showAt', null), autoHide: () => K.ops.set(l, 'hideAt', null), furi: () => K.autoFurigana('line') }[d.a] || (() => {}))();
    });
  }

  /* ---------- 设置表单 ---------- */
  /* label / opts / hint 都是翻译 key，建表单时再翻译 */
  const R = (k, label, min, max, step) => ({ k, label, type: 'range', min, max, step });
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
      R('posY', 'f.posY', 0.1, 0.98, 0.005), R('lineGap', 'f.lineGap', 0, 1.5, 0.01), R('marginX', 'f.marginX', 0, 0.3, 0.005), R('maxW', 'f.maxW', 0.3, 1, 0.01),
      ['f.showHide'],
      R('preShow', 'f.preShow', 0.5, 20, 0.5), R('lead', 'f.lead', 0, 3, 0.05), R('hold', 'f.hold', 0, 3, 0.05),
      { label: 'f.fade', type: 'nums', ks: ['fadeIn', 'fadeOut'], min: 0, max: 2, step: 0.05 },
      ['f.paraDots'],
      R('paraGap', 'f.paraGap', 1, 15, 0.5),
      { k: 'dots', label: 'f.dots', type: 'check', hint: 'f.dotsHint' },
      R('dotsDur', 'f.dotsDur', 1.5, 6, 0.5), R('dotSize', 'f.dotSize', 0.15, 0.7, 0.01),
      ['f.sync'],
      R('offset', 'f.offset', -2, 2, 0.01),
    ],
  };
  const fv = (v) => (Math.abs(v) < 10 && v % 1 ? (+v).toFixed(2) : String(+(+v).toFixed(1)));
  function buildForms() {
    const S = K.S(), V = (k) => esc(S[k]);
    Object.keys(FORMS).forEach((id) => {
      $(id).innerHTML = FORMS[id].map((f) => {
        if (Array.isArray(f)) return `<h4>${et(f[0])}</h4>`;
        if (f.html) return f.html();
        const lab = `<label title="${et(f.label)}">${et(f.label)}</label>`;
        if (f.type === 'range') return `<div class="row">${lab}<input data-s="${f.k}" type="range" min="${f.min}" max="${f.max}" step="${f.step}" value="${V(f.k)}"><input data-s="${f.k}" data-num="1" class="v" type="number" min="${f.min}" max="${f.max}" step="${f.step}" value="${esc(fv(S[f.k]))}"></div>`;
        if (f.type === 'text') return `<div class="row">${lab}<input data-s="${f.k}" type="text" value="${V(f.k)}"></div>`;
        if (f.type === 'select') return `<div class="row">${lab}<select data-s="${f.k}" ${f.num ? 'data-num="1"' : ''}>${f.opts.map((o) => opt(o[0], S[f.k], typeof o[1] === 'function' ? o[1]() : T(o[1]))).join('')}</select></div>`;
        if (f.type === 'check') return `<div class="row">${lab}<input data-s="${f.k}" type="checkbox" ${S[f.k] ? 'checked' : ''}><span class="hint">${f.hint ? et(f.hint) : ''}</span></div>`;
        if (f.type === 'colors') return `<div class="row">${lab}${f.ks.map((k) => `<input data-s="${k}" type="color" value="${V(k)}">`).join('')}</div>`;
        if (f.type === 'nums') return `<div class="row">${lab}${f.ks.map((k) => `<input data-s="${k}" data-num="1" type="number" min="${f.min}" max="${f.max}" step="${f.step}" value="${V(k)}">`).join('')}</div>`;
        return '';
      }).join('');
      K.selTitles($(id));
    });
    /* 字体下拉：常用字体 + 载入的字体文件 + （授权后）本机全部字体 */
    const COMMON = ['Yu Gothic UI', 'Yu Gothic', 'Meiryo', 'MS Gothic', 'Yu Mincho', 'MS Mincho', 'BIZ UDGothic', 'Microsoft YaHei', 'SimHei', 'SimSun', 'KaiTi', 'Microsoft JhengHei', 'Malgun Gothic', 'Segoe UI', 'Arial', 'Arial Black', 'Impact', 'Georgia', 'Times New Roman', 'Consolas'];
    const FALLBACK = "'Yu Gothic UI', 'Meiryo', 'Microsoft YaHei', sans-serif";
    const firstFam = () => ((K.S().font.match(/^\s*(?:'([^']+)'|"([^"]+)"|([^,]+))/) || []).slice(1).find(Boolean) || '').trim();
    const fillPick = () => {
      const cur = firstFam(), grp = (label, arr) => (arr.length ? `<optgroup label="${et(label)}">${arr.map((f) => `<option value="${esc(f)}"${f === cur ? ' selected' : ''}>${esc(f)}</option>`).join('')}</optgroup>` : '');
      const loaded = K.userFonts || [], local = K.localFonts || [], known = new Set([...loaded, ...COMMON, ...local]);
      $('fontPick').innerHTML = (cur && !known.has(cur) ? `<option value="${esc(cur)}" selected>${et('f.current', { name: cur })}</option>` : '') + grp('f.grpLoaded', loaded) + grp('f.grpCommon', COMMON) + grp('f.grpLocal', local);
    };
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
