/* YouTube 播放：用 IFrame Player API 把 YouTube 视频当作播放时钟（和本地音视频二选一，由 app.js 切换）。
   播放器放在预览画布下面（开了「视频作背景」时完整显示，否则调暗）；没有波形，导出的 PNG 里只有歌词。
   需要联网；直接用 file:// 打开本页时 YouTube 不允许嵌入。另有「使用 YouTube 视频」对话框 */
(function () {
  const K = window.K, T = (k, p) => K.t(k, p), esc = K.esc, et = (k, p) => esc(T(k, p));
  const ST = { ENDED: 0, PLAYING: 1, PAUSED: 2, BUFFERING: 3 };
  /* ?noyt：不去网上加载 API（自测用；页面里已经有 window.YT 时照常使用） */
  const off = /[?&]noyt(?:[=&]|$)/.test(location.search);
  const hasApi = () => !!(window.YT && window.YT.Player);
  let api = null;
  const loadApi = () => {
    if (hasApi()) return Promise.resolve(window.YT);
    if (off) return Promise.reject(new Error('off'));
    return api || (api = new Promise((res, rej) => {
      const fail = (e) => { clearTimeout(to); api = null; rej(e); };
      const to = setTimeout(() => fail(new Error('network')), 20000);
      const prev = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => { clearTimeout(to); if (typeof prev === 'function') prev(); res(window.YT); };
      const s = document.createElement('script'); s.src = 'https://www.youtube.com/iframe_api'; s.async = true;
      s.onerror = () => { s.remove(); fail(new Error('network')); };
      document.head.appendChild(s);
    }));
  };

  let box = null, P = null, id = '', ready = false, state = -1, tok = 0, cb = {};
  let base = 0;                         // 还没开始播放 / 已播完时的时间：这时 seekTo 会让视频自己开始播放，所以只记下来，按播放时再发
  let want = false, wantAt = 0;         // 想要播放（按钮状态）；被浏览器拦下自动播放时几秒后放弃
  let raw = -1, rawAt = 0, last = 0;    // 播放器报告的时间 + 收到的时刻：两次报告之间按速度往前推，画面才连续
  let hold = null;                      // 刚跳转：播放器还没报告新位置前，先当作已经到了
  let rate = 1, vol = 1, muted = false, seekT = null, seekTimer = 0, seekAt = 0;
  /* 预热：播放器载入后静音播一下马上暂停在 base，让它进入「已开始、暂停中」——这样暂停时跳转能显示对应画面，
     设置模式里也直接有控制条（未开始时只有缩略图和大播放按钮，点了会从 0 秒开始） */
  let priming = false, primePaused = false;   // primePaused：预热那一下的 pauseVideo 已经发出，还没收到 PAUSED
  let swallowPause = false, pendingPause = false;   // 迟到的预热 PAUSED 不算用户暂停；播放还没真正开始时按了暂停，等 PLAYING 到了再停
  const live = () => ready && !priming && (state === ST.PLAYING || state === ST.BUFFERING || state === ST.PAUSED);
  const pnow = () => performance.now();

  const now = () => {
    if (!live()) return base;
    const r = +P.getCurrentTime() || 0, n = pnow();
    if (hold) {
      if (Math.abs(r - hold.t) < 0.4 || (n > hold.until && state !== ST.BUFFERING)) hold = null;      // 还在缓冲 = 还没跳到，继续当作已经到了
      else return hold.t;
    }
    if (r !== raw) { raw = r; rawAt = n; }
    let t = raw + (state === ST.PLAYING ? Math.min(0.5, (n - rawAt) / 1000) * rate : 0);
    if (state === ST.PLAYING && t < last && last - t < 0.25) t = last;      // 播放中不让时间小幅倒退（报告有抖动）
    return (last = t);
  };
  const dur = () => (ready && P.getDuration ? +P.getDuration() || 0 : 0);
  const playing = () => {
    if (want && state !== ST.PLAYING && state !== ST.BUFFERING && pnow() - wantAt > 4000) want = false;
    return want;
  };
  const play = () => {
    want = true; wantAt = pnow(); pendingPause = false;
    if (!ready) return;                                   // 播放器好了再开始
    if (priming) { swallowPause = primePaused; endPrime(); }
    if (!live()) P.seekTo(base, true);                    // 从记下的位置开始播放
    P.playVideo();
  };
  function prime() {
    /* 不设超时：自动播放被浏览器拦下时就一直停在预热状态（静音、未开始），按播放时结束预热、照常从 base 开始；
       网络慢、很久才开始播也仍然会被静音地暂停住，不会自己出声 */
    priming = true; primePaused = false; P.mute(); P.seekTo(base, true);       // 未开始时 seekTo 会开始播放
  }
  function endPrime() { if (!priming) return; priming = false; primePaused = false; if (P) setVolume(vol, muted); }
  const pause = () => {
    want = false; if (!ready || priming) return;
    if (live()) { flush(); P.pauseVideo(); }
    else if (state !== ST.ENDED) pendingPause = true;     // 刚按了播放、还没真正开始：开始的那一刻再停
  };
  /* 拖时间线时会连续跳转：最多每 80ms 发一次，最后一次一定发出 */
  function flush() { clearTimeout(seekTimer); seekTimer = 0; if (seekT == null || !P) return; seekAt = pnow(); P.seekTo(seekT, true); seekT = null; }
  const seek = (t) => {
    last = t;
    if (!live()) { base = t; return; }
    hold = { t, until: pnow() + 1500 }; raw = -1; seekT = t;
    if (!seekTimer) seekTimer = setTimeout(flush, Math.max(0, 80 - (pnow() - seekAt)));
  };
  const setRate = (r) => { rate = r; if (ready) P.setPlaybackRate(r); };
  const setVolume = (v, m) => { vol = v; muted = !!m; if (!ready || priming) return;                 // 预热中保持静音，结束时再套用
    P.setVolume(Math.round(v * 100)); if (muted) P.mute(); else P.unMute(); };

  /* 换成另一个视频（t = 从哪里开始）；c = { ready(), error(why, t), state() }；controls = 显示 YouTube 自己的控制条（设置模式用） */
  let ctl = false, front = false;
  const attach = (newId, t, c, controls) => {
    detach();
    id = newId; cb = c || {}; base = last = Math.max(0, t || 0); ctl = !!controls;
    const my = tok, el = document.createElement('div');
    box.innerHTML = ''; box.appendChild(el); box.hidden = false; lay = '';
    const failed = (why) => { if (my !== tok) return; const c0 = cb, t0 = now(); detach(); if (c0.error) c0.error(why, t0); };
    loadApi().then((YT) => {
      if (my !== tok) return;
      P = new YT.Player(el, {
        host: 'https://www.youtube-nocookie.com', videoId: id, width: '100%', height: '100%',
        playerVars: { controls: ctl ? 1 : 0, disablekb: ctl ? 0 : 1, fs: 0, rel: 0, playsinline: 1, iv_load_policy: 3, cc_load_policy: 0 },
        events: {
          onReady: () => {
            if (my !== tok) return;
            ready = true; state = P.getPlayerState ? P.getPlayerState() : -1;
            setRate(rate); setVolume(vol, muted);
            if (cb.ready) cb.ready();
            if (want) play(); else prime();
          },
          onStateChange: (e) => {
            if (my !== tok) return;
            if (priming) {
              state = e.data;
              if (state === ST.PLAYING) { primePaused = true; P.pauseVideo(); }
              else if (state === ST.PAUSED) { endPrime(); P.seekTo(base, true); hold = { t: base, until: pnow() + 1500 }; raw = -1; last = base; if (cb.state) cb.state(state); }
              return;
            }
            const was = live(); state = e.data; raw = -1;
            if (state === ST.PAUSED && swallowPause) { swallowPause = false; if (want) { P.playVideo(); return; } }
            if (state === ST.PLAYING) swallowPause = false;
            if (state === ST.PLAYING && pendingPause) { pendingPause = false; P.pauseVideo(); return; }
            if (state === ST.PLAYING) want = true;
            else if (state === ST.PAUSED) want = false;
            else if (state === ST.ENDED) { want = false; base = dur(); }
            else if (was && !live()) base = last;
            if (cb.state) cb.state(state);
          },
          onError: (e) => failed(e && e.data),
        },
      });
    }).catch((e) => failed(e && e.message));
  };
  function detach() {
    tok++; clearTimeout(seekTimer); seekTimer = 0; seekT = null; priming = primePaused = swallowPause = pendingPause = false;
    if (P) { try { P.destroy(); } catch (e) {} }
    P = null; ready = false; state = -1; want = false; hold = null; id = ''; raw = -1; ctl = false;
    if (box) { box.innerHTML = ''; box.hidden = true; }
    setFront(false);
  }

  /* ---------- 播放器设置模式 ----------
     嵌入 API 不能选音轨 / 画质，只能用 YouTube 自己的 ⚙ 菜单：临时换成带控制条的播放器，放到歌词上面让人直接操作；
     完成后换回不带控制条的播放器。选过的音轨由 YouTube 记在这个浏览器里，换回后仍然有效 */
  let bar = null;
  function setFront(on) {
    front = !!on;
    if (box) box.classList.toggle('front', front);
    if (bar) bar.hidden = !front;
    lay = '';
    if (K.invalidate) K.invalidate();
  }
  const settings = (on) => {
    on = !!on;
    if (!id || on === front) return;
    const keep = id, t = now(), w = want, c = cb;
    attach(keep, t, c, on); setFront(on);
    if (w) play();
  };
  addEventListener('keydown', (e) => { if (front && e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); settings(false); } }, true);

  /* 每帧：播放器盖住画布的区域（画布居中、按比例缩放）；不开视频背景时调暗 */
  let lay = '';
  const layout = (cv, vbg) => {
    if (!box || box.hidden) return;
    let top = cv.offsetTop, h = cv.offsetHeight;
    if (front && bar) { const b = bar.offsetTop + bar.offsetHeight + 6; if (b > top) { h = Math.max(120, h - (b - top)); top = b; } }     // 设置模式：让出提示条，别挡住播放器上方的按钮
    const k = [cv.offsetLeft, top, cv.offsetWidth, h, !!vbg].join();
    if (k === lay) return; lay = k;
    Object.assign(box.style, { left: cv.offsetLeft + 'px', top: top + 'px', width: cv.offsetWidth + 'px', height: h + 'px' });
    box.classList.toggle('dim', !vbg);
  };
  const title = () => { try { return (ready && P.getVideoData && P.getVideoData().title) || ''; } catch (e) { return ''; } };

  K.yt = {
    attach, detach, now, dur, playing, play, pause, seek, setRate, setVolume, layout, title,
    settings, inSettings: () => front, controls: () => ctl,
    id: () => id, ready: () => ready,
    /* file:// 打开的页面 YouTube 不让嵌入：不去加载（工程里的链接留着，横幅会提示），免得一打开就报错 */
    available: () => hasApi() || (!off && location.protocol !== 'file:'),
    init: (el, b) => { box = el; bar = b; if (bar) bar.querySelector('button').onclick = () => settings(false); },
  };
  /* 播放失败的原因 → 提示文字 */
  K.ytWhy = (why) => {
    if (location.protocol === 'file:' || why === 'file') return T('yt.e.file');
    if (why === 'network') return T('yt.e.net');
    if (why === 2) return T('yt.e.bad');
    if (why === 100) return T('yt.e.gone');
    if (why === 101 || why === 150) return T('yt.e.embed');
    return T('yt.e.code', { code: why });
  };

  /* ---------- 「使用 YouTube 视频」对话框 ---------- */
  K.youtubeDialog = () => {
    if (K.modalOpen()) return Promise.resolve();
    const cur = K.project.youtube || '';
    let val = cur ? 'https://www.youtube.com/watch?v=' + cur : '';
    return K.dialog({ cls: 'small yt', cancel: null, focus: '#ytUrl',
      render: () => ({ title: T('yt.title'), html:
        `<p class="hint">${et('yt.lead')}</p><label class="blk" for="ytUrl">${et('yt.label')}</label>` +
        `<input id="ytUrl" type="url" spellcheck="false" autocomplete="off" placeholder="https://www.youtube.com/watch?v=…" value="${esc(val)}">` +
        `<p class="hint" id="ytMsg" aria-live="polite"></p><p class="hint">${et('yt.note')}</p>`,
        buttons: [...(cur ? [{ label: T('yt.remove'), value: 'rm', danger: true }] : []), { label: T('dlg.cancel'), value: null }, { label: T('yt.go'), value: 'go', pri: true }] }),
      onPaint: (d) => {
        const i = d.querySelector('#ytUrl'), m = d.querySelector('#ytMsg'), go = d.querySelector('.dacts .pri');
        const upd = () => { val = i.value; const ok = !!K.ytId(val); go.disabled = !ok; m.textContent = val.trim() && !ok ? T('yt.bad') : ''; };
        i.oninput = upd; upd();
      },
    }).then((v) => {
      if (v === 'rm') return K.setYouTube('');
      if (v !== 'go') return;
      const nid = K.ytId(val);
      if (!nid) { K.toast(T('yt.bad'), 'error'); return; }
      K.setYouTube(nid);
    });
  };
})();
