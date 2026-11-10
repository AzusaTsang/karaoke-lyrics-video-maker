/* 对话框（模态：焦点锁在里面，Esc 取消，Enter = 默认按钮）、可堆叠的提示条、拖动时的数值提示、欢迎页与空状态 */
(function () {
  const K = window.K, $ = (id) => document.getElementById(id), T = (k, p) => K.t(k, p), esc = K.esc, et = (k, p) => esc(T(k, p));

  /* ---------- 模态对话框 ----------
     K.dialog({ render: () => ({ title, html, buttons: [{ label, value, pri, danger }] }), cancel, cls, light, focus: 初始焦点选择器, onPaint(el, close) }) → Promise(按下的 value)
     render 在切换界面语言时会重新调用（订阅在关闭时取消）。html 由调用方负责转义。 */
  const stack = []; let seq = 0;
  K.modalOpen = () => stack.length > 0;
  const FOC = 'button:not([disabled]), a[href], input:not([disabled]):not([type=hidden]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
  K.dialog = (o) => new Promise((resolve) => {
    const d = document.createElement('dialog'), id = 'dlg' + ++seq, prev = document.activeElement;
    d.className = 'dlg ' + (o.cls || ''); d.setAttribute('aria-labelledby', id + 't'); d.setAttribute('aria-describedby', id + 'b');
    let buttons = [];
    const paint = () => {
      const r = o.render(); buttons = r.buttons || [];
      const fi = [...d.querySelectorAll(FOC)].indexOf(document.activeElement), inBody = document.activeElement && document.activeElement.classList.contains('dbody') && d.contains(document.activeElement);
      d.innerHTML = `<div class="dhead"><h2 id="${id}t">${esc(r.title)}</h2><button class="x" data-x="1" aria-label="${et('dlg.close')}" title="${et('dlg.close')}">×</button></div>` +
        `<div class="dbody" id="${id}b" tabindex="-1">${r.html}</div>` +
        (buttons.length ? `<div class="dacts">${buttons.map((b, i) => `<button data-i="${i}" class="${b.pri ? 'pri' : ''}${b.danger ? ' danger' : ''}">${esc(b.label)}</button>`).join('')}</div>` : '');
      if (fi >= 0) { const f = d.querySelectorAll(FOC)[fi]; if (f) f.focus(); } else if (inBody) d.querySelector('.dbody').focus();      // 重画后焦点留在原处
      if (o.onPaint) o.onPaint(d, close);
    };
    const unLang = K.on('lang', paint);
    const close = (v) => {
      const k = stack.indexOf(d); if (k < 0) return;
      stack.splice(k, 1); unLang();
      try { if (d.open && d.close) d.close(); } catch (e) {}
      d.remove();
      if (prev && prev.focus && document.contains(prev) && prev !== document.body) prev.focus();
      resolve(v);
    };
    d.addEventListener('click', (e) => {
      const b = e.target.closest && e.target.closest('button'); if (!b || !d.contains(b)) return;
      if (b.dataset.x) close(o.cancel);
      else if (b.dataset.i != null) { const B = buttons[+b.dataset.i]; close(B.value); }
    });
    d.addEventListener('mousedown', (e) => { if (o.light && e.target === d) close(o.cancel); });   // 点对话框外的遮罩
    d.addEventListener('cancel', (e) => { e.preventDefault(); close(o.cancel); });
    d.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Escape') { e.preventDefault(); close(o.cancel); return; }
      if (e.key === 'Tab') {                               // 焦点锁定：Tab 在对话框内循环
        const f = [...d.querySelectorAll(FOC)].filter((x) => x.offsetParent !== null); if (!f.length) return;
        const i = f.indexOf(document.activeElement);
        if (e.shiftKey && i <= 0) { e.preventDefault(); f[f.length - 1].focus(); } else if (!e.shiftKey && i === f.length - 1) { e.preventDefault(); f[0].focus(); }
        return;
      }
      if (e.key === 'Enter' && !e.isComposing) {
        const t = e.target; if (/^(TEXTAREA|BUTTON|A|SELECT)$/.test(t.tagName)) return;
        const di = buttons.findIndex((b) => b.pri); if (di >= 0) { e.preventDefault(); close(buttons[di].value); }
      }
    });
    stack.push(d); document.body.appendChild(d); paint();
    if (d.showModal) { try { d.showModal(); } catch (e) { d.setAttribute('open', ''); } } else d.setAttribute('open', '');
    const f0 = (o.focus && d.querySelector(o.focus)) || d.querySelector('.dacts .pri') || d.querySelector('.dbody ' + FOC.split(',')[0]) || d.querySelector(FOC);
    if (f0) f0.focus();
    if (o.onOpen) o.onOpen(d, close);
  });
  /* 替代 confirm()：K.confirm({ title, body, ok, danger }) → Promise(true/false)。title/body/ok 是翻译 key */
  K.confirm = (o) => K.dialog({ cls: 'small', cancel: false, render: () => ({ title: T(o.title), html: `<p>${et(o.body, o.p)}</p>`,
    buttons: [{ label: T('dlg.cancel'), value: false }, { label: T(o.ok || 'dlg.ok'), value: true, pri: true, danger: !!o.danger }] }) });
  /* 有未保存修改时才问：要不要丢掉它们 */
  K.confirmDiscard = (what) => (K.dirty ? K.confirm({ title: 'dlg.discardTitle', body: 'dlg.discard_' + what, ok: 'dlg.discardOk', danger: true }) : Promise.resolve(true));

  /* ---------- 提示条：可堆叠、可关闭；error 样式不同、停留更久，鼠标悬停时不消失 ---------- */
  K.toast = (s, type) => {
    const box = $('toasts'); type = type || 'info';
    const same = [...box.children].find((x) => x.dataset.msg === s); if (same) same.remove();
    const el = document.createElement('div'); el.className = 'toast ' + type; el.dataset.msg = s;
    el.setAttribute('role', type === 'error' ? 'alert' : 'status');
    el.innerHTML = `<span class="ic" aria-hidden="true">${type === 'error' ? '!' : type === 'ok' ? '✓' : 'i'}</span><span class="tx"></span><button class="x" aria-label="${et('dlg.close')}" title="${et('dlg.close')}">×</button>`;
    el.querySelector('.tx').textContent = s;
    let timer; const gone = () => el.remove(), arm = () => { clearTimeout(timer); timer = setTimeout(gone, type === 'error' ? 10000 : 5000); };
    el.querySelector('.x').onclick = gone; el.onmouseenter = () => clearTimeout(timer); el.onmouseleave = arm;
    box.appendChild(el); while (box.children.length > 4) box.firstElementChild.remove();
    arm(); return el;
  };

  /* ---------- 拖动 / 悬停时跟随鼠标的数值提示 ---------- */
  K.tip = (x, y, text) => {
    const el = $('tip'); if (el.textContent !== text) el.textContent = text; el.hidden = false;
    const w = el.offsetWidth, h = el.offsetHeight;
    el.style.left = Math.max(4, Math.min(innerWidth - w - 4, x + 14)) + 'px';
    el.style.top = (y + 22 + h > innerHeight ? y - h - 12 : y + 22) + 'px';
  };
  K.tipHide = () => { $('tip').hidden = true; };
  K.fmt3 = (t) => (+t).toFixed(3);

  /* ---------- 欢迎页 / 空状态的操作 ----------
     扩展点：后续功能（如“粘贴歌词”“自动注音”）往 K.welcomeActions 里 push 一项即可，欢迎页和空状态都会出现：
       { id, label: 翻译 key, desc: 翻译 key, run: () => …, pri: 是否主按钮, where: ['welcome', 'empty'] }
     run 在对话框关闭之后调用。改完数组后调用 K.renderEmpty() 刷新空状态。 */
  K.welcomeActions = [
    { id: 'sample', label: 'w.sample', desc: 'w.sampleDesc', pri: true, where: ['welcome', 'empty'], run: () => K.trySample() },
    { id: 'import', label: 'w.import', desc: 'w.importDesc', where: ['welcome', 'empty'], run: () => K.openDialog(K.IMPORT_ACCEPT) },
    { id: 'open', label: 'w.open', desc: 'w.openDesc', where: ['welcome', 'empty'], run: () => K.openDialog() },
    { id: 'empty', label: 'w.empty', desc: 'w.emptyDesc', where: ['welcome'], run: () => K.newProject() },
  ];
  const actsHtml = (where) => K.welcomeActions.filter((a) => !a.where || a.where.includes(where)).map((a) =>
    `<button class="wact${a.pri ? ' pri' : ''}" data-act="${esc(a.id)}"><b>${et(a.label)}</b><span>${et(a.desc)}</span></button>`).join('');
  const runAct = (id) => { const a = K.welcomeActions.find((x) => x.id === id); if (a) a.run(); };
  const STEPS = ['w.step1', 'w.step2', 'w.step3', 'w.step4'];
  K.showWelcome = () => {
    K.pref('welcomed', true);
    let picked = null;
    return K.dialog({ cls: 'welcome', cancel: null,
      render: () => ({ title: T('w.title'), html:
        `<p class="pitch">${et('w.pitch')}</p><ol class="steps">${STEPS.map((k, i) => `<li><span class="num" aria-hidden="true">${i + 1}</span><span><b>${et(k)}</b><br><span class="hint">${et(k + 'Desc')}</span></span></li>`).join('')}</ol>` +
        `<div class="wacts" id="welcomeActions">${actsHtml('welcome')}</div><p class="hint">${et('w.foot')}</p>` }),
      onPaint: (d, close) => d.querySelectorAll('[data-act]').forEach((b) => (b.onclick = () => { picked = b.dataset.act; close(picked); })),
    }).then((v) => { if (v) runAct(v); return v; });
  };
  K.firstRun = (hadAutosave) => !hadAutosave && !K.pref('welcomed');

  /* ---------- 空状态：工程里没有歌词时，预览区和列表里显示同样的操作 ---------- */
  K.renderEmpty = () => {
    const none = !K.project.lines.length, el = $('empty');
    el.hidden = !none; if (!none) return;
    el.innerHTML = `<div class="ebox"><h2>${et('e.title')}</h2><p>${et('e.text')}</p><div class="wacts">${actsHtml('empty')}</div><p class="hint">${et('e.hint')}</p></div>`;
  };
  K.emptyListHtml = () => `<div class="pad lempty"><p class="hint">${et('list.empty')}</p><div class="btns">${K.welcomeActions.filter((a) => !a.where || a.where.includes('empty')).map((a) => `<button data-act="${esc(a.id)}"${a.pri ? ' class="pri"' : ''}>${et(a.label)}</button>`).join('')}</div></div>`;
  document.addEventListener('click', (e) => { const b = e.target.closest && e.target.closest('#empty [data-act], #list [data-act]'); if (b) runAct(b.dataset.act); });
})();
