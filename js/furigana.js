/* 自动注音：按需从 CDN 加载 kuromoji.js（启动时不加载，用户第一次点"自动注音"并同意后才下载词典），
   把分词结果换成应用的单元模型：一段汉字 = 一个单元 + 平假名注音；送り仮名等其它字符各自一个单元；已有的时间尽量原样保留 */
(function () {
  const K = window.K, $ = (id) => document.getElementById(id), T = (k, p) => K.t(k, p), esc = K.esc, et = (k, p) => esc(T(k, p));
  const CDN = 'https://cdn.jsdelivr.net/npm/kuromoji@0.1.2/';
  const LIB = CDN + 'build/kuromoji.js', DIC = CDN + 'dict/', SRI = 'sha384-LCHxvFGxgpk9Bl+0+OaV6Rf24HQamJPrNHIo6VGkXkVgGWRvl68eqUwCW5PWqfwh', DICT_FILES = 12;
  const F = (K.furi = { tokenizer: null, loading: null, busy: false });
  const HAS_KANJI = /[々〆一-鿿]/, KANJI_RUN = /[々〆ヶ一-鿿]+|[^々〆ヶ一-鿿]+/gu, READING = /^[ぁ-ゖゝゞー]+$/;
  const kata2hira = (s) => s.replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60));
  const len = (s) => Array.from(s).length;

  /* ---------- 加载 kuromoji（只加载一次；失败后可以重试） ---------- */
  const loadScript = () => new Promise((res, rej) => {
    if (window.kuromoji) { res(); return; }
    const s = document.createElement('script');
    s.src = LIB; s.integrity = SRI; s.crossOrigin = 'anonymous'; s.async = true;
    s.onload = () => (window.kuromoji ? res() : rej(new Error('kuromoji missing')));
    s.onerror = () => { s.remove(); rej(new Error('script load failed')); };
    document.head.appendChild(s);
  });
  F.load = () => {
    if (F.tokenizer) return Promise.resolve(F.tokenizer);
    if (F.loading) return F.loading;
    F.loading = loadScript().then(() => new Promise((res, rej) => window.kuromoji.builder({ dicPath: DIC }).build((err, tk) => (err || !tk ? rej(err || new Error('build failed')) : res(tk)))))
      .then((tk) => { F.tokenizer = tk; F.loading = null; return tk; }, (e) => { F.loading = null; throw e; });
    return F.loading;
  };
  /* 词典 12 个文件里已经下载完几个（Resource Timing；失败重试时只算这次开始之后的） */
  F.filesDone = (since) => Math.min(DICT_FILES, performance.getEntriesByType('resource').filter((e) => e.startTime >= since && e.name.indexOf(DIC) === 0).length);

  /* ---------- 分词结果 → 单元 ---------- */
  /* 一个词 (surface, reading) → { specs: [{t, r}], miss }
     与 tools/align/common.py 的 split_units_ja 同一思路：汉字段用 (.+?) 捕获，送り仮名等原样当锚点，在整个读音里匹配；
     这样 受け入れ/ウケイレ → 受{う} け 入{い} れ，各个汉字块只拿到自己的读音。读音对不上（或没有读音）时不加注音，miss = 1 */
  F.tokenSpecs = (surface, reading) => {
    const per = () => Array.from(surface).map((c) => ({ t: c, r: null }));
    if (!HAS_KANJI.test(surface)) return { specs: per(), miss: 0 };
    const hira = kata2hira(String(reading || ''));
    if (!READING.test(hira)) return { specs: per(), miss: 1 };
    const parts = surface.match(KANJI_RUN), pat = parts.map((p) => (HAS_KANJI.test(p) ? '(.+?)' : kata2hira(p).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))).join('');
    const m = new RegExp('^' + pat + '$', 'u').exec(hira);
    if (!m) return { specs: per(), miss: 1 };
    let g = 1; const specs = [];
    parts.forEach((p) => { if (HAS_KANJI.test(p)) specs.push({ t: p, r: m[g++] }); else Array.from(p).forEach((c) => specs.push({ t: c, r: null })); });
    return { specs, miss: 0 };
  };
  /* 整行文字 → { specs: [{a, b, t, r}], miss }（a, b = 按字符计的起止位置）；分词结果和原文对不上时返回 null。
     cuts = 行内换行所在的字符位置：每一排单独分词，单元（注音）不会跨过换行 */
  F.plan = (text, cuts) => {
    const chars = Array.from(text), pts = [0].concat((cuts || []).filter((c) => c > 0 && c < chars.length), [chars.length]), specs = []; let miss = 0;
    for (let x = 0; x + 1 < pts.length; x++) {
      const seg = chars.slice(pts[x], pts[x + 1]).join(''); if (!seg) continue;
      const toks = F.tokenizer.tokenize(seg);
      if (toks.map((t) => t.surface_form).join('') !== seg) return null;
      let pos = pts[x];
      toks.forEach((tk) => { const r = F.tokenSpecs(tk.surface_form, tk.reading); miss += r.miss; r.specs.forEach((sp) => { const n = len(sp.t); specs.push({ a: pos, b: pos + n, t: sp.t, r: sp.r }); pos += n; }); });
    }
    return { specs, miss };
  };
  /* 一行里行内换行的字符位置 */
  F.cuts = (l) => { const c = []; let pos = 0; l.units.forEach((u, i) => { if (u.n && i) c.push(pos); pos += len(u.t); }); return c; };

  /* 把注音套到一行上，尽量保留时间：
     · 已有注音的单元原样保留（overwrite 时才重新注音）；新单元的开始时间取它第一个字原来所在单元的开始时间
       （多个单字并成一个汉字单元 → 取第一个字的时间；拆开原来的多字单元 → 在它的时间内按字数插值）
     · 一个新注音都没加上时不动这一行。返回 { added } */
  F.applyToLine = (l, plan, overwrite) => {
    const old = l.units, oa = [], oldAt = []; let pos = 0;
    old.forEach((u, j) => { oa.push(pos); const n = len(u.t); for (let k = 0; k < n; k++) oldAt.push(j); pos += n; });
    const locked = old.map((u) => !!u.r && !overwrite), items = [];
    plan.specs.forEach((sp) => {
      if (sp.r && !(() => { for (let k = sp.a; k < sp.b; k++) if (locked[oldAt[k]]) return true; return false; })()) { items.push(sp); return; }
      Array.from(sp.t).forEach((c, i) => items.push({ a: sp.a + i, b: sp.a + i + 1, t: c, r: null }));      // 与已有注音冲突 / 没有注音：逐字
    });
    const out = []; let added = 0, p = 0;
    items.forEach((it) => {
      if (it.a < p) return;                                          // 已被一个保留下来的旧单元包含
      const j = oldAt[it.a], jo = old[j], la = oa[j], n = len(jo.t);
      if (locked[j]) { out.push(Object.assign({}, jo, jo.m ? { m: jo.m.slice() } : {})); p = la + n; return; }
      const nx = j + 1 < old.length ? old[j + 1].s : l.end, same = it.a === la && it.b === la + n && (jo.r || null) === (it.r || null);
      const u = { t: it.t, r: it.r, s: K.r3(it.a > la ? jo.s + ((nx - jo.s) * (it.a - la)) / n : jo.s) };
      if (same && jo.m) u.m = jo.m.slice();
      if (jo.n && it.a === la) u.n = 1;                              // 行内换行跟着那一排的第一个字走
      if (it.r && !same) added++;
      out.push(u); p = it.b;
    });
    if (!added) return { added: 0 };
    l.units = out; K.fixLine(l); return { added };
  };
  /* scope: 'line'（选中的行）| 'all'；整个操作一次 commit = 一步撤销。需要先有 F.tokenizer */
  F.run = (scope, overwrite) => {
    const lines = scope === 'line' ? [K.sel()].filter(Boolean) : K.project.lines.slice(), r = { added: 0, kept: 0, miss: 0, lines: 0, kanji: 0, total: lines.length };
    lines.forEach((l) => {
      const text = K.lineText(l); if (!HAS_KANJI.test(text)) return;
      r.kanji++; if (!overwrite) r.kept += l.units.filter((u) => u.r).length;
      const pl = F.plan(text, F.cuts(l)); if (!pl) { r.miss++; return; }
      r.miss += pl.miss; const a = F.applyToLine(l, pl, overwrite); if (a.added) { r.added += a.added; r.lines++; }
    });
    if (r.added) K.commit('furi');
    return r;
  };

  /* ---------- 对话框与流程 ---------- */
  const askDialog = (scope0) => {
    const st = { scope: scope0, over: false }; let dEl = null;
    const read = () => { if (!dEl || !dEl.querySelector('#fuOver')) return; const c = dEl.querySelector('input[name="fuScope"]:checked'); if (c) st.scope = c.value; st.over = dEl.querySelector('#fuOver').checked; };
    return K.dialog({ cls: 'furi', cancel: false, focus: '.dacts .pri',
      render: () => { read(); const sel = !!K.sel();
        return { title: T('furi.title'), html:
          `<p>${et('furi.lead')}</p>` +
          `<label class="chk"><input type="radio" name="fuScope" value="line"${st.scope === 'line' ? ' checked' : ''}${sel ? '' : ' disabled'}> ${et('furi.scopeLine')}</label>` +
          `<label class="chk"><input type="radio" name="fuScope" value="all"${st.scope === 'all' ? ' checked' : ''}> ${et('furi.scopeAll', { n: K.project.lines.length })}</label>` +
          `<label class="chk"><input type="checkbox" id="fuOver"${st.over ? ' checked' : ''}> ${et('furi.overwrite')}</label>` +
          (F.tokenizer ? `<p class="hint">${et('furi.ready')}</p>` : `<p class="callout">${et('furi.download')}</p>`) +
          `<p class="hint">${et('furi.proof')}</p>`,
          buttons: [{ label: T('dlg.cancel'), value: false }, { label: T('furi.go'), value: 'go', pri: true }] }; },
      onPaint: (d) => { dEl = d; if (!d._fu) { d._fu = 1; d.addEventListener('change', read); } },
    }).then((v) => (v === 'go' ? st : null));
  };
  /* 词典下载中的提示框：返回 Promise('ok' | 'cancel' | Error)；用户关掉提示框时下载仍在后台继续，完成后会提示一声 */
  const loadDialog = () => {
    let close = null, timer = 0, gone = false; const t0 = performance.now();
    const upd = (d) => { const p = d.querySelector('#fuProg'), i = d.querySelector('#fuInfo'), n = F.filesDone(t0); if (p) p.value = n; if (i) i.textContent = T('furi.progress', { n, total: DICT_FILES, s: Math.round((performance.now() - t0) / 1000) }); };
    const dlg = K.dialog({ cls: 'small', cancel: 'x', render: () => ({ title: T('furi.loadingTitle'), html: `<p>${et('furi.loading')}</p><progress id="fuProg" max="${DICT_FILES}" value="0"></progress><p class="hint" id="fuInfo" aria-live="polite"></p>`, buttons: [{ label: T('dlg.cancel'), value: 'x' }] }),
      onPaint: upd, onOpen: (d, c) => { close = c; timer = setInterval(() => upd(d), 500); } });
    return new Promise((res) => {
      F.load().then(() => { clearInterval(timer); if (gone) K.toast(T('furi.readyLater'), 'ok'); else { close('done'); res('ok'); } }, (e) => { clearInterval(timer); if (!gone) { close('fail'); res(e || new Error('load failed')); } });
      dlg.then((v) => { clearInterval(timer); if (v === 'x') { gone = true; res('cancel'); } });
    });
  };
  /* 入口：scope = 'line' | 'all'（没选中行时自动用 all） */
  K.autoFurigana = async (scope) => {
    if (F.busy || K.modalOpen()) return;
    if (!K.project.lines.length) { K.toast(T('furi.noLines')); return; }
    const st = await askDialog(scope === 'line' && K.sel() ? 'line' : 'all'); if (!st) return;
    F.busy = true;
    try {
      if (!F.tokenizer) {
        const r = await loadDialog();
        if (r === 'cancel') return;
        if (r !== 'ok') { K.toast(T('furi.loadFail'), 'error'); return; }
      }
      const r = F.run(st.scope === 'line' && K.sel() ? 'line' : 'all', st.over);
      if (!r.kanji) K.toast(T('furi.noKanji'));
      else if (!r.added) K.toast(T('furi.none'));
      else { K.toast(T(r.kept ? 'furi.doneKept' : 'furi.done', { n: r.added, lines: r.lines, kept: r.kept }), 'ok'); if (r.miss) K.toast(T('furi.miss', { n: r.miss })); }
    } catch (e) { K.toast(T('furi.loadFail'), 'error'); }
    finally { F.busy = false; }
  };
  $('bFuri').onclick = () => K.autoFurigana(K.sel() ? 'line' : 'all');
})();
