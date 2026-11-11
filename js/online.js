/* 仅在线版（online 分支）：顶栏的「GitHub 仓库」与「广告」按钮。
   放在单独文件里，master 合并进来时不会和主线代码冲突。须在 i18n.js 之后、app.js 之前加载。 */
(function () {
  const K = window.K, $ = (id) => document.getElementById(id), T = (k, p) => K.t(k, p), et = (k, p) => K.esc(T(k, p));
  const AD_CLIENT = 'ca-pub-9423008043392488';
  const AD_SLOT = '9256004414';   // AdSense 展示广告单元「karaoke-lyrics-video-maker 广告对话框」（自适应）

  Object.assign(K.I18N['zh-CN'], {
    'on.repo': 'GitHub 仓库', 'on.repoTip': '在 GitHub 上查看源代码（新标签页）',
    'on.ad': '广告', 'on.adTip': '看一条广告，支持作者', 'on.adTitle': '支持作者',
    'on.adLead': '感谢使用！下面这条广告的收入会用来维护这个工具。',
    'on.adNone': '广告没有显示？可能是被广告拦截插件挡住了，或者暂时没有可投放的广告。不影响使用。',
  });
  Object.assign(K.I18N.ja, {
    'on.repo': 'GitHub リポジトリ', 'on.repoTip': 'GitHub でソースコードを見る（新しいタブ）',
    'on.ad': '広告', 'on.adTip': '広告を見て作者を応援する', 'on.adTitle': '作者を応援',
    'on.adLead': 'ご利用ありがとうございます！下の広告の収益はこのツールの維持に使われます。',
    'on.adNone': '広告が表示されない場合は、広告ブロッカーに遮られているか、配信できる広告が一時的にないのかもしれません。ツールはそのままお使いいただけます。',
  });
  Object.assign(K.I18N.en, {
    'on.repo': 'GitHub repository', 'on.repoTip': 'View the source code on GitHub (new tab)',
    'on.ad': 'Ad', 'on.adTip': 'Watch an ad to support the author', 'on.adTitle': 'Support the author',
    'on.adLead': 'Thanks for using this tool! Revenue from the ad below helps keep it maintained.',
    'on.adNone': 'Ad not showing? It may be blocked by an ad blocker, or no ad is available right now. The tool works the same either way.',
  });
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
  const showAd = () => {
    if (K.modalOpen()) return Promise.resolve();
    return K.dialog({ cls: 'ad', light: true, cancel: null,
      render: () => ({ title: T('on.adTitle'), html:
        `<p class="hint">${et('on.adLead')}</p>` +
        `<div class="adbox"><ins class="adsbygoogle" style="display:block" data-ad-client="${AD_CLIENT}"` +
        (AD_SLOT ? ` data-ad-slot="${AD_SLOT}"` : '') + ` data-ad-format="auto" data-full-width-responsive="true"></ins></div>` +
        `<p class="hint">${et('on.adNone')}</p>`,
        buttons: [{ label: T('dlg.close'), value: null, pri: true }] }),
      onPaint: (d) => { if (d.open) fill(d); },
      onOpen: (d) => fill(d),
    });
  };

  $('bRepo').onclick = () => window.open(K.APP.repo, '_blank', 'noopener');
  $('bAd').onclick = showAd;
})();
