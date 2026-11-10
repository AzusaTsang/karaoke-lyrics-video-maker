/* ZIP 写入器（只存储、不压缩，PNG 本来就压缩过）+ CRC32 + 分卷输出 + 导出前的体积估算。
   没有 File System Access API 的浏览器（以及选择“下载为 ZIP”时）用它导出 PNG 序列。
   数据块一路塞进 Blob 数组，不会拼成一个巨大的 ArrayBuffer；不支持 ZIP64（单卷 < 4 GiB、< 65535 个文件，超过就由 zipSink 提前换卷） */
(function () {
  const K = window.K, enc = new TextEncoder();
  const TABLE = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  /* 可以分段计算：crc32(b, crc32(a)) === crc32(a + b)；参数可以是 Uint8Array 或字符串 */
  K.crc32 = (data, crc) => {
    const u8 = typeof data === 'string' ? enc.encode(data) : data; let c = ((crc || 0) ^ 0xFFFFFFFF) >>> 0;
    for (let i = 0; i < u8.length; i++) c = TABLE[(c ^ u8[i]) & 255] ^ (c >>> 8);
    return (c ^ 0xFFFFFFFF) >>> 0;
  };

  const MAX_SIZE = 0xFFFFFFFF, MAX_ENTRIES = 0xFFFF;
  const crcCache = new WeakMap();                              // Blob → CRC：反复使用的空白帧只算一次
  K.ZipWriter = function () {
    const parts = [], ents = [], now = new Date();
    const dosT = (now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1), dosD = ((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();
    let off = 0;
    const w = this;
    w.count = 0; w.size = 0;
    /* data：Blob / Uint8Array / 字符串 */
    w.add = async (name, data) => {
      const nb = enc.encode(name); if (typeof data === 'string') data = enc.encode(data);
      const size = data instanceof Blob ? data.size : data.length;
      if (nb.length > 0xFFFF || ents.length >= MAX_ENTRIES || off + size + 30 + nb.length > MAX_SIZE - 2e6) throw new Error('ZIP limit reached (no ZIP64)');
      let crc = data instanceof Blob ? crcCache.get(data) : undefined;
      if (crc === undefined) { crc = K.crc32(data instanceof Blob ? new Uint8Array(await data.arrayBuffer()) : data); if (data instanceof Blob) crcCache.set(data, crc); }
      const h = new DataView(new ArrayBuffer(30)); h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(6, 0x0800, true); h.setUint16(8, 0, true);
      h.setUint16(10, dosT, true); h.setUint16(12, dosD, true); h.setUint32(14, crc, true); h.setUint32(18, size, true); h.setUint32(22, size, true); h.setUint16(26, nb.length, true); h.setUint16(28, 0, true);
      parts.push(h.buffer, nb, data);
      ents.push({ nb, crc, size, off }); off += 30 + nb.length + size; w.count = ents.length; w.size = off;
    };
    w.finish = () => {
      let cd = 0;
      ents.forEach((e) => {
        const h = new DataView(new ArrayBuffer(46)); h.setUint32(0, 0x02014b50, true); h.setUint16(4, 20, true); h.setUint16(6, 20, true); h.setUint16(8, 0x0800, true); h.setUint16(10, 0, true);
        h.setUint16(12, dosT, true); h.setUint16(14, dosD, true); h.setUint32(16, e.crc, true); h.setUint32(20, e.size, true); h.setUint32(24, e.size, true); h.setUint16(28, e.nb.length, true);
        h.setUint32(42, e.off, true); parts.push(h.buffer, e.nb); cd += 46 + e.nb.length;
      });
      const t = new DataView(new ArrayBuffer(22)); t.setUint32(0, 0x06054b50, true); t.setUint16(8, ents.length, true); t.setUint16(10, ents.length, true); t.setUint32(12, cd, true); t.setUint32(16, off, true);
      parts.push(t.buffer);
      return new Blob(parts, { type: 'application/zip' });
    };
  };

  /* 分卷输出：每 per 帧（或接近 4 GiB 之前）出一个 ZIP，立即交给 save(blob, 文件名) 并释放。
     o: { total, per, base, save, suffix } —— 总帧数 > per 时文件名带 _partNN，帧编号跨卷连续，全部解压到同一个文件夹即是完整序列 */
  K.zipSink = (o) => {
    let w = new K.ZipWriter(), part = 0, files = 0;
    const suffix = o.suffix != null ? o.suffix : o.total > o.per;
    const flush = async () => {
      if (!w.count) return;
      part++; files++; const name = suffix || part > 1 ? `${o.base}_part${String(part).padStart(2, '0')}.zip` : `${o.base}.zip`;
      const blob = w.finish(); w = new K.ZipWriter(); o.save(blob, name);
      await new Promise((r) => setTimeout(r, 300));              // 给浏览器一点时间开始这次下载
    };
    return { put: async (name, blob) => { await w.add(name, blob); if (w.count >= o.per || w.size > 3.5e9) await flush(); }, end: flush, files: () => files };
  };

  /* ---------- 导出前估算 ---------- */
  K.ZIP_PER = 2000;                                              // 每个 ZIP 最多多少帧
  K.ZIP_WARN = 1.5e9;                                            // 估计总体积超过它就先问一声（ZIP 要先在内存 / 浏览器的临时存储里攒出来）
  /* 范围内有歌词的帧数：每行显示区间 [show, hide + fadeOut] 求并集 */
  K.countLyricFrames = (t0, n, fps) => {
    const S = K.S(), sc = K.screen(), iv = sc.ord.map((l) => { const I = sc.info.get(l.id); return [I.show + S.offset, I.hide + S.fadeOut + S.offset]; }).sort((a, b) => a[0] - b[0]);
    let cnt = 0, cur = -Infinity;
    iv.forEach(([a, b]) => { a = Math.max(a, cur, t0); b = Math.min(b, t0 + n / fps); if (b > a) { cnt += Math.ceil((b - a) * fps) + 1; } cur = Math.max(cur, b); });
    return Math.min(n, cnt);
  };
  /* 画一帧有歌词的样张量出 PNG 大小：{ bytes: 估计总体积, sample: 样张大小, frames: 总帧数, lyric: 有歌词的帧数 }；空白帧是同一个 Blob，只算一份 */
  K.estimateSequence = async (g, bg, t0, n, fps) => {
    const toBlob = () => new Promise((r) => g.canvas.toBlob(r, 'image/png')), lyric = K.countLyricFrames(t0, n, fps);
    const sc = K.screen(), S = K.S(); let tm = t0, best = -1;
    sc.ord.forEach((l) => { const a = K.ls(l) + S.offset, b = l.end + S.offset; if (b > t0 && a < t0 + n / fps) { const c = Math.max(t0, Math.min((a + b) / 2, t0 + n / fps - 1 / fps)), len = l.units.length; if (len > best) { best = len; tm = c; } } });
    const drew = K.render(g, tm, { bg }), sample = (await toBlob()).size;
    return { sample, lyric, frames: n, drew, bytes: (drew ? lyric : 0) * sample + sample };
  };
  K.fmtBytes = (b) => (b >= 1e9 ? (b / 1e9).toFixed(1) + ' GB' : Math.max(1, Math.round(b / 1e6)) + ' MB');
  /* 估计体积太大时的确认框（应用内对话框）→ Promise(true = 继续) */
  K.zipConfirm = (est, parts) => K.dialog({ cls: 'small', cancel: false, render: () => ({ title: K.t('zip.bigTitle'),
    html: `<p>${K.esc(K.t('zip.bigBody', { size: K.fmtBytes(est.bytes), n: est.frames, parts }))}</p><p class="hint">${K.esc(K.t('zip.bigTip'))}</p>`,
    buttons: [{ label: K.t('dlg.cancel'), value: false }, { label: K.t('zip.bigGo'), value: true, pri: true, danger: true }] }) });
})();
