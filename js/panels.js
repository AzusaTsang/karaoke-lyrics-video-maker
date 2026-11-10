/* 左侧歌词列表、右侧属性面板（行 / 样式 / 版面 / 导出）、右键菜单 */
(function () {
  const K = window.K, $ = (id) => document.getElementById(id);
  const esc = (s) => String(s).replace(/[&<>"]/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[m]));
  const fmt = (t) => { const m = Math.floor(t / 60); return m + ':' + (t % 60).toFixed(2).padStart(5, '0'); };
  K.fmt = fmt;

  /* ---------- 右键菜单 ---------- */
  K.menu = (x, y, items) => {
    const m = $('menu'); m.innerHTML = '';
    items.forEach((it) => {
      if (!it) { m.appendChild(document.createElement('hr')); return; }
      const b = document.createElement('button'); b.textContent = it[0]; if (it[2]) b.classList.add('on');
      b.onclick = () => { m.hidden = true; it[1](); }; m.appendChild(b);
    });
    m.hidden = false;
    m.style.left = Math.min(x, innerWidth - m.offsetWidth - 8) + 'px'; m.style.top = Math.min(y, innerHeight - m.offsetHeight - 8) + 'px';
  };
  addEventListener('pointerdown', (e) => { const m = $('menu'); if (!m.hidden && !m.contains(e.target)) m.hidden = true; }, true);
  K.lineMenu = (l, x, y) => {
    const I = K.screen().info.get(l.id), set = (k, v) => () => K.ops.set(l, k, v);
    K.menu(x, y, [
      [I.para ? '✓ 新段落从这里开始' : '在此分段（下一段另起，不提前显示）', set('newPara', I.para ? (l.newPara === true ? null : false) : true), I.para],
      l.newPara != null ? ['分段恢复自动', set('newPara', null)] : null,
      null,
      ['预备点：自动', set('dots', null), l.dots == null], ['预备点：显示', set('dots', true), l.dots === true], ['预备点：不显示', set('dots', false), l.dots === false],
      null,
      ['行位：自动', set('row', null), l.row == null], ['行位：第 1 行', set('row', 0), l.row === 0], ['行位：第 2 行', set('row', 1), l.row === 1], ['行位：第 3 行', set('row', 2), l.row === 2], ['行位：第 4 行', set('row', 3), l.row === 3],
      null,
      ['复制为和声行（同时显示、同时擦除）', () => K.ops.dup(l)],
      ['在播放头处拆分', () => K.ops.split(l, K.now() - K.S().offset)],
      ['与下一行合并', () => K.ops.merge(l)],
      ['显示 / 消失时间恢复自动', () => { l.showAt = null; l.hideAt = null; K.commit(); }],
      null,
      ['删除这一行', () => K.ops.del(l)],
    ].filter((v, i, a) => !(v === null && a[i - 1] === null)));
  };

  /* ---------- 歌词列表 ---------- */
  function buildList() {
    const sc = K.screen();
    $('list').innerHTML = sc.ord.map((l) => {
      const I = sc.info.get(l.id);
      return `<div class="li${I.para ? ' para' : ''}${l.id === K.ui.sel ? ' sel' : ''}" data-id="${l.id}"><span class="t">${fmt(K.ls(l))}</span><span class="rw${I.auto ? '' : ' man'}" title="行位${I.auto ? '（自动）' : '（手动）'}">${I.row + 1}</span><span class="x">${I.dotsDur ? '<i class="dot">●●●</i> ' : ''}${esc(K.lineText(l))}</span></div>`;
    }).join('') || '<div class="hint pad">还没有歌词。用上方「导入」载入 SRT，或在时间线空白处右键添加。</div>';
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
  const opt = (v, cur, label) => `<option value="${v}"${String(cur) === String(v) ? ' selected' : ''}>${label}</option>`;
  function buildLine() {
    const l = K.sel(), el = $('tab-line');
    if (!l) { el.innerHTML = '<div class="hint pad">在预览、时间线或左侧列表里点选一行歌词。<br><br>· 预览里拖动<b>擦除光标</b>（竖线+圆点）可直接校时<br>· 时间线里拖动块 = 整行平移；拖下半部的小竖线 = 调单个字<br>· 拖块两侧的细边 = 这一行何时出现 / 消失<br>· 右键块 = 分段、预备点、和声行、拆分合并</div>'; return; }
    const I = K.screen().info.get(l.id), foc = document.activeElement && el.contains(document.activeElement) ? document.activeElement.dataset.k : null;
    el.innerHTML = `
      <label class="blk">歌词（注音写法：漢字{かんじ}）</label>
      <textarea data-k="text" rows="2" spellcheck="false">${esc(K.unitsToText(l.units))}</textarea>
      <div class="row"><label>开始 / 结束</label><input data-k="start" type="number" step="0.01" value="${K.ls(l).toFixed(2)}"><input data-k="end" type="number" step="0.01" value="${l.end.toFixed(2)}"></div>
      <div class="row"><label>行位 / 对齐</label><select data-k="row">${opt('', l.row == null ? '' : 'x', '自动（第' + (I.row + 1) + '行）')}${[0, 1, 2, 3].map((r) => opt(r, l.row, '第 ' + (r + 1) + ' 行')).join('')}</select>
        <select data-k="align">${opt('', l.align || '', '自动')}${opt('left', l.align, '靠左')}${opt('center', l.align, '居中')}${opt('right', l.align, '靠右')}</select></div>
      <div class="row"><label>分段</label><select data-k="newPara">${opt('', tri(l.newPara), '自动（' + (I.para ? '是' : '否') + '）')}${opt('1', tri(l.newPara), '在此分段')}${opt('0', tri(l.newPara), '不分段')}</select></div>
      <div class="row"><label>预备点</label><select data-k="dots">${opt('', tri(l.dots), '自动（' + (I.dotsDur ? '有' : '无') + '）')}${opt('1', tri(l.dots), '显示')}${opt('0', tri(l.dots), '不显示')}</select></div>
      <div class="row"><label>出现时间</label><input data-k="showAt" type="number" step="0.05" value="${I.show.toFixed(2)}"><button data-a="autoShow" ${l.showAt == null ? 'disabled' : ''}>${l.showAt == null ? '自动' : '恢复自动'}</button></div>
      <div class="row"><label>消失时间</label><input data-k="hideAt" type="number" step="0.05" value="${I.hide.toFixed(2)}"><button data-a="autoHide" ${l.hideAt == null ? 'disabled' : ''}>${l.hideAt == null ? '自动' : '恢复自动'}</button></div>
      <div class="btns"><button data-a="m50">−50ms</button><button data-a="p50">+50ms</button><button data-a="even">逐字等分</button><button data-a="dup">复制为和声行</button><button data-a="split">播放头处拆分</button><button data-a="merge">合并下一行</button><button data-a="del" class="danger">删除</button></div>
      <div class="hint">打点校时：播放时按 <kbd>T</kbd>，每按一次给下一个字打上开始时间（当前第 ${Math.min(K.ui.tapIdx + 1, l.units.length)} / ${l.units.length} 个字，最后再按一次 = 行结束并跳到下一行）。</div>
      <table><thead><tr><th>字</th><th>注音</th><th>开始(s)</th><th></th></tr></thead><tbody>${l.units.map((u, i) => `<tr class="${i === K.ui.tapIdx ? 'cur' : ''}"><td>${esc(u.t) || '&nbsp;'}</td><td><input data-k="r${i}" data-r="${i}" value="${esc(u.r || '')}"></td><td><input data-k="s${i}" data-s="${i}" type="number" step="0.01" value="${u.s.toFixed(2)}"></td><td><button data-n="${i}" title="把这个字的开始设为当前播放时间">＠</button></td></tr>`).join('')}</tbody></table>`;
    if (foc) { const f = el.querySelector(`[data-k="${foc}"]`); if (f) f.focus(); }
  }
  function lineEvents() {
    const el = $('tab-line');
    el.addEventListener('change', (e) => {
      const l = K.sel(), d = e.target.dataset, v = e.target.value; if (!l) return;
      if (d.k === 'text') { if (K.retext(l, v)) K.commit(); else buildLine(); }
      else if (d.k === 'start') K.ops.shift(l, parseFloat(v) - K.ls(l));
      else if (d.k === 'end') { l.end = parseFloat(v) || l.end; K.fixLine(l); K.commit(); }
      else if (d.k === 'row') K.ops.set(l, 'row', v === '' ? null : +v);
      else if (d.k === 'align') K.ops.set(l, 'align', v || null);
      else if (d.k === 'newPara') K.ops.set(l, 'newPara', untri(v));
      else if (d.k === 'dots') K.ops.set(l, 'dots', untri(v));
      else if (d.k === 'showAt') K.ops.set(l, 'showAt', Math.min(parseFloat(v), K.ls(l) - 0.05));
      else if (d.k === 'hideAt') K.ops.set(l, 'hideAt', Math.max(parseFloat(v), K.ls(l) + 0.1));
      else if (d.r != null) { l.units[+d.r].r = v || null; K.commit(); }
      else if (d.s != null) { const i = +d.s; l.units[i].s = parseFloat(v) || 0; delete l.units[i].e; for (let k = i + 1; k < l.units.length; k++) if (l.units[k].s < l.units[i].s) l.units[k].s = l.units[i].s; for (let k = 0; k < i; k++) if (l.units[k].s > l.units[i].s) l.units[k].s = l.units[i].s; K.fixLine(l); K.commit(); }
    });
    el.addEventListener('click', (e) => {
      const l = K.sel(), d = e.target.dataset; if (!l) return;
      const t = K.now() - K.S().offset;
      if (d.n != null) { K.ui.tapIdx = +d.n; K.ops.tap(K.r3(t)); return; }
      ({ m50: () => K.ops.shift(l, -0.05), p50: () => K.ops.shift(l, 0.05), even: () => K.ops.even(l), dup: () => K.ops.dup(l), split: () => K.ops.split(l, t), merge: () => K.ops.merge(l), del: () => K.ops.del(l),
        autoShow: () => K.ops.set(l, 'showAt', null), autoHide: () => K.ops.set(l, 'hideAt', null) }[d.a] || (() => {}))();
    });
  }

  /* ---------- 设置表单 ---------- */
  const R = (k, label, min, max, step) => ({ k, label, type: 'range', min, max, step });
  const FORMS = {
    'tab-style': [
      ['字体'],
      { k: 'font', label: '字体族', type: 'text', list: 'fontList' },
      { html: '<div class="row"><label></label><button id="bFonts">读取本机字体</button><button id="bFontFile">载入字体文件…</button><input id="fFont" type="file" accept=".ttf,.otf,.woff,.woff2" hidden></div>' },
      { k: 'weight', label: '字重', type: 'select', opts: [['normal', '常规'], ['bold', '粗体'], ['900', '特粗']] },
      R('size', '字号', 20, 320, 1), R('rubyRatio', '注音比例', 0.2, 0.8, 0.01), R('rubyGap', '注音间距', -20, 60, 1), R('spacing', '字间距', -10, 40, 1),
      ['颜色（未唱 / 已唱）'],
      { label: '歌词填充', type: 'colors', ks: ['baseFill', 'highFill'] }, { label: '歌词描边', type: 'colors', ks: ['baseStroke', 'highStroke'] },
      { label: '注音填充', type: 'colors', ks: ['rubyFill', 'rubyHighFill'] }, { label: '注音描边', type: 'colors', ks: ['rubyStroke', 'rubyHighStroke'] },
      R('strokeW', '描边粗细', 0, 30, 0.5), R('rubyStrokeW', '注音描边', 0, 20, 0.5),
      { label: '辉光', type: 'colors', ks: ['glowColor'] }, R('glow', '辉光强度', 0, 60, 1),
      ['背景'],
      { k: 'bgMode', label: '模式', type: 'select', opts: [['transparent', '透明（棋盘格）'], ['color', '纯色']] },
      { label: '纯色 / 抠像色', type: 'colors', ks: ['bgColor', 'keyColor'] },
      { k: 'useVideoBg', label: '视频作背景', type: 'check', hint: '仅预览 / 录屏' },
    ],
    'tab-layout': [
      ['画面'],
      { label: '画布 W×H', type: 'nums', ks: ['W', 'H'], min: 160, max: 7680, step: 2 },
      { k: 'layout', label: '多行版式', type: 'select', opts: [['duet', '左右交错（1左 2右 3中）'], ['stack', '全部居中']] },
      { k: 'rows', label: '自动行数', type: 'select', opts: [[1, '1 行'], [2, '2 行'], [3, '3 行']], num: true },
      R('posY', '第 1 行基线', 0.1, 0.98, 0.005), R('lineGap', '行距', 0, 1.5, 0.01), R('marginX', '左右边距', 0, 0.3, 0.005), R('maxW', '最大宽度', 0.3, 1, 0.01),
      ['出现与消失'],
      R('preShow', '最早提前显示(s)', 0.5, 20, 0.5), R('lead', '最少提前(s)', 0, 3, 0.05), R('hold', '唱完保留(s)', 0, 3, 0.05),
      { label: '淡入 / 淡出(s)', type: 'nums', ks: ['fadeIn', 'fadeOut'], min: 0, max: 2, step: 0.05 },
      ['段落与预备点'],
      R('paraGap', '自动分段间隔(s)', 1, 15, 0.5),
      { k: 'dots', label: '预备点', type: 'check', hint: '每段开头倒数三个点' },
      R('dotsDur', '倒数时长(s)', 1.5, 6, 0.5), R('dotSize', '圆点大小', 0.15, 0.7, 0.01),
      ['同步'],
      R('offset', '整体偏移(s)', -2, 2, 0.01),
    ],
  };
  const fv = (v) => (Math.abs(v) < 10 && v % 1 ? (+v).toFixed(2) : String(+(+v).toFixed(1)));
  function buildForms() {
    const S = K.S();
    Object.keys(FORMS).forEach((id) => {
      $(id).innerHTML = FORMS[id].map((f) => {
        if (Array.isArray(f)) return `<h4>${f[0]}</h4>`;
        if (f.html) return f.html;
        if (f.type === 'range') return `<div class="row"><label>${f.label}</label><input data-s="${f.k}" type="range" min="${f.min}" max="${f.max}" step="${f.step}" value="${S[f.k]}"><input data-s="${f.k}" data-num="1" class="v" type="number" min="${f.min}" max="${f.max}" step="${f.step}" value="${fv(S[f.k])}"></div>`;
        if (f.type === 'text') return `<div class="row"><label>${f.label}</label><input data-s="${f.k}" type="text" ${f.list ? `list="${f.list}"` : ''} value="${esc(S[f.k])}"></div>`;
        if (f.type === 'select') return `<div class="row"><label>${f.label}</label><select data-s="${f.k}" ${f.num ? 'data-num="1"' : ''}>${f.opts.map((o) => opt(o[0], S[f.k], o[1])).join('')}</select></div>`;
        if (f.type === 'check') return `<div class="row"><label>${f.label}</label><input data-s="${f.k}" type="checkbox" ${S[f.k] ? 'checked' : ''}><span class="hint">${f.hint || ''}</span></div>`;
        if (f.type === 'colors') return `<div class="row"><label>${f.label}</label>${f.ks.map((k) => `<input data-s="${k}" type="color" value="${S[k]}">`).join('')}</div>`;
        if (f.type === 'nums') return `<div class="row"><label>${f.label}</label>${f.ks.map((k) => `<input data-s="${k}" data-num="1" type="number" min="${f.min}" max="${f.max}" step="${f.step}" value="${S[k]}">`).join('')}</div>`;
        return '';
      }).join('');
    });
    $('fontList').innerHTML = (K.localFonts || []).map((f) => `<option value="'${esc(f)}'">`).join('');
    $('bFonts').onclick = async () => {
      if (!window.queryLocalFonts) { K.toast('当前浏览器不支持读取本机字体，请直接输入字体名或载入字体文件'); return; }
      try { K.localFonts = [...new Set((await window.queryLocalFonts()).map((f) => f.family))].sort(); $('fontList').innerHTML = K.localFonts.map((f) => `<option value="'${esc(f)}'">`).join(''); K.toast(`已读取 ${K.localFonts.length} 个字体，点「字体族」输入框从下拉里选`); } catch (e) { K.toast('读取字体被拒绝'); }
    };
    $('bFontFile').onclick = () => $('fFont').click();
    $('fFont').onchange = async (e) => {
      const f = e.target.files[0]; if (!f) return;
      const name = f.name.replace(/\.[^.]+$/, '').replace(/[^\w\- ]/g, '') || 'UserFont';
      const ff = new FontFace(name, await f.arrayBuffer()); await ff.load(); document.fonts.add(ff);
      K.S().font = `'${name}', ${K.S().font}`; K.commit(); buildForms(); K.ensureFont(); K.toast(`已载入字体「${name}」（字体文件不会存进工程，下次需重新载入或安装到系统）`);
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
        S[k] = v;
        el.querySelectorAll(`[data-s="${k}"]`).forEach((o) => { if (o !== t && o.type !== 'checkbox') o.value = o.type === 'number' && t.type === 'range' ? fv(v) : v; });
        if (k === 'font' || k === 'weight') K.ensureFont();
        commit ? K.commit() : K.touch();
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
    document.querySelectorAll('#tabs button').forEach((b) => (b.onclick = () => K.showTab(b.dataset.t)));
    K.on('change', () => { listDirty = lineDirty = true; });
    K.on('select', () => { listDirty = lineDirty = true; if (K.ui.sel) K.showTab('line'); });
    K.on('load', () => { formsDirty = true; });
  };
  K.showTab = (t) => { document.querySelectorAll('#tabs button').forEach((b) => b.classList.toggle('on', b.dataset.t === t)); document.querySelectorAll('.tab').forEach((p) => (p.hidden = p.id !== 'tab-' + t)); };
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
