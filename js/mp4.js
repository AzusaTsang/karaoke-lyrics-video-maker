/* 视频导出：WebCodecs 的 VideoEncoder（H.264，有硬件编码就用硬件）+ 一个最小的 MP4 封装器（只有一条视频轨、固定帧率、没有 B 帧）。
   数据块一路塞进 Blob 数组：[ftyp][mdat 头][各帧…][moov]，索引（moov）放在最后 */
(function () {
  const K = window.K, te = new TextEncoder();
  const cat = (arr) => { let n = 0; arr.forEach((a) => (n += a.length)); const o = new Uint8Array(n); let p = 0; arr.forEach((a) => { o.set(a, p); p += a.length; }); return o; };
  const u8 = (...v) => new Uint8Array(v), u16 = (v) => u8(v >>> 8, v & 255), u32 = (v) => u8(v >>> 24, (v >>> 16) & 255, (v >>> 8) & 255, v & 255);
  const u64 = (v) => cat([u32(Math.floor(v / 4294967296)), u32(v >>> 0)]), str = (s) => te.encode(s), zero = (n) => new Uint8Array(n);
  const box = (type, ...parts) => { const body = cat(parts.map((p) => (typeof p === 'number' ? u32(p) : p))); return cat([u32(body.length + 8), str(type), body]); };
  const MATRIX = cat([0x10000, 0, 0, 0, 0x10000, 0, 0, 0, 0x40000000].map(u32));
  /* colr(nclx)：把编码器实际用的色彩空间写进文件，播放器 / 剪辑软件才会按同一套矩阵还原颜色（抠像色才对得上） */
  const PRI = { bt709: 1, bt470bg: 5, smpte170m: 6, bt2020: 9, smpte432: 12 }, TRC = { bt709: 1, smpte170m: 6, 'iec61966-2-1': 13, linear: 8 }, MTX = { rgb: 0, bt709: 1, bt470bg: 5, smpte170m: 6, 'bt2020-ncl': 9 };
  const colr = (cs) => (cs && PRI[cs.primaries] && TRC[cs.transfer] && MTX[cs.matrix] != null ? box('colr', str('nclx'), u16(PRI[cs.primaries]), u16(TRC[cs.transfer]), u16(MTX[cs.matrix]), u8(cs.fullRange ? 0x80 : 0)) : zero(0));

  /* o: { W, H, timescale, delta（每帧的时长，单位 1/timescale 秒） }；add(Uint8Array, 是否关键帧)；finish(avcC, colorSpace) → Blob */
  K.Mp4Writer = function (o) {
    const ftyp = box('ftyp', str('isom'), 0x200, str('isomiso2avc1mp41')), parts = [], sizes = [], keys = [];
    let bytes = 0;
    this.count = 0; this.size = 0;
    this.add = (data, key) => { parts.push(data); sizes.push(data.length); if (key) keys.push(sizes.length); bytes += data.length; this.count = sizes.length; this.size = bytes; };
    this.finish = (avcC, cs) => {
      const n = sizes.length, dur = n * o.delta; let off = ftyp.length + 16;
      const offs = sizes.map((s) => { const a = u64(off); off += s; return a; });
      const stbl = box('stbl',
        box('stsd', 0, 1, box('avc1', zero(6), u16(1), zero(16), u16(o.W), u16(o.H), 0x480000, 0x480000, 0, u16(1), zero(32), u16(24), u16(0xFFFF), box('avcC', avcC), colr(cs))),
        box('stts', 0, 1, n, o.delta),
        box('stss', 0, keys.length, ...keys),
        box('stsc', 0, 1, 1, 1, 1),
        box('stsz', 0, 0, n, ...sizes),
        box('co64', 0, n, ...offs));
      const moov = box('moov',
        box('mvhd', 0, 0, 0, o.timescale, dur, 0x10000, u16(0x100), zero(10), MATRIX, zero(24), 2),
        box('trak',
          box('tkhd', 3, 0, 0, 1, 0, dur, zero(8), u16(0), u16(0), u16(0), u16(0), MATRIX, o.W * 65536, o.H * 65536),
          box('mdia',
            box('mdhd', 0, 0, 0, o.timescale, dur, u16(0x55C4), u16(0)),
            box('hdlr', 0, 0, str('vide'), zero(12), str('VideoHandler\0')),
            box('minf', box('vmhd', 1, zero(8)), box('dinf', box('dref', 0, 1, box('url ', 1))), stbl))));
      return new Blob([ftyp, u32(1), str('mdat'), u64(bytes + 16), ...parts, moov], { type: 'video/mp4' });
    };
  };

  /* 找一个这台机器能用的 H.264 编码配置；没有 → null。码率按像素数 × 帧率估（歌词画面大片纯色，这个码率下文字边缘很干净） */
  K.videoConfig = async (W, H, fps) => {
    if (!window.VideoEncoder || !window.VideoFrame) return null;
    const bitrate = Math.round(Math.max(2e6, Math.min(6e7, W * H * fps * 0.12)));
    for (const codec of ['avc1.640034', 'avc1.4D0034', 'avc1.42E034', 'avc1.640033', 'avc1.64002A', 'avc1.42E01F']) {
      const cfg = { codec, width: W, height: H, bitrate, framerate: fps, avc: { format: 'avc' }, latencyMode: 'quality' };
      try { if ((await VideoEncoder.isConfigSupported(cfg)).supported) return cfg; } catch (e) {}
    }
    return null;
  };

  /* 编码一段视频：draw(f) 把第 f 帧画到 canvas 上（画面没变可以什么都不画）。
     o: { canvas, cfg, fps, frames, draw, progress(f), cancelled() } → Promise({ blob, frames })；取消时是 null */
  K.encodeVideo = async (o) => {
    const ts = Math.round(o.fps * 1000), mux = new K.Mp4Writer({ W: o.cfg.width, H: o.cfg.height, timescale: ts, delta: 1000 });
    let avcC = null, cs = null, err = null;
    const enc = new VideoEncoder({
      output: (chunk, meta) => {
        const d = meta && meta.decoderConfig;
        if (d && d.description && !avcC) { avcC = new Uint8Array(d.description instanceof ArrayBuffer ? d.description : d.description.buffer.slice(d.description.byteOffset, d.description.byteOffset + d.description.byteLength)); cs = d.colorSpace; }
        const buf = new Uint8Array(chunk.byteLength); chunk.copyTo(buf); mux.add(buf, chunk.type === 'key');
      },
      error: (e) => { err = err || e; },
    });
    enc.configure(o.cfg);
    const gop = Math.max(1, Math.round(o.fps * 2)); let f = 0;
    try {
      for (; f < o.frames && !err && !o.cancelled(); f++) {
        o.draw(f);
        const vf = new VideoFrame(o.canvas, { timestamp: Math.round((f * 1e6) / o.fps), duration: Math.round(1e6 / o.fps) });
        enc.encode(vf, { keyFrame: f % gop === 0 }); vf.close();
        while (enc.encodeQueueSize > 8 && !err) await new Promise((r) => setTimeout(r, 1));     // 编码器跟不上时等一等，别把未压缩的帧堆在内存里
        if (f % 10 === 0) { o.progress(f); await new Promise((r) => setTimeout(r)); }
      }
      if (o.cancelled()) return null;                           // 取消 = 整个不要了：不收尾、不出文件
      if (!err) await enc.flush();
    } finally { try { enc.close(); } catch (e) {} }
    if (err) throw err;
    if (!avcC || !mux.count) throw new Error('no video data');
    return { blob: mux.finish(avcC, cs), frames: mux.count, bytes: mux.size };
  };
})();
