/* 主程序：播放时钟（速度 / 循环 / 音量）、媒体、工程文件、保存状态、导入导出、启动 */
(function () {
  const K = window.K, $ = (id) => document.getElementById(id), T = K.t;
  /* 发布信息：仓库地址只在这里写一次（帮助 → 关于里会显示）。fork 后改成自己的仓库地址 */
  K.APP = { version: '1.0.0', repo: 'https://github.com/AzusaTsang/karaoke-lyrics-video-maker' };
  /* 播放时钟有三种来源：mode = 'file'（本地音视频）/ 'yt'（YouTube，见 youtube.js）/ ''（无声的内部时钟） */
  const media = $('media'), Y = K.yt; let mode = '', fileName = '';
  const clk = { playing: false, t: 0, last: 0 };
  K.hasMedia = () => mode !== '';
  K.mediaMode = () => mode;
  K.dur = () => (mode === 'file' && isFinite(media.duration) ? media.duration : mode === 'yt' && Y.dur() > 0 ? Y.dur() : K.project.duration);
  K.now = () => (mode === 'file' ? media.currentTime : mode === 'yt' ? Y.now() : clk.t);
  K.seek = (t) => { t = Math.max(0, Math.min(K.dur(), t)); if (mode === 'file') media.currentTime = t; else if (mode === 'yt') Y.seek(t); else clk.t = t; if (K.tlReveal && !K.tl.scrubbing) K.tlReveal(t); };
  K.playing = () => (mode === 'file' ? !media.paused : mode === 'yt' ? Y.playing() : clk.playing);
  K.play = () => {
    if (mode === 'file') media.play().catch(() => {});
    else if (mode === 'yt') { if (K.now() >= K.dur() - 0.05) Y.seek(0); Y.play(); }
    else { if (clk.t >= K.dur()) clk.t = 0; clk.playing = true; clk.last = performance.now(); }
  };
  K.pause = () => { if (mode === 'file') media.pause(); else if (mode === 'yt') Y.pause(); clk.playing = false; };

  /* ---------- 播放速度：媒体保持音高；没有媒体时内部时钟同样按这个速度走 ---------- */
  K.SPEEDS = [0.5, 0.75, 1, 1.25];
  K.ui.speed = K.SPEEDS.includes(K.pref('speed')) ? K.pref('speed') : 1;
  const applyRate = () => { media.preservesPitch = media.mozPreservesPitch = media.webkitPreservesPitch = true; media.defaultPlaybackRate = media.playbackRate = K.ui.speed; Y.setRate(K.ui.speed); };
  K.setSpeed = (v) => { v = +v; if (!K.SPEEDS.includes(v)) v = 1; K.ui.speed = v; applyRate(); K.pref('speed', v); $('speed').value = String(v); };
  K.stepSpeed = (d) => { const i = K.SPEEDS.indexOf(K.ui.speed); K.setSpeed(K.SPEEDS[Math.max(0, Math.min(K.SPEEDS.length - 1, i + d))]); K.toast(T('msg.speed', { v: K.ui.speed })); };

  /* ---------- 循环选中行：从行首前 PRE 秒到行尾后 POST 秒反复播放；循环范围跟着选中行走 ---------- */
  const PRE = 1, POST = 0.4;
  K.ui.loop = false;
  /* 有媒体时循环终点比媒体结尾早一点：播到结尾媒体会自己停下，就来不及跳回去了 */
  K.loopRange = () => { const l = K.ui.loop && K.sel(); if (!l) return null; const o = K.S().offset, a = Math.max(0, K.r3(K.ls(l) + o - PRE)); return [a, Math.max(a, Math.min(K.dur() - (mode ? 0.08 : 0), K.r3(l.end + o + POST)))]; };
  const loopUi = () => { const b = $('bLoop'); b.classList.toggle('on', K.ui.loop); b.setAttribute('aria-pressed', K.ui.loop); };
  K.toggleLoop = (on) => {
    on = on == null ? !K.ui.loop : !!on;
    if (on && !K.sel()) { K.toast(T('msg.loopNeedSel')); on = false; }
    K.ui.loop = on; loopUi();
    if (on) { const r = K.loopRange(); if (K.now() < r[0] || K.now() > r[1]) K.seek(r[0]); if (!K.playing()) K.play(); }
  };
  K.playLine = () => { const l = K.sel(); if (!l) return; K.seek(Math.max(0, K.ls(l) + K.S().offset - PRE)); K.play(); };

  /* ---------- 音量 / 静音（只对载入的媒体；数值记在 <video> 上，YouTube 播放器跟着它） ---------- */
  K.setVolume = (v, muted) => {
    media.volume = Math.max(0, Math.min(1, +v || 0)); media.muted = !!muted; Y.setVolume(media.volume, media.muted);
    K.pref('vol', media.volume); K.pref('muted', media.muted);
    const b = $('bMute'), off = media.muted || media.volume === 0; b.textContent = off ? '🔇' : '🔊';
    b.setAttribute('aria-pressed', media.muted); b.setAttribute('aria-label', T(media.muted ? 'bar.unmute' : 'bar.mute')); b.title = T(media.muted ? 'bar.unmute' : 'bar.mute');
    $('vol').value = media.volume;
  };

  /* ---------- 导出结束时间：用户没手动改过就跟随时长 ---------- */
  let eEndManual = false;
  const syncEnd = () => { if (!eEndManual) $('eEnd').value = K.dur().toFixed(2); };

  /* ---------- 媒体 ---------- */
  let mediaUrl = null, mediaTok = 0, bannerOff = false, ytFail = '';
  async function loadMedia(f) {
    const tok = ++mediaTok;
    if (mediaUrl) URL.revokeObjectURL(mediaUrl);
    const wasPlaying = K.playing(), t = K.now(); K.pause();
    if (mode === 'yt') Y.detach();                      // 本地文件优先；工程里的 YouTube 链接保留
    held = null;                                        // 之前留着备用的文件被这个新文件取代
    mediaUrl = URL.createObjectURL(f); media.src = mediaUrl; mode = 'file'; fileName = f.name; K.peaks = null; applyRate(); K.invalidate();
    K.project.mediaName = f.name; mediaUi();
    media.onloadedmetadata = () => { if (tok !== mediaTok) return; K.project.duration = Math.ceil(media.duration * 100) / 100; applyRate(); if (t > 0 && t < media.duration) media.currentTime = t; syncEnd(); K.autosave(); K.invalidate(); if (wasPlaying) K.play(); };
    media.onerror = () => {
      if (tok !== mediaTok) return;
      mode = ''; fileName = ''; clk.t = t; K.toast(T('msg.mediaFail', { name: f.name }), 'error');
      if (K.project.youtube) useYt(K.project.youtube);     // 放不了就退回工程里的 YouTube 视频
      mediaUi();
    };
    if (f.size > 400 * 1024 * 1024) { K.toast(T('msg.bigMedia')); return; }
    let ac = null;
    try {
      ac = new (window.AudioContext || window.webkitAudioContext)(); const buf = await ac.decodeAudioData(await f.arrayBuffer());
      const rate = 100, n = Math.ceil(buf.duration * rate), data = new Float32Array(n), hop = buf.sampleRate / rate, ch = buf.getChannelData(0);
      for (let i = 0; i < n; i++) { let m = 0; const a = Math.floor(i * hop), b = Math.min(ch.length, Math.floor((i + 1) * hop)); for (let k = a; k < b; k += 4) { const v = Math.abs(ch[k]); if (v > m) m = v; } data[i] = m; }
      if (tok === mediaTok) { K.peaks = { rate, data }; K.invalidate(); }      // 期间又换了媒体就丢掉
    } catch (e) { if (tok === mediaTok) K.toast(T('msg.noWave')); }
    finally { if (ac) ac.close().catch(() => {}); }
  }
  K.loadMedia = loadMedia;
  /* 换成 YouTube 视频（从当前时间接着走）。播放器出错时退回无声时钟 */
  /* 已载入的本地文件先留着（held），等 YouTube 播放器真的能用了再放掉；播放器出错 / 链接被移除时换回这个文件 */
  let held = null;
  const releaseFile = () => { media.removeAttribute('src'); media.load(); if (mediaUrl) URL.revokeObjectURL(mediaUrl); mediaUrl = null; fileName = ''; held = null; };
  const backToFile = (t) => { mode = 'file'; K.peaks = held.peaks; held = null; if (isFinite(media.duration)) media.currentTime = Math.max(0, Math.min(media.duration, t)); };
  /* 播放器报告的时长可能晚一点才有（刚就绪时是 0）：每次状态变化都对一下 */
  const ytDur = () => { const d = Y.dur(), v = Math.ceil(d * 100) / 100; if (d > 0 && K.project.duration !== v) { K.project.duration = v; syncEnd(); } };
  function useYt(id) {
    if (!Y.available()) { ytFail = id; return; }
    const wasPlaying = K.playing(), t = K.now(); K.pause();
    if (mode === 'file') {
      if (media.readyState >= 1) { held = { peaks: K.peaks }; K.peaks = null; }      // 能播的文件留着备用
      else { ++mediaTok; releaseFile(); K.peaks = null; }                             // 还在加载的本地文件直接丢掉
    }
    mode = 'yt'; ytFail = '';
    Y.attach(id, t, {
      ready: () => { if (held) { ++mediaTok; releaseFile(); } ytDur(); applyRate(); syncEnd(); mediaUi(); K.invalidate(); },
      state: () => { ytDur(); mediaUi(); K.invalidate(); },
      error: (why, t0) => {
        if (mode !== 'yt') return;
        ytFail = id; if (held) backToFile(t0); else { mode = ''; clk.t = t0; clk.playing = false; }
        mediaUi(); K.invalidate(); K.toast(T('yt.fail', { why: K.ytWhy(why) }), 'error');
      },
    });
    if (wasPlaying) Y.play();
    mediaUi(); K.invalidate();
  }
  function dropYt() { if (mode !== 'yt') return; const t = K.now(); Y.detach(); if (held) backToFile(t); else { mode = ''; clk.t = t; clk.playing = false; } mediaUi(); K.invalidate(); }
  /* 工程变了（打开 / 新建 / 撤销）：让播放器跟上工程里的 YouTube 链接。
     已载入本地文件时，只有换了工程、而且这个文件不是新工程记着的那个，才换成 YouTube */
  function syncYt(why) {
    const id = K.project.youtube || '';
    if (mode === 'file') { if (why === 'project' && id && fileName !== K.project.mediaName) useYt(id); return; }
    if (id && (mode !== 'yt' || Y.id() !== id)) { if (why === 'project' || ytFail !== id) useYt(id); }
    else if (!id) dropYt();
  }
  /* 「使用 YouTube 视频」对话框 / 拖入链接：id = '' 表示移除链接 */
  K.setYouTube = (id) => {
    if ((K.project.youtube || '') !== id) { K.project.youtube = id; K.commit('media'); }
    if (id) { useYt(id); if (!Y.available()) K.toast(T('yt.fail', { why: K.ytWhy(location.protocol === 'file:' ? 'file' : 'network') }), 'error'); } else dropYt();
  };
  K.mediaMenu = (btn) => {
    const r = btn.getBoundingClientRect();
    K.menu(r.left, r.bottom + 4, [[T('media.file'), K.pickMedia], [T('media.yt'), () => K.youtubeDialog()], ...(mode === 'yt' ? [[T('media.ytSet'), () => Y.settings(true)]] : [])]);
    const f = document.querySelector('#menu button'); if (f) f.focus();
  };
  /* 视频帧到位 / 跳转完成时时间可能没变，但画面（视频背景）要更新 */
  ['seeked', 'loadeddata', 'pause', 'play'].forEach((ev) => media.addEventListener(ev, K.invalidate));
  K.pickMedia = () => { const i = $('fOpen'); i.accept = 'audio/*,video/*'; i.value = ''; i.onchange = () => i.files[0] && queue(() => loadMedia(i.files[0])); i.click(); };

  /* 顶栏的媒体名、预览区的“缺少媒体”横幅、音量控件 */
  function mediaUi() {
    const mn = $('mediaName'), name = K.project.mediaName, has = mode !== '', yt = K.project.youtube;
    const label = mode === 'yt' ? 'YouTube · ' + (Y.title() || (Y.ready() ? Y.id() : T('yt.loading'))) : name;
    mn.textContent = has ? label : T('top.noMedia'); mn.title = has ? (mode === 'yt' ? 'https://youtu.be/' + Y.id() : name) : T('top.mediaTip');
    mn.classList.toggle('has', has);
    $('bYtSet').hidden = mode !== 'yt';
    $('bMute').disabled = $('vol').disabled = !has;
    const bn = $('mbanner'), show = !has && !bannerOff && (K.doc.src === 'sample' || !!name || !!yt);
    bn.hidden = !show;
    if (show) {
      bn.querySelector('.tx').textContent = yt ? T('mb.yt') : K.doc.src === 'sample' ? T('mb.sample') : T('mb.missing', { name });
      bn.querySelector('.sub').textContent = yt || K.doc.src === 'sample' ? '' : T('mb.drop');
    }
  }
  K.mediaUi = mediaUi;

  /* ---------- 工程文件 ---------- */
  let fileHandle = null;
  const download = (blob, name) => { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 40000); };
  K.download = download;
  const projBlob = () => new Blob([JSON.stringify(K.project, null, 1)], { type: 'application/json' });
  const TYPES = () => [{ description: T('projType'), accept: { 'application/json': ['.kara.json', '.json'] } }];
  const isUntitled = (s) => !s || K.tAll('untitled').includes(s);
  const fname = () => (K.project.title || 'lyrics').replace(/[\\/:*?"<>|]/g, '_') + '.kara.json';
  async function saveAs() {
    if (!window.showSaveFilePicker) { download(projBlob(), fname()); K.markSaved(fname(), 'download'); K.toast(T('msg.downloaded', { name: fname() }), 'ok'); return; }
    let h; try { h = await window.showSaveFilePicker({ suggestedName: fname(), types: TYPES() }); } catch (e) { return; }
    fileHandle = h; await save();
  }
  async function save() {
    if (!fileHandle) return saveAs();
    try { const w = await fileHandle.createWritable(); await w.write(projBlob()); await w.close(); K.markSaved(fileHandle.name, 'file'); K.toast(T('msg.saved', { name: fileHandle.name }), 'ok'); }
    catch (e) { K.toast(T('msg.saveFail', { msg: e.message }), 'error'); }
  }
  K.save = save; K.saveAs = saveAs;
  function parseSrt(txt) {
    const ts = (s) => { const m = s.trim().match(/(\d+):(\d+):(\d+)[,.](\d+)/); return m ? +m[1] * 3600 + +m[2] * 60 + +m[3] + +m[4] / 1000 : 0; };
    return txt.replace(/^﻿/, '').replace(/\r/g, '').split(/\n\s*\n/).map((b) => {
      const L = b.trim().split('\n'), k = L.findIndex((x) => x.includes('-->')); if (k < 0) return null;
      /* 多行的字幕 = 一行带行内换行的歌词 */
      const [a, c] = L[k].split('-->'); return { start: ts(a), end: ts(c), text: L.slice(k + 1).map((s) => s.trim()).filter(Boolean).join('\n') };
    }).filter((c) => c && c.text);
  }
  K.parseSrt = parseSrt;
  /* 新建 / 导入 SRT、LRC 时沿用正在播放的 YouTube 视频（和本地媒体一样留着） */
  const keepYt = () => (mode === 'yt' ? Y.id() : '');
  const isMedia = (f) => /\.(mp3|wav|m4a|aac|flac|ogg|opus|mp4|mov|mkv|webm)$/i.test(f.name) || /^(audio|video)\//.test(f.type);
  /* 换工程：旧工程有未保存修改时先确认；新工程来源记在 K.doc 里 */
  const replaceProject = async (p, doc, what) => {
    if (!(await K.confirmDiscard(what))) return false;
    fileHandle = doc.handle || null;
    K.setProject(p, false, { src: doc.src, name: doc.name || '' }); K.ensureFont(); $('title').value = p.title; return true;
  };
  async function openFile(f, handle) {
    const name = f.name.toLowerCase();
    if (isMedia(f)) return loadMedia(f);
    let p, srt = name.endsWith('.srt'), lrc = name.endsWith('.lrc');
    try {
      const txt = await f.text();
      if (srt) { p = K.normalizeProject({ lines: parseSrt(txt) }); p.settings = K.cleanSettings(K.S()); p.youtube = keepYt(); p.title = f.name.replace(/\.srt$/i, ''); }
      else if (lrc) { p = K.normalizeProject(K.parseLrc(txt)); p.settings = K.cleanSettings(K.S()); p.youtube = keepYt(); if (isUntitled(p.title)) p.title = f.name.replace(/\.lrc$/i, ''); }
      else { p = K.normalizeProject(JSON.parse(txt)); if (isUntitled(p.title)) p.title = f.name.replace(/(\.kara)?\.json$/i, ''); }
    } catch (e) { K.toast(T('msg.readFail', { msg: e.message }), 'error'); return; }
    const isProj = !srt && !lrc && name.endsWith('.json');
    if (await replaceProject(p, { src: isProj ? 'file' : 'import', name: isProj ? f.name : '', handle: isProj && handle ? handle : null }, 'open') && (srt || lrc)) K.toast(T(srt ? 'msg.srt' : 'msg.lrc'));
  }
  /* 打开 / 拖入的文件排队逐个处理，两次拖放不会交错 */
  let q = Promise.resolve();
  const queue = (fn) => (q = q.then(fn).catch((e) => K.toast(T('msg.readFail', { msg: e && e.message }), 'error')));
  K.fileQueue = () => q;
  async function openDialog(accept) {
    if (window.showOpenFilePicker && !accept) {
      try { const [h] = await window.showOpenFilePicker({ types: TYPES() }); const f = await h.getFile(); queue(() => openFile(f, h)); } catch (e) {}
      return;
    }
    const i = $('fOpen'); i.accept = accept || '.json'; i.value = ''; i.onchange = () => i.files[0] && queue(() => openFile(i.files[0])); i.click();
  }
  K.openDialog = openDialog;
  K.loadSample = (i) => { const s = K.SAMPLES[i]; return s ? replaceProject(K.normalizeProject(s.project), { src: 'sample' }, 'sample') : Promise.resolve(false); };
  K.newProject = () => { const p = K.blank(); p.settings = K.cleanSettings(K.S()); p.youtube = keepYt(); return replaceProject(p, { src: 'new' }, 'new'); };
  /* 欢迎页“试试示例”：已经是没改过的示例就直接用；然后从第一句前开始播放 */
  K.trySample = async () => {
    if (!(K.doc.src === 'sample' && !K.dirty && K.project.lines.length) && !(await K.loadSample(0))) return;
    const f = K.screen().ord[0]; if (f) { K.select(f.id); K.seek(Math.max(0, K.ls(f) + K.S().offset - 3)); } K.play();
  };

  /* ---------- 保存状态 ---------- */
  function saveInfo() {
    const n = K.doc.name;
    if (!K.dirty) {
      if (fileHandle) return ['ok', T('ss.saved', { name: fileHandle.name }), T('ss.savedTip', { name: fileHandle.name })];
      if (K.doc.src === 'sample') return ['', T('ss.sample'), T('ss.sampleTip')];
      if (n) return ['ok', T('ss.synced', { name: n }), T('ss.syncedTip', { name: n })];
      return ['', T('ss.new'), T('ss.newTip')];
    }
    if (!K.autosaveOk) return ['err', T('ss.failed'), T('ss.failedTip')];
    return fileHandle ? ['warn', T('ss.unsaved'), T('ss.unsavedTip', { name: fileHandle.name })] : ['warn', T('ss.autoOnly'), T('ss.autoOnlyTip')];
  }
  K.saveInfo = saveInfo;

  /* ---------- 导出 ---------- */
  let cancel = false;
  const expBg = () => ($('eBg').value === 'color' ? 'color' : 'none');
  /* zip = true：不用文件夹，打成 ZIP 下载（太多帧时分成多个 ZIP，见 zip.js） */
  /* 导出页的那行提示：记下翻译 key 和参数，切换界面语言时重新生成（否则“已取消 / 完成 / 失败”会停在旧语言上） */
  let expLast = null;
  const expSay = (k, p) => { expLast = [k, p]; $('expMsg').textContent = T(k, p); };
  K.on('lang', () => { if (expLast) $('expMsg').textContent = T(expLast[0], expLast[1]); });
  const busy = (on) => { $('bCancel').hidden = !on; $('bPng').disabled = $('bZip').disabled = $('bMp4').disabled = on; };
  async function exportPng(zip) {
    let dir = null;
    if (!zip) {
      if (!window.showDirectoryPicker) { K.toast(T('exp.needChrome'), 'error'); return; }
      try { dir = await window.showDirectoryPicker({ mode: 'readwrite' }); } catch (e) { return; }
    }
    await K.ensureFont();
    const S = K.S(), fps = +S.fps, t0 = parseFloat($('eStart').value) || 0, t1 = parseFloat($('eEnd').value) || K.dur();
    const n = Math.max(1, Math.round((t1 - t0) * fps)), bg = expBg();
    const c = document.createElement('canvas'); c.width = S.W; c.height = S.H; const g = c.getContext('2d');
    const toBlob = () => new Promise((r) => c.toBlob(r, 'image/png'));
    let sink = { put: async (name, blob) => { const w = await (await dir.getFileHandle(name, { create: true })).createWritable(); await w.write(blob); await w.close(); }, end: async () => {}, files: () => 0 };
    if (zip) {
      const est = await K.estimateSequence(g, bg, t0, n, fps), per = Math.max(50, Math.min(K.ZIP_PER, Math.floor(3e9 / Math.max(est.sample, 1))));
      if (est.bytes > K.ZIP_WARN && !(await K.zipConfirm(est, Math.ceil(n / per)))) return;
      sink = K.zipSink({ total: n, per, base: 'lyrics_png', save: (b, name) => K.download(b, name) });
    }
    cancel = false; busy(true); const st = performance.now();
    /* 主线程只画；PNG 编码交给线程池（pngpool.js），写文件 / 进 ZIP 也不挡着下一帧。
       同时在途的帧数有上限（每帧一份未压缩的位图）；没有线程池的浏览器退回逐帧 toBlob。
       画面和上一帧一模一样（指纹相同：静止的歌词、空白）就不重画不重编，直接复用上一帧的 PNG */
    const pool = await K.pngPool(), lim = pool ? pool.size + 2 : 1, live = new Set();
    let blank = null, lastKey = null, lastP = null, tail = Promise.resolve(), err = null, f = 0;
    try {
      for (; f < n && !cancel && !err; f++) {
        const t = t0 + f / fps, key = K.frameKey(t, S.W, S.H);
        let bp = key === lastKey ? lastP : key === '' ? blank : null;
        if (!bp) {
          K.render(g, t, { bg });
          bp = pool ? pool.encode(await createImageBitmap(c)) : toBlob();     // 等位图取走这一帧，再画下一帧
          bp.catch(() => {}); if (key === '') blank = bp;
        }
        lastKey = key; lastP = bp;
        const name = `lyrics_${String(f + 1).padStart(6, '0')}.png`, put = (b) => sink.put(name, b);
        /* ZIP 要按帧号顺序写（分卷按顺序切）；写文件夹不分先后，几个文件同时写 */
        const job = (zip ? (tail = tail.then(() => bp).then(put)) : bp.then(put)).catch((e) => { err = err || e; });
        live.add(job); job.then(() => live.delete(job));
        while (live.size >= lim) await Promise.race(live);
        if (f % 10 === 0) { $('prog').firstElementChild.style.width = (100 * f) / n + '%'; expSay('exp.progress', { i: f + 1, n, s: ((performance.now() - st) / 1000).toFixed(0) }); await new Promise((r) => setTimeout(r)); }
      }
      await Promise.all(live); if (err) throw err;
      if (!(cancel && zip)) await sink.end();                              // 取消 ZIP：手上还没出的这一卷直接丢掉，不下载
      if (cancel) expSay(!zip ? 'exp.cancelled' : sink.files() ? 'exp.cancelledZipParts' : 'exp.cancelledZip', { n: f, z: sink.files() });
      else { $('prog').firstElementChild.style.width = '100%'; expSay(zip ? 'exp.doneZip' : 'exp.done', { n, w: S.W, h: S.H, fps, t0, z: sink.files() }); }
    } catch (e) { await Promise.all(live); expSay('exp.failed', { msg: e.message }); }
    if (pool) pool.close();
    busy(false);
  }
  /* 直接导出 MP4（H.264）：比 PNG 序列小得多也快得多，但没有透明通道——背景选“透明”时用抠像色铺底（和录屏一样） */
  async function exportMp4() {
    const S = K.S(), fps = +S.fps, t0 = parseFloat($('eStart').value) || 0, t1 = parseFloat($('eEnd').value) || K.dur();
    const n = Math.max(1, Math.round((t1 - t0) * fps)), bg = expBg() === 'color' ? 'color' : 'key';
    const W = S.W + (S.W & 1), H = S.H + (S.H & 1), cfg = await K.videoConfig(W, H, fps);            // H.264 的宽高必须是偶数
    if (!cfg) { K.toast(T('exp.noVideo'), 'error'); return; }
    await K.ensureFont();
    const c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d');
    cancel = false; busy(true); const st = performance.now(); let lastKey = null;
    try {
      const r = await K.encodeVideo({ canvas: c, cfg, fps, frames: n, cancelled: () => cancel,
        draw: (f) => { const t = t0 + f / fps, key = K.frameKey(t, W, H); if (key !== lastKey) K.render(g, t, { bg }); lastKey = key; },
        progress: (f) => { $('prog').firstElementChild.style.width = (100 * f) / n + '%'; expSay('exp.progress', { i: f + 1, n, s: ((performance.now() - st) / 1000).toFixed(0) }); } });
      if (!r) expSay('exp.cancelledMp4');             // 取消：半截视频没用，不保存
      else { K.download(r.blob, 'lyrics.mp4'); $('prog').firstElementChild.style.width = '100%'; expSay('exp.doneMp4', { n: r.frames, w: W, h: H, fps, t0, size: K.fmtBytes(r.blob.size) }); }
    } catch (e) { expSay('exp.failed', { msg: e.message }); }
    busy(false);
  }
  function exportFrame() {
    const S = K.S(), c = document.createElement('canvas'); c.width = S.W; c.height = S.H;
    K.render(c.getContext('2d'), K.now(), { bg: expBg() });
    c.toBlob((b) => download(b, `frame_${K.now().toFixed(2)}s.png`), 'image/png');
  }

  /* ---------- 每帧 ----------
     画布由 drawStage / drawTimeline 自己判断要不要重画；DOM 文字 / 属性只在变化时写入 */
  const shown = {}, cv = $('cv');
  const setText = (id, s) => { if (shown[id] !== s) { shown[id] = s; $(id).textContent = s; } };
  const setOnce = (k, v, fn) => { if (shown[k] !== v) { shown[k] = v; fn(); } };
  K.tick = (ts) => {
    let ended = false;                       // 内部时钟这一帧走到了结尾（循环中要跳回去，而不是停下）
    if (!mode && clk.playing) { clk.t += ((ts - clk.last) / 1000) * K.ui.speed; clk.last = ts; if (clk.t >= K.dur()) { clk.t = K.dur(); clk.playing = false; ended = true; } }
    const lr = K.loopRange(); if (lr && (ended || (K.playing() && K.now() >= lr[1]))) { K.seek(lr[0]); if (!K.playing()) K.play(); }
    const t = K.now();
    K.drawStage(mode === 'file' ? media : null);
    if (mode === 'yt') Y.layout(cv, K.S().useVideoBg);
    if (!document.body.classList.contains('rec')) {
      K.drawTimeline(); K.refreshPanels(); K.markNow(t - K.S().offset);
      const pl = K.playing();
      setOnce('play', pl + K.lang, () => { const b = $('bPlay'); b.textContent = pl ? '⏸' : '▶'; b.setAttribute('aria-label', T(pl ? 'bar.pause' : 'bar.play')); });
      setText('tm', K.fmt(t) + ' / ' + K.fmt(K.dur()));
      setOnce('clock', [mode, pl, K.lang].join(), () => { const c = $('clock'); c.hidden = !!mode; c.classList.toggle('on', pl); });
      const si = saveInfo();
      setOnce('save', si.join('|'), () => { const b = $('saveState'); b.className = 'chip ' + si[0]; b.querySelector('span').textContent = si[1]; b.title = si[2]; b.setAttribute('aria-label', si[1] + '. ' + si[2]); });
      /* 刚打开、还是没动过的内置示例：标题只写应用名（搜索引擎抓到的就是这个；可用 app.titleHome 覆盖，在线版换成带关键词的），不带示例的名字 */
      const home = K.doc.src === 'sample' && !K.dirty;
      const dt = home ? (K.I18N[K.lang] || {})['app.titleHome'] || T('app.name') : (K.dirty ? '● ' : '') + (K.project.title || T('untitled')) + ' — ' + T('app.name');
      if (document.title !== dt) document.title = dt;
    }
  };
  /* 某一帧出错也不让循环停掉（否则整个界面冻结） */
  function frame(ts) { try { K.tick(ts); } finally { requestAnimationFrame(frame); } }

  /* ---------- 启动 ---------- */
  function fillSamples() {
    const sm = $('samples');
    while (sm.options.length > 1) sm.remove(1);
    (K.SAMPLES || []).forEach((s, i) => { const o = document.createElement('option'), k = 'sample.' + s.project.title; o.value = i; o.textContent = K.has(k) ? T(k) : s.name; sm.appendChild(o); });
  }
  function undoUi() {
    const u = K.undoWhy(), r = K.redoWhy(), bu = $('bUndo'), br = $('bRedo');
    bu.disabled = !K.canUndo(); br.disabled = !K.canRedo();
    bu.title = u != null ? T('top.undoWhat', { what: T(u ? 'u.' + u : 'u.edit') }) : T('top.undoNone');
    br.title = r != null ? T('top.redoWhat', { what: T(r ? 'u.' + r : 'u.edit') }) : T('top.redoNone');
  }
  function boot() {
    const auto = K.loadAutosave(), first = K.firstRun(!!auto);
    if (auto) { const m = K.loadAutosaveMeta(); K.project = K.normalizeProject(auto); K.dirty = m.dirty; K.doc = { src: m.src, name: m.name }; }
    else if (K.SAMPLES && K.SAMPLES[0]) { K.project = K.normalizeProject(K.SAMPLES[0].project); K.doc = { src: 'sample', name: '' }; }
    else K.project = K.blank();
    K.resetHistory();
    K.initStage(); K.initTimeline(); K.initPanels(); K.initLayout();
    $('title').value = K.project.title; syncEnd();
    $('title').onchange = (e) => { K.project.title = e.target.value; K.commit('title'); };
    $('eEnd').addEventListener('input', (e) => { eEndManual = e.target.value.trim() !== ''; });
    K.on('load', (why) => { if (why === 'project') { eEndManual = false; bannerOff = false; } syncYt(why); $('title').value = K.project.title; syncEnd(); $('s_fps').value = K.S().fps; mediaUi(); K.renderEmpty(); });
    K.on('change', () => { undoUi(); if (!K.project.lines.length !== !$('empty').hidden) K.renderEmpty(); });
    $('s_fps').value = K.S().fps; $('s_fps').onchange = (e) => { K.S().fps = +e.target.value; K.commit('settings'); };

    /* 界面语言 */
    const lg = $('lang');
    K.LANGS.forEach(([c, n]) => { const o = document.createElement('option'); o.value = c; o.textContent = n; lg.appendChild(o); });
    lg.value = K.lang; lg.onchange = () => { K.setLang(lg.value); lg.blur(); };
    const hint = () => { const k = $('keys'); k.textContent = K.keyHint(); k.title = T('bar.hintTip'); };
    K.on('lang', () => { lg.value = K.lang; fillSamples(); Object.keys(shown).forEach((k) => (shown[k] = null)); mediaUi(); undoUi(); hint(); K.renderEmpty(); K.setVolume(media.volume, media.muted); });

    const sm = $('samples');
    fillSamples();
    sm.onchange = () => { const v = sm.value; sm.value = ''; sm.blur(); if (v !== '') K.loadSample(+v); };
    $('bNew').onclick = () => K.newProject();
    $('bOpen').onclick = () => openDialog();
    $('bSave').onclick = save; $('bSaveAs').onclick = saveAs;
    $('saveState').onclick = save;
    $('bImport').onclick = () => K.importMenu($('bImport'));
    $('bMedia').onclick = () => K.mediaMenu($('bMedia')); $('mbLoad').onclick = () => K.mediaMenu($('mbLoad'));
    $('mbClose').onclick = () => { bannerOff = true; mediaUi(); };
    $('bHelp').onclick = $('keys').onclick = () => K.showHelp();
    $('bUndo').onclick = K.undo; $('bRedo').onclick = K.redo;
    $('bAdd').onclick = () => K.ops.add(K.r3(K.now() - K.S().offset));
    $('bPlay').onclick = () => (K.playing() ? K.pause() : K.play());
    $('bLoop').onclick = () => K.toggleLoop();
    $('speed').innerHTML = K.SPEEDS.map((v) => `<option value="${v}">${v}×</option>`).join('');
    $('speed').onchange = (e) => K.setSpeed(e.target.value); K.setSpeed(K.ui.speed);
    K.setVolume(K.prefNum('vol', 0, 1, 1), K.pref('muted') === true);
    $('vol').oninput = (e) => K.setVolume(e.target.value, false);
    $('bMute').onclick = () => K.setVolume(media.volume || 1, !media.muted);
    $('bZin').onclick = () => K.tlZoom(1.4); $('bZout').onclick = () => K.tlZoom(1 / 1.4);
    $('bFit').onclick = () => K.tlFit(); $('bFitSel').onclick = () => (K.sel() ? K.tlFitSel() : K.toast(T('msg.loopNeedSel')));
    const setTool = (v) => { K.ui.tool = v === 'scrub' ? 'scrub' : 'retime'; document.querySelectorAll('#tool button').forEach((x) => { x.classList.toggle('on', x.dataset.v === K.ui.tool); x.setAttribute('aria-pressed', x.dataset.v === K.ui.tool); }); };
    document.querySelectorAll('#tool button').forEach((b) => (b.onclick = () => { setTool(b.dataset.v); K.pref('tool', K.ui.tool); }));
    setTool(K.pref('tool'));
    $('bRec').onclick = () => { Y.settings(false); document.body.classList.add('rec'); document.documentElement.requestFullscreen && document.documentElement.requestFullscreen().catch(() => {}); };
    document.addEventListener('fullscreenchange', () => { if (!document.fullscreenElement) document.body.classList.remove('rec'); });
    $('bPng').onclick = () => exportPng(false); $('bZip').onclick = () => exportPng(true); $('bMp4').onclick = exportMp4; $('bFrame').onclick = exportFrame; $('bCancel').onclick = () => (cancel = true);
    if (!window.showDirectoryPicker) { $('bPng').hidden = true; $('bZip').classList.add('pri'); $('bPng').classList.remove('pri'); }      // 没有文件夹 API：ZIP 就是主要方式
    K.bindLyricExport();

    /* 拖入文件：DataTransfer 在第一次 await 之后就被清空，所以先同步取出所有文件 / 句柄，再排队逐个处理（工程在前、媒体在后） */
    let dragN = 0; const dz = $('dropzone'), hasFiles = (e) => e.dataTransfer && [...(e.dataTransfer.types || [])].includes('Files');
    addEventListener('dragenter', (e) => { if (!hasFiles(e)) return; dragN++; dz.hidden = false; });
    addEventListener('dragleave', (e) => { if (!hasFiles(e)) return; if (--dragN <= 0) { dragN = 0; dz.hidden = true; } });
    /* 往输入框里拖文字是浏览器自带的操作，不拦；其余地方接收文件 / YouTube 链接 */
    const intoField = (e) => !hasFiles(e) && !!(e.target && e.target.closest && e.target.closest('input, textarea, [contenteditable]'));
    addEventListener('dragover', (e) => { if (!intoField(e)) e.preventDefault(); });
    addEventListener('drop', (e) => {
      if (intoField(e)) return;
      e.preventDefault(); dragN = 0; dz.hidden = true;
      const dt = e.dataTransfer, items = [...(dt.items || [])].filter((it) => it.kind === 'file');
      /* 没有文件、拖进来的是 YouTube 链接（如从地址栏 / 别的标签页）：用这个视频 */
      /* 只认链接：光是 11 个字母数字（K.ytId 也接受的裸 ID）可能只是一个普通的词 */
      if (!items.length && !(dt.files && dt.files.length)) { const s = (dt.getData('text/uri-list') || dt.getData('text/plain') || '').split('\n')[0].trim(), id = /[./]/.test(s) ? K.ytId(s) : ''; if (id) queue(() => K.setYouTube(id)); return; }
      const jobs = items.length
        ? items.map((it) => ({ file: it.getAsFile(), handle: it.getAsFileSystemHandle ? it.getAsFileSystemHandle().catch(() => null) : null }))
        : [...(dt.files || [])].map((f) => ({ file: f, handle: null }));
      jobs.sort((a, b) => (a.file && isMedia(a.file) ? 1 : 0) - (b.file && isMedia(b.file) ? 1 : 0));
      queue(async () => {
        for (const j of jobs) {
          const h = await j.handle, f = h && h.kind === 'file' ? await h.getFile().catch(() => j.file) : j.file;
          if (f) await openFile(f, h && h.kind === 'file' ? h : null);
        }
      });
    });
    /* 有还没写进文件的修改（只在浏览器自动保存里）时提醒；没改过的示例不提醒 */
    addEventListener('beforeunload', (e) => { if (K.dirty) { e.preventDefault(); e.returnValue = ''; } });

    addEventListener('keydown', K.keyHandler);
    K.on('select', () => {
      K.ui.tapArmed = false;
      if (K.ui.loop) { const r = K.loopRange(); if (!r) K.toggleLoop(false); else if (K.now() < r[0] || K.now() > r[1]) K.seek(r[0]); }
    });
    Y.init($('ytBox'), $('ytBar')); syncYt('project');
    $('bYtSet').onclick = () => Y.settings(!Y.inSettings());
    hint(); undoUi(); mediaUi(); K.renderEmpty(); loopUi();
    K.ensureFont();
    if (first) {
      /* 第一次来：背后放着示例（停在一句唱到一半的地方，让人一眼看懂这是做什么的），上面是欢迎页 */
      const f = K.screen().ord[0]; if (f) K.seek(K.ls(f) + K.S().offset + 0.8);
      K.showWelcome();
    }
    requestAnimationFrame(frame);
  }
  boot();
})();
