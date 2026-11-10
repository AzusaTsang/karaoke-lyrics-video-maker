/* 歌词的进出：粘贴 / 输入歌词（"添加歌词"对话框）、LRC（含逐字增强格式）导入、LRC / SRT / ASS 导出 */
(function () {
  const K = window.K, $ = (id) => document.getElementById(id), T = (k, p) => K.t(k, p), esc = K.esc, et = (k, p) => esc(T(k, p));
  K.IMPORT_ACCEPT = '.srt,.lrc,.json';
  const clamp = (v, lo, hi, d) => { v = parseFloat(v); return isFinite(v) ? Math.max(lo, Math.min(hi, v)) : d; };
  const plain = (l) => l.units.map((u) => u.t).join('');
  const byStart = () => K.project.lines.slice().sort((a, b) => K.ls(a) - K.ls(b));

  /* ================= 粘贴 / 输入歌词 ================= */
  const MAX_LINES = 1000, MAX_CHARS = 300;
  /* 纯文本 → [{text, para}]：一行一句，空行 = 分段（para 标在空行之后的那一行上）；控制字符去掉，制表符当空格 */
  K.splitLyrics = (text) => {
    const out = []; let brk = false;
    String(text == null ? '' : text).replace(/^﻿/, '').split(/\r\n|\r|\n/).forEach((raw) => {
      const s = raw.replace(/\t/g, ' ').replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, MAX_CHARS);
      if (!s) { brk = out.length > 0; return; }
      out.push({ text: s, para: brk }); brk = false;
    });
    return out;
  };
  /* 把歌词排到时间线上：每句 dur 秒、首尾相接（空行处多空出 gap 秒，给预备点留位置），字平均分配，等你用 T 打点。
     o: { mode: 'replace' | 'append', start: 起点(秒，工程时间), dur, gap, firstPara: 第一句是否强制分段 }。一次 commit = 一步撤销。返回新增的行（没有内容返回 null） */
  K.addLyrics = (text, o) => {
    const L = K.splitLyrics(text).slice(0, MAX_LINES); if (!L.length) return null;
    const dur = clamp(o.dur, 0.2, 120, 3), gap = clamp(o.gap, 0, 120, 4); let t = Math.max(0, +o.start || 0);
    const rows = L.map((x, i) => { if (i && x.para) t += gap; const r = { start: t, end: t + dur, text: x.text, newPara: i ? (x.para ? true : null) : (o.firstPara ? true : null) }; t += dur; return r; });
    const lines = K.normalizeProject({ lines: rows }).lines;         // 和读工程文件走同一套清洗；注音 {…} 的写法由 parseText 解析
    lines.forEach((l) => l.units.forEach((u) => { if (u.r) u.r = u.r.slice(0, 64); }));
    if (!lines.length) return null;
    K.project.lines = o.mode === 'replace' ? lines : K.project.lines.concat(lines);
    K.project.duration = Math.max(K.project.duration, Math.ceil(t + 5));
    K.commit('paste'); K.select(lines[0].id);
    return lines;
  };

  K.pasteLyrics = (init) => {
    const has = K.project.lines.length > 0;
    const st = { text: (init && init.text) || '', mode: has ? 'append' : 'replace', start: 'playhead', dur: K.prefNum('plDur', 0.5, 60, 3), gap: K.prefNum('plGap', 0, 30, 4) };
    let dEl = null;
    const read = () => {
      if (!dEl || !dEl.querySelector('#plText')) return;
      const q = (s) => dEl.querySelector(s);
      st.text = q('#plText').value; st.mode = q('#plMode').value; st.start = q('#plStart').value; st.dur = clamp(q('#plDur').value, 0.5, 60, st.dur); st.gap = clamp(q('#plGap').value, 0, 30, st.gap);
    };
    const upd = () => {
      read(); if (!dEl) return;
      const after = dEl.querySelector('#plStart option[value="after"]'), canAfter = st.mode === 'append' && K.project.lines.length > 0;
      after.disabled = !canAfter; if (!canAfter && st.start === 'after') { st.start = 'playhead'; dEl.querySelector('#plStart').value = 'playhead'; }
      const all = K.splitLyrics(st.text), n = Math.min(all.length, MAX_LINES), paras = all.slice(0, n).filter((x, i) => i && x.para).length + (n ? 1 : 0);
      dEl.querySelector('#plCount').textContent = n ? T('pl.count', { n, p: paras, s: Math.round(n * st.dur + (paras - 1) * st.gap) }) + (all.length > MAX_LINES ? ' ' + T('pl.tooMany', { max: MAX_LINES }) : '') : T('pl.countNone');
      const go = dEl.querySelector('.dacts .pri'); if (go) go.disabled = !n;
    };
    const opt = (v, cur, label) => `<option value="${v}"${v === cur ? ' selected' : ''}>${esc(label)}</option>`;
    return K.dialog({ cls: 'paste', cancel: false, focus: '#plText',
      render: () => {
        read();
        return { title: T('pl.title'), html:
          `<p class="hint">${et('pl.lead')}</p><label class="blk" for="plText">${et('pl.textLabel')}</label>` +
          `<textarea id="plText" rows="11" spellcheck="false" placeholder="${et('pl.placeholder')}">${esc(st.text)}</textarea><div class="hint" id="plCount" aria-live="polite"></div>` +
          `<div class="opts"><label for="plMode">${et('pl.mode')}</label><select id="plMode">${opt('append', st.mode, T('pl.append'))}${opt('replace', st.mode, T('pl.replace'))}</select>` +
          `<label for="plStart">${et('pl.start')}</label><select id="plStart">${opt('playhead', st.start, T('pl.atPlayhead'))}${opt('zero', st.start, T('pl.atZero'))}${opt('after', st.start, T('pl.afterLast'))}</select>` +
          `<label for="plDur">${et('pl.dur')}</label><input id="plDur" type="number" min="0.5" max="60" step="0.5" value="${st.dur}">` +
          `<label for="plGap">${et('pl.gap')}</label><input id="plGap" type="number" min="0" max="30" step="0.5" value="${st.gap}"></div>` +
          `<p class="hint">${et('pl.next')}</p>`,
          buttons: [{ label: T('dlg.cancel'), value: false }, { label: T('pl.go'), value: 'go', pri: true }] };
      },
      onPaint: (d) => { dEl = d; if (!d._pl) { d._pl = 1; d.addEventListener('input', upd); d.addEventListener('change', upd); } upd(); },
    }).then((v) => {
      if (v !== 'go') return null;
      K.pref('plDur', st.dur); K.pref('plGap', st.gap);
      const last = K.project.lines.reduce((m, l) => Math.max(m, l.end), 0);
      const start = st.start === 'zero' ? 0 : st.start === 'after' ? last + st.gap : Math.max(0, K.r3(K.now() - K.S().offset));
      const lines = K.addLyrics(st.text, { mode: st.mode, start, dur: st.dur, gap: st.gap, firstPara: st.mode === 'append' && has && st.start === 'after' });
      if (!lines) { K.toast(T('pl.empty')); return null; }
      K.seek(Math.max(0, K.ls(lines[0]) + K.S().offset - 1)); K.tlReveal && K.tlReveal(K.ls(lines[0]) + K.S().offset);
      K.toast(T('pl.done', { n: lines.length }), 'ok');
      return lines;
    });
  };

  /* 顶栏"添加歌词"按钮：粘贴歌词 / 导入文件 */
  K.importMenu = (btn) => {
    const r = btn.getBoundingClientRect();
    K.menu(r.left, r.bottom + 4, [[T('imp.paste'), () => K.pasteLyrics()], [T('imp.file'), () => K.openDialog(K.IMPORT_ACCEPT)]]);
    const f = document.querySelector('#menu button'); if (f) f.focus();
  };
  /* 欢迎页 / 空状态里的入口（插在"试试示例"后面） */
  K.welcomeActions.splice(1, 0, { id: 'paste', label: 'w.paste', desc: 'w.pasteDesc', where: ['welcome', 'empty'], run: () => K.pasteLyrics() });

  /* ================= LRC 导入 ================= */
  const TS = '(\\d{1,3}):(\\d{1,2})(?:[.:](\\d{1,3}))?';
  const STAMP = new RegExp('^\\[' + TS + '\\]'), TAG = new RegExp('<' + TS + '>', 'g'), META = /^\[([A-Za-z]+):([^\]]*)\]$/;
  const secs = (m) => +m[1] * 60 + +m[2] + (m[3] ? +('0.' + m[3]) : 0);
  const MAX_TAIL = 8;                      // 没有明确结束时间的行，最多比它最后一个时间戳多持续这么久
  /* 标准 [mm:ss.xx]歌词（一行可以有多个时间戳）、元数据 [ti:] [offset:]、增强 / A2 的 <mm:ss.xx> 逐字标签 → 可交给 K.normalizeProject 的对象。
     offset 按 LRC 规范：正数 = 歌词提前出现，即 时间 = 时间戳 − offset */
  K.parseLrc = (text) => {
    const meta = {}, ents = [];
    String(text).replace(/^﻿/, '').split(/\r\n|\r|\n/).forEach((raw) => {
      let s = raw.trim(), m; const stamps = [];
      while ((m = STAMP.exec(s))) { stamps.push(secs(m)); s = s.slice(m[0].length).replace(/^\s+/, ''); }
      if (!stamps.length) { if ((m = META.exec(s))) meta[m[1].toLowerCase()] = m[2].trim(); return; }
      ents.push({ stamps, body: s.replace(/\s+$/, '') });
    });
    const off = (parseInt(meta.offset, 10) || 0) / 1000, all = [];
    ents.forEach((e) => {
      const tags = [], texts = []; let pos = 0, m; TAG.lastIndex = 0;
      while ((m = TAG.exec(e.body))) { texts.push(e.body.slice(pos, m.index)); tags.push(secs(m)); pos = m.index + m[0].length; }
      texts.push(e.body.slice(pos));
      e.stamps.forEach((st, k) => {
        const d = st - e.stamps[0] - off, start = Math.max(0, st - off), segs = [];
        if (!tags.length || texts[0].trim()) segs.push({ at: start, text: texts[0] });
        tags.forEach((tg, i) => segs.push({ at: Math.max(0, tg + d), text: texts[i + 1] }));
        let end = null; const lastSeg = segs[segs.length - 1];
        if (tags.length && lastSeg && !lastSeg.text.trim()) { end = lastSeg.at; segs.pop(); }      // 末尾的 <时间> 后面没有字 = 这一行的结束时间
        all.push({ start, segs, end, blank: !segs.some((x) => x.text.trim()) });
      });
    });
    all.sort((a, b) => a.start - b.start);                 // 稳定排序：同一时间戳的多行（如原文 / 译文）保持文件里的顺序
    const lines = [];
    all.forEach((e, i) => {
      if (e.blank) return;                                 // 只有时间戳没有字的行 = 前一行的结束标记（已体现在“下一条的开始”里）
      const nx = all.find((x, j) => j > i && x.start > e.start + 1e-3), nextStart = nx ? nx.start : Infinity, lastAt = e.segs[e.segs.length - 1].at;
      let end = e.end != null && e.end > e.segs[0].at ? e.end : Math.min(nextStart, Math.max(lastAt, e.start) + MAX_TAIL);
      end = Math.max(end, lastAt + 0.05);
      const units = [];
      e.segs.forEach((sg, i2) => {
        let txt = sg.text; if (i2 === 0) txt = txt.replace(/^\s+/, ''); if (i2 === e.segs.length - 1) txt = txt.replace(/\s+$/, '');
        const nxAt = i2 + 1 < e.segs.length ? e.segs[i2 + 1].at : end, us = K.parseText(txt); if (!us.length) return;
        const tmp = { units: us, end: 0 }; K.evenSplit(tmp, sg.at, Math.max(nxAt, sg.at));
        us.forEach((u) => units.push({ t: u.t, r: u.r, s: u.s }));
      });
      if (units.length) lines.push({ start: units[0].s, end, units });
    });
    if (!lines.length) throw new Error(T('msg.lrcNone'));
    return { title: meta.ti || '', lines };
  };

  /* ================= 导出：LRC / SRT / ASS =================
     时间都加上“整体偏移”（样式里的同步偏移），这样导出的文件对着媒体直接就是对的；注音（furigana）三种格式都表示不了，导出时去掉 */
  const pad = (n, w) => String(n).padStart(w || 2, '0');
  const lrcT = (t) => { const cs = Math.max(0, Math.round(t * 100)), m = Math.floor(cs / 6000), r = cs - m * 6000; return pad(m) + ':' + pad(Math.floor(r / 100)) + '.' + pad(r % 100); };
  K.exportLrcText = (words) => {
    const off = K.S().offset, head = []; const ti = (K.project.title || '').replace(/[\r\n\]]/g, ' ').trim();
    if (ti) head.push('[ti:' + ti + ']');
    head.push('[re:Karaoke Lyrics Studio]', '[ve:' + K.APP.version + ']');
    const body = byStart().filter((l) => plain(l).trim()).map((l) => '[' + lrcT(K.ls(l) + off) + ']' +
      (words ? l.units.map((u) => '<' + lrcT(u.s + off) + '>' + u.t).join('') + '<' + lrcT(l.end + off) + '>' : plain(l)));
    return head.concat(body).join('\n') + '\n';
  };
  const srtT = (t) => { const ms = Math.max(0, Math.round(t * 1000)); return pad(Math.floor(ms / 3600000)) + ':' + pad(Math.floor(ms / 60000) % 60) + ':' + pad(Math.floor(ms / 1000) % 60) + ',' + pad(ms % 1000, 3); };
  K.exportSrtText = () => {
    const off = K.S().offset;
    return byStart().filter((l) => plain(l).trim()).map((l, i) => (i + 1) + '\n' + srtT(K.ls(l) + off) + ' --> ' + srtT(l.end + off) + '\n' + plain(l).trim()).join('\n\n') + '\n';
  };
  /* "#rrggbb" → ASS 的 BBGGRR（样式行里写 &H00BBGGRR，行内标签里写 &HBBGGRR&） */
  K.assColor = (hex) => { const h = /^#[0-9a-f]{6}$/i.test(hex) ? hex.slice(1) : 'ffffff'; return (h.slice(4, 6) + h.slice(2, 4) + h.slice(0, 2)).toUpperCase(); };
  const assT = (t) => { const cs = Math.max(0, Math.round(t * 100)), h = Math.floor(cs / 360000), m = Math.floor(cs / 6000) % 60, s = Math.floor(cs / 100) % 60; return h + ':' + pad(m) + ':' + pad(s) + '.' + pad(cs % 100); };
  const assEsc = (s) => s.replace(/\\/g, '＼').replace(/\{/g, '｛').replace(/\}/g, '｝');
  K.exportAssText = () => {
    const S = K.S(), off = S.offset, sc = K.screen(), fam = ((S.font.match(/^\s*(?:'([^']+)'|"([^"]+)"|([^,]+))/) || []).slice(1).find(Boolean) || 'Arial').trim().replace(/[,\r\n]/g, ' ');
    const mx = Math.round(S.marginX * S.W), c = (k) => '&H00' + K.assColor(S[k]);
    const head = ['[Script Info]', '; ' + T('app.name'), 'Title: ' + (K.project.title || '').replace(/[\r\n]/g, ' '), 'ScriptType: v4.00+', 'WrapStyle: 2', 'ScaledBorderAndShadow: yes', 'PlayResX: ' + S.W, 'PlayResY: ' + S.H, '',
      '[V4+ Styles]', 'Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding',
      // 卡拉OK：SecondaryColour = 还没唱到的颜色，PrimaryColour = 擦过之后的颜色
      ['Style: Default', fam, S.size, c('highFill'), c('baseFill'), c('baseStroke'), '&H00000000', S.weight === 'normal' ? 0 : -1, 0, 0, 0, 100, 100, S.spacing, 0, 1, S.strokeW, 0, 2, mx, mx, Math.max(0, Math.round(S.H * (1 - S.posY))), 1].join(','), '',
      '[Events]', 'Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text'];
    const ev = sc.ord.filter((l) => plain(l).trim()).map((l) => {
      const I = sc.info.get(l.id), show = Math.round((I.show + off) * 100), a = Math.round((K.ls(l) + off) * 100);
      const end = Math.max(Math.round((I.hide + S.fadeOut + off) * 100), Math.round((l.end + off) * 100));
      let prev = a, txt = '{\\an' + (I.align === 'left' ? 1 : I.align === 'right' ? 3 : 2) + '\\fad(' + Math.round(S.fadeIn * 1000) + ',' + Math.round(S.fadeOut * 1000) + ')}' + (a > show ? '{\\k' + (a - show) + '}' : '');
      l.units.forEach((u, i) => { const nx = Math.round((K.unitEnd(l, i) + off) * 100); txt += '{\\kf' + Math.max(0, nx - prev) + '}' + assEsc(u.t); prev = Math.max(prev, nx); });
      const mv = Math.max(0, Math.round(S.H - (S.posY * S.H + I.row * K.rowStep()) - S.size * 0.22));
      return ['Dialogue: 0', assT(Math.min(show, a) / 100), assT(end / 100), 'Default', '', mx, mx, mv, '', txt].join(',');
    });
    return head.concat(ev).join('\n') + '\n';
  };

  /* 导出按钮（Export 标签页） */
  K.bindLyricExport = () => {
    const base = () => (K.project.title || 'lyrics').replace(/[\\/:*?"<>|]/g, '_');
    const go = (id, ext, fn) => { $(id).onclick = () => { if (!K.project.lines.length) { K.toast(T('exp.noLines'), 'error'); return; } K.download(new Blob([fn()], { type: 'text/plain;charset=utf-8' }), base() + ext); K.toast(T('exp.saved', { name: base() + ext }), 'ok'); }; };
    go('bLrc', '.lrc', () => K.exportLrcText(true)); go('bLrcLines', '.lrc', () => K.exportLrcText(false)); go('bSrt', '.srt', K.exportSrtText); go('bAss', '.ass', K.exportAssText);
  };
})();
