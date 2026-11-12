/* 仅在线版（online 分支）：顶栏的「GitHub 仓库」与「广告」按钮；导出时带广告卡片的进度弹窗。
   放在单独文件里，master 合并进来时不会和主线代码冲突。须在 i18n.js 之后、app.js 之前加载。 */
(function () {
  const K = window.K, $ = (id) => document.getElementById(id), T = (k, p) => K.t(k, p), et = (k, p) => K.esc(T(k, p));
  const AD_CLIENT = 'ca-pub-9423008043392488';
  const AD_SLOT_EXPORT = '7240817804';   // AdSense 展示广告单元「karaoke-lyrics-video-maker 导出进度弹窗」（自适应）
  const AD_SLOT = '9256004414';   // AdSense 展示广告单元「karaoke-lyrics-video-maker 广告对话框」（自适应）

  Object.assign(K.I18N['zh-CN'], {
    'on.repo': 'GitHub 仓库', 'on.repoTip': '在 GitHub 上查看源代码（新标签页）',
    'on.ad': '广告', 'on.adTip': '看一条广告，支持作者', 'on.adTitle': '支持作者',
    'on.adLead': '感谢使用！下面这条广告的收入会用来维护这个工具。',
    'on.adNone': '广告没有显示？可能是被广告拦截插件挡住了，或者暂时没有可投放的广告。不影响使用。',
    'on.expTitle': '导出进度', 'on.expCancel': '取消导出', 'on.expWait': '准备中…',
    'on.expHint': '关掉这个窗口不会中断导出，进度仍然显示在「导出」页。等待的时候，下面这条广告的收入会用来维护这个工具。',
  });
  Object.assign(K.I18N.ja, {
    'on.repo': 'GitHub リポジトリ', 'on.repoTip': 'GitHub でソースコードを見る（新しいタブ）',
    'on.ad': '広告', 'on.adTip': '広告を見て作者を応援する', 'on.adTitle': '作者を応援',
    'on.adLead': 'ご利用ありがとうございます！下の広告の収益はこのツールの維持に使われます。',
    'on.adNone': '広告が表示されない場合は、広告ブロッカーに遮られているか、配信できる広告が一時的にないのかもしれません。ツールはそのままお使いいただけます。',
    'on.expTitle': '書き出しの進行状況', 'on.expCancel': '書き出しをキャンセル', 'on.expWait': '準備中…',
    'on.expHint': 'このウィンドウを閉じても書き出しは止まりません。進行状況は「書き出し」タブにも表示されます。お待ちの間、下の広告の収益はこのツールの維持に使われます。',
  });
  Object.assign(K.I18N.en, {
    'on.repo': 'GitHub repository', 'on.repoTip': 'View the source code on GitHub (new tab)',
    'on.ad': 'Ad', 'on.adTip': 'Watch an ad to support the author', 'on.adTitle': 'Support the author',
    'on.adLead': 'Thanks for using this tool! Revenue from the ad below helps keep it maintained.',
    'on.adNone': 'Ad not showing? It may be blocked by an ad blocker, or no ad is available right now. The tool works the same either way.',
    'on.expTitle': 'Export progress', 'on.expCancel': 'Cancel export', 'on.expWait': 'Preparing…',
    'on.expHint': 'Closing this window does not stop the export; progress is still shown in the Export tab. While you wait, revenue from the ad below helps keep this tool maintained.',
  });
  /* 首页标题（没动过的内置示例时显示，搜索引擎抓到的就是它）：带上各语言的搜索关键词。
     爬虫多半按英文界面渲染，所以英文那条里也放了日语 / 中文的词；index.html 里静态的 <title> 要和英文这条保持一致 */
  K.I18N.en['app.titleHome'] = 'Karaoke Lyrics Video Maker – Free Online Karaoke Subtitle Maker | ニコカラ・カラオケ字幕 | 卡拉OK字幕制作';
  K.I18N.ja['app.titleHome'] = 'ニコカラ・カラオケ字幕メーカー（無料・ブラウザーで作成） – Karaoke Lyrics Video Maker';
  K.I18N['zh-CN']['app.titleHome'] = '卡拉OK歌词视频 / 字幕制作器（免费在线） – Karaoke Lyrics Video Maker';
  /* 在线版用了 Google Analytics 和 AdSense：在「关于」的隐私说明后面如实补一句 */
  const PRIV = {
    'zh-CN': ' 在线版另外使用 Google Analytics 统计访问量，并通过 Google AdSense 展示广告：这两项会向 Google 发送请求，可能使用 Cookie；你的音视频、歌词和工程仍然不会上传。',
    ja: ' オンライン版ではこのほかに、アクセス解析に Google Analytics を、広告の表示に Google AdSense を使っています。どちらも Google に通信し、Cookie を使うことがあります。音声・動画、歌詞、プロジェクトがアップロードされないことは変わりません。',
    en: ' The online version also uses Google Analytics to count visits and Google AdSense to show ads: both send requests to Google and may use cookies. Your media, lyrics and projects are still never uploaded.',
  };
  Object.keys(PRIV).forEach((l) => { K.I18N[l]['about.privacy'] += PRIV[l]; });
  K.applyI18n();

  // AdSense 要求 <ins> 在 push 时已有宽度，所以对话框打开（showModal）后才 push；切换语言重画后再 push 一次
  const fill = (d) => {
    const ins = d.querySelector('ins.adsbygoogle'); if (!ins) return;
    try { (window.adsbygoogle = window.adsbygoogle || []).push({}); } catch (e) {}
  };
  /* 广告卡片：一个自适应的 AdSense 展示单元 */
  const adCard = (slot) => `<div class="adbox"><ins class="adsbygoogle" style="display:block" data-ad-client="${AD_CLIENT}"` +
    (slot ? ` data-ad-slot="${slot}"` : '') + ` data-ad-format="auto" data-full-width-responsive="true"></ins></div>`;
  const showAd = () => {
    if (K.modalOpen()) return Promise.resolve();
    return K.dialog({ cls: 'ad', light: true, cancel: null,
      render: () => ({ title: T('on.adTitle'), html:
        `<p class="hint">${et('on.adLead')}</p>` + adCard(AD_SLOT) + `<p class="hint">${et('on.adNone')}</p>`,
        buttons: [{ label: T('dlg.close'), value: null, pri: true }] }),
      onPaint: (d) => { if (d.open) fill(d); },
      onOpen: (d) => fill(d),
    });
  };

  /* ---------- 导出进度弹窗 ----------
     主线的导出代码不用改：导出开始 / 结束 = 「取消」按钮（#bCancel）出现 / 消失；进度和文字照抄「导出」页的 #prog、#expMsg。
     导出跑了 EXP_DELAY 毫秒还没完才弹出（一眨眼就完的导出不打扰）；关掉它不影响导出，导出完了它留着显示结果，等用户自己关。
     进度只改弹窗里的节点，不重画——重画会把广告的 <ins> 换掉 */
  const EXP_DELAY = 800;
  let expDlg = null, expTimer = 0;
  const expRunning = () => !$('bCancel').hidden;
  const expSync = () => {
    if (!expDlg) return;
    const bar = expDlg.querySelector('.prog i'), msg = expDlg.querySelector('.expmsg'), cb = expDlg.querySelector('.dacts [data-i="0"]'), run = expRunning();
    if (bar) bar.style.width = $('prog').firstElementChild.style.width || '0%';
    if (msg) msg.textContent = $('expMsg').textContent || T('on.expWait');
    if (cb) cb.hidden = !run;
  };
  const showExport = () => {
    if (expDlg || !expRunning()) return;
    K.dialog({ cls: 'ad exp', light: true, cancel: null, focus: '.dacts .pri',
      render: () => ({ title: T('on.expTitle'), html:
        `<div class="prog"><i></i></div><p class="expmsg" aria-live="polite"></p><p class="hint">${et('on.expHint')}</p>` + adCard(AD_SLOT_EXPORT) + `<p class="hint">${et('on.adNone')}</p>`,
        buttons: [{ label: T('on.expCancel'), value: 'cancel' }, { label: T('dlg.close'), value: null, pri: true }] }),
      onPaint: (d) => { expDlg = d; expSync(); if (d.open) fill(d); },
      onOpen: (d) => fill(d),
    }).then((v) => { expDlg = null; if (v === 'cancel' && expRunning()) $('bCancel').click(); });
  };
  new MutationObserver(() => {
    clearTimeout(expTimer);
    if (expRunning() && !expDlg) expTimer = setTimeout(showExport, EXP_DELAY);
    expSync();
  }).observe($('bCancel'), { attributes: true, attributeFilter: ['hidden'] });
  new MutationObserver(expSync).observe($('expMsg'), { childList: true, characterData: true, subtree: true });
  new MutationObserver(expSync).observe($('prog'), { attributes: true, attributeFilter: ['style'], subtree: true });

  $('bRepo').onclick = () => window.open(K.APP.repo, '_blank', 'noopener');
  $('bAd').onclick = showAd;
})();
