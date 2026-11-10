/* 主程序：播放时钟、媒体、工程文件、导入导出、快捷键 */
(function () {
  const K = window.K, $ = (id) => document.getElementById(id);
  const media = $('media'); let hasMedia = false;
  const clk = { playing: false, t: 0, last: 0 };
  K.dur = () => (hasMedia && isFinite(media.duration) ? media.duration : K.project.duration);
  K.now = () => (hasMedia ? media.currentTime : clk.t);
  K.seek = (t) => { t = Math.max(0, Math.min(K.dur(), t)); if (hasMedia) media.currentTime = t; else clk.t = t; if (K.tlReveal && !K.tl.scrubbing) K.tlReveal(t); };
  K.playing = () => (hasMedia ? !media.paused : clk.playing);
  K.play = () => { if (hasMedia) media.play(); else { clk.playing = true; clk.last = performance.now(); } };
  K.pause = () => { if (hasMedia) media.pause(); clk.playing = false; };
  let toastT; K.toast = (s) => { const el = $('toast'); el.textContent = s; el.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => (el.hidden = true), 4500); };

  /* ---------- 媒体 ---------- */
  async function loadMedia(f) {
    media.src = URL.createObjectURL(f); hasMedia = true; K.peaks = null;
    K.project.mediaName = f.name; $('mediaName').textContent = f.name;
    media.onloadedmetadata = () => { K.project.duration = Math.ceil(media.duration * 100) / 100; K.autosave(); };
    if (f.size > 400 * 1024 * 1024) { K.toast('文件较大，不生成波形（不影响同步）'); return; }
    try {
      const ac = new (window.AudioContext || window.webkitAudioContext)(), buf = await ac.decodeAudioData(await f.arrayBuffer());
      const rate = 100, n = Math.ceil(buf.duration * rate), data = new Float32Array(n), hop = buf.sampleRate / rate, ch = buf.getChannelData(0);
      for (let i = 0; i < n; i++) { let m = 0; const a = Math.floor(i * hop), b = Math.min(ch.length, Math.floor((i + 1) * hop)); for (let k = a; k < b; k += 4) { const v = Math.abs(ch[k]); if (v > m) m = v; } data[i] = m; }
      K.peaks = { rate, data }; ac.close();
    } catch (e) { K.toast('无法解码音频波形（不影响同步）'); }
  }

  /* ---------- 工程文件 ---------- */
  let fileHandle = null;
  const download = (blob, name) => { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 3000); };
  K.download = download;
  const projBlob = () => new Blob([JSON.stringify(K.project, null, 1)], { type: 'application/json' });
  const TYPES = [{ description: '卡拉OK工程', accept: { 'application/json': ['.kara.json', '.json'] } }];
  async function saveAs() {
    if (!window.showSaveFilePicker) { download(projBlob(), (K.project.title || 'lyrics') + '.kara.json'); K.dirty = false; return; }
    try { fileHandle = await window.showSaveFilePicker({ suggestedName: (K.project.title || 'lyrics') + '.kara.json', types: TYPES }); } catch (e) { return; }
    await save();
  }
  async function save() {
    if (!fileHandle) return saveAs();
    try { const w = await fileHandle.createWritable(); await w.write(projBlob()); await w.close(); K.dirty = false; K.toast('已保存到 ' + fileHandle.name); }
    catch (e) { K.toast('保存失败：' + e.message); }
  }
  function parseSrt(txt) {
    const ts = (s) => { const m = s.trim().match(/(\d+):(\d+):(\d+)[,.](\d+)/); return m ? +m[1] * 3600 + +m[2] * 60 + +m[3] + +m[4] / 1000 : 0; };
    return txt.replace(/^﻿/, '').replace(/\r/g, '').split(/\n\s*\n/).map((b) => {
      const L = b.trim().split('\n'), k = L.findIndex((x) => x.includes('-->')); if (k < 0) return null;
      const [a, c] = L[k].split('-->'); return { start: ts(a), end: ts(c), text: L.slice(k + 1).join(' ').trim() };
    }).filter((c) => c && c.text);
  }
  async function openFile(f, handle) {
    const name = f.name.toLowerCase();
    if (/\.(mp3|wav|m4a|aac|flac|ogg|mp4|mov|mkv|webm)$/.test(name) || /^(audio|video)\//.test(f.type)) return loadMedia(f);
    const txt = await f.text();
    try {
      let p;
      if (name.endsWith('.srt')) { p = K.normalizeProject({ lines: parseSrt(txt) }); Object.assign(p.settings, K.S()); p.title = f.name.replace(/\.srt$/i, ''); K.toast('已导入 SRT：每句的字按时长平均分配，可用打点 (T) 或拖动光标校时'); }
      else { p = K.normalizeProject(JSON.parse(txt)); if (!p.title || p.title === '未命名') p.title = f.name.replace(/(\.kara)?\.json$/i, ''); }
      fileHandle = name.endsWith('.json') && handle ? handle : null;
      K.setProject(p); K.ensureFont(); $('title').value = p.title;
    } catch (e) { K.toast('无法读取：' + e.message); }
  }
  async function openDialog(accept) {
    if (window.showOpenFilePicker && !accept) {
      try { const [h] = await window.showOpenFilePicker({ types: TYPES }); openFile(await h.getFile(), h); } catch (e) {}
      return;
    }
    const i = $('fOpen'); i.accept = accept || '.json'; i.value = ''; i.onchange = () => i.files[0] && openFile(i.files[0]); i.click();
  }

  /* ---------- 导出 ---------- */
  let cancel = false;
  const expBg = () => ($('eBg').value === 'color' ? 'color' : 'none');
  async function exportPng() {
    if (!window.showDirectoryPicker) { K.toast('导出到文件夹需要 Chrome / Edge'); return; }
    let dir; try { dir = await window.showDirectoryPicker({ mode: 'readwrite' }); } catch (e) { return; }
    await K.ensureFont();
    const S = K.S(), fps = +S.fps, t0 = parseFloat($('eStart').value) || 0, t1 = parseFloat($('eEnd').value) || K.dur();
    const n = Math.max(1, Math.round((t1 - t0) * fps)), bg = expBg();
    const c = document.createElement('canvas'); c.width = S.W; c.height = S.H; const g = c.getContext('2d');
    const toBlob = () => new Promise((r) => c.toBlob(r, 'image/png'));
    let blank = null; cancel = false; $('bCancel').hidden = false; $('bPng').disabled = true; const st = performance.now();
    try {
      for (let f = 0; f < n; f++) {
        if (cancel) { $('expMsg').textContent = `已取消，已写入 ${f} 帧`; break; }
        const drew = K.render(g, t0 + f / fps, { bg });
        const blob = drew ? await toBlob() : blank || (blank = await toBlob());
        const w = await (await dir.getFileHandle(`lyrics_${String(f + 1).padStart(6, '0')}.png`, { create: true })).createWritable();
        await w.write(blob); await w.close();
        if (f % 10 === 0) { $('prog').firstElementChild.style.width = (100 * f) / n + '%'; $('expMsg').textContent = `导出中 ${f + 1}/${n}（${((performance.now() - st) / 1000).toFixed(0)}s）`; await new Promise((r) => setTimeout(r)); }
      }
      if (!cancel) { $('prog').firstElementChild.style.width = '100%'; $('expMsg').textContent = `完成：${n} 帧，${S.W}×${S.H} @ ${fps}fps，从 ${t0}s 开始`; }
    } catch (e) { $('expMsg').textContent = '导出失败：' + e.message; }
    $('bCancel').hidden = true; $('bPng').disabled = false;
  }
  function exportFrame() {
    const S = K.S(), c = document.createElement('canvas'); c.width = S.W; c.height = S.H;
    K.render(c.getContext('2d'), K.now(), { bg: expBg() });
    c.toBlob((b) => download(b, `frame_${K.now().toFixed(2)}s.png`), 'image/png');
  }

  /* ---------- 每帧 ---------- */
  function frame(ts) {
    if (!hasMedia && clk.playing) { clk.t += (ts - clk.last) / 1000; clk.last = ts; if (clk.t >= K.dur()) { clk.t = K.dur(); clk.playing = false; } }
    const t = K.now();
    K.drawStage(hasMedia ? media : null);
    if (!document.body.classList.contains('rec')) {
      K.drawTimeline(); K.refreshPanels(); K.markNow(t - K.S().offset);
      $('bPlay').textContent = K.playing() ? '⏸' : '▶';
      $('tm').textContent = K.fmt(t) + ' / ' + K.fmt(K.dur());
      document.title = (K.dirty ? '● ' : '') + (K.project.title || '未命名') + ' — 卡拉OK歌词工作室';
    }
    requestAnimationFrame(frame);
  }

  /* ---------- 启动 ---------- */
  function boot() {
    const auto = K.loadAutosave();
    K.project = auto ? K.normalizeProject(auto) : K.SAMPLES && K.SAMPLES[0] ? K.normalizeProject(K.SAMPLES[0].project) : K.blank();
    K.resetHistory();
    K.initStage(); K.initTimeline(); K.initPanels();
    $('title').value = K.project.title; $('eEnd').value = K.dur().toFixed(2);
    $('title').onchange = (e) => { K.project.title = e.target.value; K.commit(); };
    K.on('load', () => { $('title').value = K.project.title; $('eEnd').value = K.dur().toFixed(2); $('s_fps').value = K.S().fps; });
    $('s_fps').value = K.S().fps; $('s_fps').onchange = (e) => { K.S().fps = +e.target.value; K.commit(); };

    const sm = $('samples');
    (K.SAMPLES || []).forEach((s, i) => { const o = document.createElement('option'); o.value = i; o.textContent = s.name; sm.appendChild(o); });
    sm.onchange = () => { if (sm.value === '') return; if (!K.dirty || confirm('载入示例会替换当前工程（未保存的修改会丢失），继续？')) { fileHandle = null; K.setProject(K.normalizeProject(K.SAMPLES[+sm.value].project)); K.ensureFont(); } sm.value = ''; };
    $('bNew').onclick = () => { if (!K.dirty || confirm('新建会清空当前工程（未保存的修改会丢失），继续？')) { fileHandle = null; const p = K.blank(); Object.assign(p.settings, K.S()); K.setProject(p); } };
    $('bOpen').onclick = () => openDialog();
    $('bSave').onclick = save; $('bSaveAs').onclick = saveAs;
    $('bImport').onclick = () => openDialog('.srt,.json');
    $('bMedia').onclick = () => { const i = $('fOpen'); i.accept = 'audio/*,video/*'; i.value = ''; i.onchange = () => i.files[0] && loadMedia(i.files[0]); i.click(); };
    $('bUndo').onclick = K.undo; $('bRedo').onclick = K.redo;
    $('bAdd').onclick = () => K.ops.add(K.r3(K.now() - K.S().offset));
    $('bPlay').onclick = () => (K.playing() ? K.pause() : K.play());
    $('bZin').onclick = () => K.tlZoom(1.4); $('bZout').onclick = () => K.tlZoom(1 / 1.4);
    document.querySelectorAll('#tool button').forEach((b) => (b.onclick = () => { K.ui.tool = b.dataset.v; document.querySelectorAll('#tool button').forEach((x) => x.classList.toggle('on', x === b)); }));
    $('bRec').onclick = () => { document.body.classList.add('rec'); document.documentElement.requestFullscreen && document.documentElement.requestFullscreen().catch(() => {}); };
    document.addEventListener('fullscreenchange', () => { if (!document.fullscreenElement) document.body.classList.remove('rec'); });
    $('bPng').onclick = exportPng; $('bFrame').onclick = exportFrame; $('bCancel').onclick = () => (cancel = true);

    addEventListener('dragover', (e) => e.preventDefault());
    addEventListener('drop', async (e) => { e.preventDefault(); for (const it of [...e.dataTransfer.items]) { if (it.kind !== 'file') continue; const h = it.getAsFileSystemHandle ? await it.getAsFileSystemHandle().catch(() => null) : null; await openFile(h && h.kind === 'file' ? await h.getFile() : it.getAsFile(), h); } });
    addEventListener('beforeunload', (e) => { if (K.dirty && fileHandle) { e.preventDefault(); e.returnValue = ''; } });

    addEventListener('keydown', (e) => {
      const a = document.activeElement, typing = a && (a.tagName === 'TEXTAREA' || a.tagName === 'SELECT' || (a.tagName === 'INPUT' && !['range', 'checkbox', 'color'].includes(a.type)));
      const ctrl = e.ctrlKey || e.metaKey, k = e.key.toLowerCase();
      if (ctrl && k === 's') { e.preventDefault(); e.shiftKey ? saveAs() : save(); return; }
      if (ctrl && k === 'o') { e.preventDefault(); openDialog(); return; }
      if (typing) { if (e.key === 'Escape') a.blur(); return; }
      if (ctrl && k === 'z') { e.preventDefault(); e.shiftKey ? K.redo() : K.undo(); return; }
      if (ctrl && k === 'y') { e.preventDefault(); K.redo(); return; }
      if (ctrl) return;
      const l = K.sel(), sc = K.screen(), fr = 1 / +K.S().fps;
      const pick = (d) => { const i = l ? sc.ord.indexOf(l) + d : 0, n = sc.ord[Math.max(0, Math.min(sc.ord.length - 1, i))]; if (n) { K.select(n.id); K.tlReveal(K.ls(n) + K.S().offset); } };
      if (e.code === 'Space') { e.preventDefault(); K.playing() ? K.pause() : K.play(); }
      else if (e.key === 'Escape') { document.body.classList.remove('rec'); $('menu').hidden = true; }
      else if (e.key === 'ArrowLeft') K.seek(K.now() - (e.shiftKey ? 5 : 1));
      else if (e.key === 'ArrowRight') K.seek(K.now() + (e.shiftKey ? 5 : 1));
      else if (e.key === ',') K.seek(K.now() - fr);
      else if (e.key === '.') K.seek(K.now() + fr);
      else if (e.key === 'ArrowUp') { e.preventDefault(); pick(-1); }
      else if (e.key === 'ArrowDown') { e.preventDefault(); pick(1); }
      else if (k === 't') { K.ui.tapArmed = true; K.ops.tap(K.r3(K.now() - K.S().offset)); }
      else if (e.key === 'Home' && l) K.seek(Math.max(0, K.ls(l) + K.S().offset - 1));
      else if (!l) return;
      else if (e.key === 'Delete') K.ops.del(l);
      else if (e.key === '[') K.ops.shift(l, e.shiftKey ? -0.1 : -0.02);
      else if (e.key === ']') K.ops.shift(l, e.shiftKey ? 0.1 : 0.02);
      else if (k === 'p') K.ops.set(l, 'newPara', sc.info.get(l.id).para ? (l.newPara === true ? null : false) : true);
      else if (k === 'd') K.ops.set(l, 'dots', l.dots == null ? true : l.dots ? false : null);
      else if (k === 'h') K.ops.dup(l);
      else if (k === 's') K.ops.split(l, K.now() - K.S().offset);
      else if (k === 'm') K.ops.merge(l);
      else if (k === '0') K.ops.set(l, 'row', null);
      else if ('1234'.includes(k)) K.ops.set(l, 'row', +k - 1);
    });
    K.on('select', () => { K.ui.tapArmed = false; });
    K.ensureFont();
    requestAnimationFrame(frame);
  }
  boot();
})();
