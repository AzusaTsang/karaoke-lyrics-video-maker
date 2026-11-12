/* PNG 编码线程池：导出序列时，主线程只管画，画好的帧（ImageBitmap，转移而不是复制）交给几个 Worker 并行压成 PNG。
   主线程上的 canvas.toBlob 是在“空闲时间片”里一点点编码的，一帧 1080p 要几十毫秒，而且只用一个核；
   Worker 里的 OffscreenCanvas.convertToBlob 直接在自己的线程上编码，几个核一起跑。
   Worker 的代码放在 Blob URL 里：直接双击 index.html（file://）打开时也能用 */
(function () {
  const K = window.K;
  const SRC = `onmessage = async (e) => {
    const { id, bmp } = e.data;
    try {
      const c = new OffscreenCanvas(bmp.width, bmp.height);
      c.getContext('bitmaprenderer').transferFromImageBitmap(bmp);
      postMessage({ id, blob: await c.convertToBlob({ type: 'image/png' }) });
    } catch (err) { postMessage({ id, err: String(err && err.message || err) }); }
  };`;
  K.POOL_MAX = 8;                                                // 再多也快不了多少，每个在编码的帧还要占一份未压缩的内存
  /* → Promise(池 | null)；null = 这个浏览器用不了（没有 OffscreenCanvas / Worker 起不来），调用方退回 canvas.toBlob。
     池：{ size, encode(ImageBitmap) → Promise<Blob>, close() }。encode 会拿走 bitmap */
  K.pngPool = async (size) => {
    if (!window.Worker || !window.OffscreenCanvas || !window.createImageBitmap) return null;
    const n = Math.max(1, Math.min(K.POOL_MAX, size || (navigator.hardwareConcurrency || 4) - 1));
    const wait = new Map(), ws = []; let url = null, seq = 0, dead = null;
    const fail = (err) => { dead = dead || err; wait.forEach((p) => p[1](dead)); wait.clear(); };
    const pool = {
      size: n,
      encode: (bmp) => new Promise((res, rej) => {
        if (dead) { rej(dead); return; }
        const id = seq++; wait.set(id, [res, rej]); ws[id % n].postMessage({ id, bmp }, [bmp]);
      }),
      close: () => { ws.forEach((w) => w.terminate()); if (url) URL.revokeObjectURL(url); fail(new Error('closed')); },
    };
    try {
      url = URL.createObjectURL(new Blob([SRC], { type: 'text/javascript' }));
      for (let i = 0; i < n; i++) {
        const w = new Worker(url); ws.push(w);
        w.onmessage = (e) => { const p = wait.get(e.data.id); if (!p) return; wait.delete(e.data.id); if (e.data.blob) p[0](e.data.blob); else p[1](new Error(e.data.err)); };
        w.onerror = (e) => fail(new Error((e && e.message) || 'worker error'));
      }
      /* 每个 Worker 先试编一张 2×2 的图：起不来（如被 CSP 拦住）或编不出 PNG 就整个放弃 */
      const probe = document.createElement('canvas'); probe.width = probe.height = 2; probe.getContext('2d').fillRect(0, 0, 1, 1);
      const blobs = await Promise.all(ws.map(async () => pool.encode(await createImageBitmap(probe))));
      if (!blobs.every((b) => b && b.size > 8 && b.type === 'image/png')) throw new Error('bad png');
      return pool;
    } catch (e) { pool.close(); return null; }
  };
})();
