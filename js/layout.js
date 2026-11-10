/* 版面：可拖动的时间线高度、窄屏折叠侧栏、手机提示；鼠标用过的下拉框 / 滑块不留焦点；标签页键盘操作 */
(function () {
  const K = window.K, $ = (id) => document.getElementById(id);
  const root = document.documentElement;
  const tlMax = () => Math.max(160, Math.round(innerHeight * 0.65));
  const setTlH = (h, save) => {
    h = Math.round(Math.max(110, Math.min(tlMax(), h)));
    root.style.setProperty('--tlh', h + 'px');
    const d = $('tlDiv'); d.setAttribute('aria-valuenow', h); d.setAttribute('aria-valuemax', tlMax());
    if (save) K.pref('tlh', h);
  };
  K.initLayout = () => {
    /* 时间线高度：拖分隔条，或聚焦后用 ↑↓ */
    setTlH(K.prefNum('tlh', 110, 2000, innerHeight < 860 ? Math.round(innerHeight * 0.28) : 250));
    const d = $('tlDiv'); let st = null;
    d.addEventListener('pointerdown', (e) => { st = { y: e.clientY, h: $('tl').offsetHeight }; try { d.setPointerCapture(e.pointerId); } catch (err) {} d.classList.add('on'); e.preventDefault(); });
    d.addEventListener('pointermove', (e) => { if (st) setTlH(st.h - (e.clientY - st.y)); });
    const up = () => { if (st) { st = null; d.classList.remove('on'); setTlH($('tl').offsetHeight, true); } };
    d.addEventListener('pointerup', up); d.addEventListener('pointercancel', up);
    d.addEventListener('keydown', (e) => { const s = e.shiftKey ? 60 : 20, h = $('tl').offsetHeight; if (e.key === 'ArrowUp') { setTlH(h + s, true); e.preventDefault(); } else if (e.key === 'ArrowDown') { setTlH(h - s, true); e.preventDefault(); } });
    addEventListener('resize', () => setTlH($('tl').offsetHeight));

    /* 窄屏（< 1100px）：侧栏可以折叠 */
    const app = $('app');
    const tog = (cls, btn) => { const on = !app.classList.toggle(cls); $(btn).setAttribute('aria-pressed', on); K.pref(cls, !on); };
    $('bLeft').onclick = () => tog('noL', 'bLeft'); $('bRight').onclick = () => tog('noR', 'bRight');
    ['noL', 'noR'].forEach((c, i) => { const on = K.pref(c) === true; app.classList.toggle(c, on); $(i ? 'bRight' : 'bLeft').setAttribute('aria-pressed', !on); });

    /* 手机尺寸：提示一次（可关闭，不挡操作） */
    const pn = $('phoneNote');
    const phone = () => { pn.hidden = !(matchMedia('(max-width: 700px)').matches && !K.pref('phoneOk')); };
    $('pnClose').onclick = () => { K.pref('phoneOk', true); phone(); };
    phone(); addEventListener('resize', phone);

    /* 标签页：恢复上次的；←→ 在标签间移动 */
    K.showTab(K.pref('tab'));
    $('tabs').addEventListener('keydown', (e) => {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      e.preventDefault();
      const bs = [...$('tabs').querySelectorAll('button')], i = bs.indexOf(document.activeElement), n = bs[(i + (e.key === 'ArrowRight' ? 1 : bs.length - 1)) % bs.length];
      if (n) { n.click(); n.focus(); }
    });
  };

  /* 鼠标点选过的下拉框 / 拖过的滑块 / 选过的颜色不留焦点，快捷键立刻可用；用键盘（Tab）操作时保留焦点 */
  let viaPtr = false;
  document.addEventListener('pointerdown', () => (viaPtr = true), true);
  document.addEventListener('keydown', () => (viaPtr = false), true);
  document.addEventListener('change', (e) => {
    const t = e.target;
    if (viaPtr && (t.tagName === 'SELECT' || (t.tagName === 'INPUT' && (t.type === 'range' || t.type === 'color'))) && !(t.closest && t.closest('dialog'))) t.blur();
  });
  /* 鼠标点过的按钮 / 复选框也不留焦点，空格只管播放；用 Tab 聚焦的按钮按空格 / 回车照常触发按钮本身（对话框里除外） */
  document.addEventListener('click', (e) => { const b = e.detail > 0 && e.target.closest && e.target.closest(K.CTRL_SEL); if (b && !b.closest('dialog')) b.blur(); });
})();
