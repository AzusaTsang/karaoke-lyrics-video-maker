/* 帮助对话框：键盘部分直接由 K.KEYS 生成（与实际按键处理同一张表）；鼠标操作表；关于（名称 / 版本 / 许可 / 仓库） */
(function () {
  const K = window.K, T = (k, p) => K.t(k, p), esc = K.esc, et = (k, p) => esc(T(k, p));
  /* 鼠标操作：[位置, [[操作, 效果], …]]（都是翻译 key） */
  K.MOUSE = [
    ['m.preview', [['m.pClick', 'm.pClickDo'], ['m.pDrag', 'm.pDragDo'], ['m.pScrub', 'm.pScrubDo'], ['m.pAlt', 'm.pAltDo'], ['m.pDbl', 'm.pDblDo'], ['m.pRight', 'm.pRightDo']]],
    ['m.timeline', [['m.tRuler', 'm.tRulerDo'], ['m.tBlock', 'm.tBlockDo'], ['m.tTick', 'm.tTickDo'], ['m.tEnd', 'm.tEndDo'], ['m.tEdge', 'm.tEdgeDo'], ['m.tDots', 'm.tDotsDo'],
      ['m.tDbl', 'm.tDblDo'], ['m.tRight', 'm.tRightDo'], ['m.tWheel', 'm.tWheelDo'], ['m.tPan', 'm.tPanDo'], ['m.tShift', 'm.tShiftDo'], ['m.tOverview', 'm.tOverviewDo'], ['m.tResize', 'm.tResizeDo']]],
    ['m.list', [['m.lClick', 'm.lClickDo'], ['m.lDbl', 'm.lDblDo'], ['m.lRight', 'm.lRightDo']]],
    ['m.files', [['m.fDrop', 'm.fDropDo']]],
  ];
  const keysHtml = () => K.KEY_GROUPS.map((g) => `<h3>${et('kg.' + g)}</h3><table class="keys"><tbody>${K.KEYS.filter((b) => b.grp === g).map((b, i) =>
    `<tr data-key-id="${esc(b.label)}"><td class="k">${K.keyHtml(b)}</td><td>${et(b.label)}${b.sel ? ` <span class="hint">${et('k.needSel')}</span>` : ''}</td></tr>`).join('')}</tbody></table>`).join('');
  const mouseHtml = () => K.MOUSE.map(([w, rows]) => `<h3>${et(w)}</h3><table class="keys"><tbody>${rows.map(([a, b]) => `<tr><td class="k">${et(a)}</td><td>${et(b)}</td></tr>`).join('')}</tbody></table>`).join('');
  const aboutHtml = () => {
    const A = K.APP, repo = /[<>]/.test(A.repo) ? `<code>${esc(A.repo)}</code>` : `<a href="${esc(A.repo)}" target="_blank" rel="noopener">${esc(A.repo)}</a>`;
    return `<p><b>${et('app.name')}</b> · ${et('about.version', { v: A.version })} · ${et('about.license')}<br>${et('about.repo')} ${repo}<br><span class="hint">${et('about.privacy')}</span></p>`;
  };
  K.showHelp = () => {
    if (K.modalOpen()) return Promise.resolve();
    return K.dialog({ cls: 'help', light: true, cancel: null, focus: '.dbody',
      render: () => ({ title: T('help.title'), html:
        `<div class="hbar"><button id="hWelcome">${et('help.welcome')}</button><span class="hint">${et('help.lead')}</span></div>` +
        `<div class="hcols"><section aria-label="${et('help.keys')}"><h2 class="sub">${et('help.keys')}</h2>${keysHtml()}</section><section aria-label="${et('help.mouse')}"><h2 class="sub">${et('help.mouse')}</h2>${mouseHtml()}</section></div>` +
        `<footer class="about"><h2 class="sub">${et('help.about')}</h2>${aboutHtml()}</footer>` }),
      onPaint: (d, close) => { d.querySelector('#hWelcome').onclick = () => { close(null); K.showWelcome(); }; },
    });
  };
})();
