#!/usr/bin/env node
/* ============================================================================
   ParkKing hero film — frame capture + encode pipeline.
   Run from the repo root (/home/user/EthanZhang):
     node landing/tools/video/render.mjs full    # 384 frames + mp4 + poster + previews
     node landing/tools/video/render.mjs spot     # QA stills only
     node landing/tools/video/render.mjs verify    # re-verify an existing mp4
   (Paths are derived from import.meta.url, so the working directory does not matter.)

   FILM: 1920x1080, 24 fps, 384 frames = 16.0 s. Dark navy grade throughout,
   one continuous camera: phone -> laptop -> car dashboard -> out the rear window
   -> parking bay. NO white flash, no bright transitions (enforced below).

   NOTE ON THE ENCODER: the only ffmpeg in this environment is the Playwright
   minimal build (vp8/webm + png only — no libx264, no mp4 muxer, no jpeg
   encoder, no image2 demuxer). The prescribed libx264 command is impossible
   with it; this pipeline therefore encodes VP9 with Chromium's own WebCodecs
   (deterministic input frames, keyframe every 4 frames ≈ `-g 4 -bf 0`) and
   muxes a standards-compliant ISO-BMFF .mp4 in Node with moov-before-mdat
   (`+faststart` layout). VP9 profile 0 / LEVEL 4.1 (covers 1920x1080@24) —
   the WebCodecs codec string 'vp09.00.41.08' and the muxer's vpcC level byte
   (41) must match. The attempted ffmpeg commands and their errors are recorded
   in the run summary.

   WHITE-FLASH GUARD: pass 1 measures per-frame mean luminance (canvas
   downsampled to 64x36). The render HARD-FAILS (throws, nonzero exit, no files
   overwritten) if any frame mean luminance > 115 or any adjacent-frame jump
   exceeds 45. The full luminance curve is written into the render report.
   ========================================================================= */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

// playwright-core resolution — the project node_modules is being churned by a
// concurrent installer, so fall back to stable copies when the local one is out.
const PW_CANDIDATES = [
  '/home/user/EthanZhang/node_modules/playwright-core/index.mjs',
  '/opt/node22/lib/node_modules/playwright/node_modules/playwright-core/index.mjs',
  '/home/user/EthanZhang/landing/node_modules/playwright-core/index.mjs',
];
let chromium = null;
for (const p of PW_CANDIDATES) {
  if (fs.existsSync(p)) {
    ({ chromium } = await import('file://' + p));
    break;
  }
}
if (!chromium) throw new Error('playwright-core not found in any known location');

const ROOT      = new URL('../..', import.meta.url).pathname; // landing/ (this file lives in landing/tools/video)
const SCENE     = path.join(ROOT, 'tools/video/scene.html');
const SCRATCH   = '/tmp/claude-0/-home-user-EthanZhang/321bf849-684f-5355-937a-9455711bbb59/scratchpad';
const FILMOUT   = path.join(SCRATCH, 'b12/film');   // spot stills + render report land here
const FRAMES    = path.join(SCRATCH, 'film-frames');
const PREVIEWS  = path.join(SCRATCH, 'film-previews');
const MP4_OUT   = process.env.PK_OUT || path.join(ROOT, 'public/media/parkking-hero.mp4');
// One delivery file. This pipeline emits VP9-in-MP4 (codecs="vp09.00.41.08"), the exact
// stream FilmStage.tsx probes for, and MP4_OUT is the single <source> the player lists.
// We used to also write a byte-identical parkking-hero-vp9.mp4 for a second <source>;
// that source was unreachable (a generic video/mp4 source is never skipped for a later
// one) so it only ever shipped a duplicate 12.9 MB file. Both are gone.
const POSTER    = path.join(ROOT, 'public/media/poster.jpg');
const FFMPEG    = '/opt/pw-browsers/ffmpeg-1011/ffmpeg-linux';
const CHROME    = '/opt/pw-browsers/chromium';

const FPS = 24, N_FRAMES = 384, WIDTH = 1920, HEIGHT = 1080;
const KEY_INT = 4;                      // ≈ -g 4
const BITRATE_A = 9_500_000;            // primary target for 1080p24 vp9
const BITRATE_B = 6_500_000;            // fallback if over the size cap
const SIZE_CAP = 14 * 1024 * 1024;

const CODEC = 'vp09.00.41.08';          // VP9 profile 0, level 4.1, 8-bit
const VP9_LEVEL = 41;                    // vpcC level byte — MUST match the codec string above

// Beat boundaries (fractions of 16 s): B1 0.00, B2 0.16, B3 0.36, B4 0.54, B5 0.76, end 1.00
//  -> seconds: 0.00, 2.56, 5.76, 8.64, 12.16, 16.00
const PREVIEW_TIMES = [1.5, 4.16, 6.8, 7.6, 9.4, 10.1, 11.2, 13.0, 15.6];
// ~16 spot stills: beat boundaries + midpoints + the key morph / seat-cross / rear-glass / reveal moments
const SPOT_TIMES = [0.4, 1.5, 2.56, 4.16, 5.0, 5.76, 6.8, 7.6, 8.64, 9.4, 10.1, 11.2, 12.16, 13.0, 14.2, 15.6];

const POSTER_T = 1.5;                    // crisp Beat-1 frame
const POSTER_FRAME = Math.round(POSTER_T * FPS);   // frame 36

const mode = process.argv[2] || 'full';
const fname = i => `f${String(i).padStart(4, '0')}.jpg`;

fs.mkdirSync(FRAMES, { recursive: true });
fs.mkdirSync(PREVIEWS, { recursive: true });
fs.mkdirSync(FILMOUT, { recursive: true });
fs.mkdirSync(path.dirname(MP4_OUT), { recursive: true });

/* ---------------------------------------------------------------- browser */
async function openPage(browser) {
  const page = await browser.newPage({
    viewport: { width: WIDTH, height: HEIGHT },
    deviceScaleFactor: 1,
  });
  page.on('pageerror', e => { throw new Error('pageerror: ' + e.message); });
  await page.goto('file://' + SCENE);
  await page.waitForFunction(() => window.PK && typeof window.PK.seek === 'function');
  // in-page luminance probe: downsample #c to 64x36 and mean the RGB channels
  await page.evaluate(() => {
    const t = document.createElement('canvas'); t.width = 64; t.height = 36;
    const tx = t.getContext('2d', { willReadFrequently: true });
    window.__lum = () => {
      tx.drawImage(document.getElementById('c'), 0, 0, 64, 36);
      const d = tx.getImageData(0, 0, 64, 36).data;
      let s = 0;
      for (let i = 0; i < d.length; i += 4) s += (d[i] + d[i + 1] + d[i + 2]) / 3;
      return s / (d.length / 4);
    };
  });
  return page;
}

async function paintFrame(page, t) {
  await page.evaluate(tt => { window.PK.seek(tt); }, t);
  await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
}

/* -------------------------------------------------------------- mp4 muxer */
const u32 = v => { const b = Buffer.alloc(4); b.writeUInt32BE(v >>> 0); return b; };
const u16 = v => { const b = Buffer.alloc(2); b.writeUInt16BE(v & 0xffff); return b; };
const u8  = v => Buffer.from([v & 0xff]);
const str = s => Buffer.from(s, 'ascii');
const box = (type, ...parts) => {
  const body = Buffer.concat(parts.flat());
  return Buffer.concat([u32(8 + body.length), str(type), body]);
};
const full = (type, ver, flags, ...parts) =>
  box(type, u8(ver), u8((flags >> 16) & 255), u8((flags >> 8) & 255), u8(flags & 255), ...parts);
const MATRIX = Buffer.concat([
  u32(0x10000), u32(0), u32(0),
  u32(0), u32(0x10000), u32(0),
  u32(0), u32(0), u32(0x40000000),
]);

function buildMoov(sizes, keySamples, stcoOffset) {
  const n = sizes.length;
  const movieDur = Math.round(n / FPS * 1000);      // movie timescale 1000
  const mediaDur = n * 1000;                        // media timescale 24000 → exact 24 fps

  const vpcC = full('vpcC', 1, 0,
    u8(0), u8(VP9_LEVEL),                            // profile 0, level 4.1
    u8((8 << 4) | (1 << 1) | 0),                    // 8-bit, 4:2:0 colocated, video range
    u8(1), u8(1), u8(1),                            // BT.709 primaries/transfer/matrix
    u16(0));
  const vp09 = box('vp09',
    Buffer.alloc(6), u16(1),
    u16(0), u16(0), Buffer.alloc(12),
    u16(WIDTH), u16(HEIGHT),
    u32(0x00480000), u32(0x00480000),
    u32(0), u16(1),
    Buffer.alloc(32),
    u16(24), u16(0xFFFF),
    vpcC);

  const stbl = box('stbl',
    full('stsd', 0, 0, u32(1), vp09),
    full('stts', 0, 0, u32(1), u32(n), u32(1000)),
    full('stss', 0, 0, u32(keySamples.length), keySamples.map(u32)),
    full('stsc', 0, 0, u32(1), u32(1), u32(n), u32(1)),
    full('stsz', 0, 0, u32(0), u32(n), sizes.map(u32)),
    full('stco', 0, 0, u32(1), u32(stcoOffset)));

  const minf = box('minf',
    full('vmhd', 0, 1, u16(0), u16(0), u16(0), u16(0)),
    box('dinf', full('dref', 0, 0, u32(1), full('url ', 0, 1))),
    stbl);

  const mdia = box('mdia',
    full('mdhd', 0, 0, u32(0), u32(0), u32(24000), u32(mediaDur), u16(0x55C4), u16(0)),
    full('hdlr', 0, 0, u32(0), str('vide'), u32(0), u32(0), u32(0), Buffer.from('ParkKing Video\0', 'ascii')),
    minf);

  const trak = box('trak',
    full('tkhd', 0, 3, u32(0), u32(0), u32(1), u32(0), u32(movieDur),
      u32(0), u32(0), u16(0), u16(0), u16(0), u16(0), MATRIX,
      u32(WIDTH << 16), u32(HEIGHT << 16)),
    mdia);

  return box('moov',
    full('mvhd', 0, 0, u32(0), u32(0), u32(1000), u32(movieDur), u32(0x10000),
      u16(0x0100), u16(0), u32(0), u32(0), MATRIX, Buffer.alloc(24), u32(2)),
    trak);
}

function muxMp4(chunks) {
  const ftyp = box('ftyp', str('isom'), u32(0x200), str('isom'), str('iso2'), str('mp41'));
  const sizes = chunks.map(c => c.data.length);
  const keySamples = chunks.map((c, i) => (c.key ? i + 1 : 0)).filter(Boolean);
  const payload = Buffer.concat(chunks.map(c => c.data));
  const moovLen = buildMoov(sizes, keySamples, 0).length;   // length is offset-independent
  const stcoOffset = ftyp.length + moovLen + 8;             // moov-first = faststart layout
  const moov = buildMoov(sizes, keySamples, stcoOffset);
  return Buffer.concat([ftyp, moov, box('mdat', payload)]);
}

/* ----------------------------------------------------------------- encode */
async function encodeVP9(page, bitrate) {
  const meta = await page.evaluate(async ({ n, fps, kint, bitrate, codec, w, h }) => {
    const canvas = document.getElementById('c');
    const chunks = [];
    let encErr = null;
    const encoder = new VideoEncoder({
      output: chunk => {
        const b = new Uint8Array(chunk.byteLength);
        chunk.copyTo(b);
        chunks.push({ k: chunk.type === 'key', b });
      },
      error: e => { encErr = String(e && e.message || e); },
    });
    encoder.configure({
      codec, width: w, height: h,
      bitrate, framerate: fps, bitrateMode: 'variable', latencyMode: 'quality',
    });
    for (let i = 0; i < n; i++) {
      window.PK.seek(i / fps);
      await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
      const vf = new VideoFrame(canvas, {
        timestamp: Math.round(i * 1e6 / fps),
        duration: Math.round(1e6 / fps),
      });
      encoder.encode(vf, { keyFrame: i % kint === 0 });
      vf.close();
      while (encoder.encodeQueueSize > 4) await new Promise(r => setTimeout(r, 4));
      if (encErr) throw new Error(encErr);
    }
    await encoder.flush();
    encoder.close();
    if (encErr) throw new Error(encErr);
    window.__CHUNKS = chunks;
    return { count: chunks.length, bytes: chunks.reduce((s, c) => s + c.b.length, 0) };
  }, { n: N_FRAMES, fps: FPS, kint: KEY_INT, bitrate, codec: CODEC, w: WIDTH, h: HEIGHT });

  // pull chunk data over in batches (base64)
  const chunks = [];
  const BATCH = 24;
  for (let i = 0; i < meta.count; i += BATCH) {
    const batch = await page.evaluate(({ from, to }) => {
      const b64 = arr => {
        let s = '';
        const CH = 0x8000;
        for (let i = 0; i < arr.length; i += CH) s += String.fromCharCode.apply(null, arr.subarray(i, i + CH));
        return btoa(s);
      };
      return window.__CHUNKS.slice(from, to).map(c => ({ k: c.k, d: b64(c.b) }));
    }, { from: i, to: Math.min(i + BATCH, meta.count) });
    for (const c of batch) chunks.push({ key: c.k, data: Buffer.from(c.d, 'base64') });
  }
  await page.evaluate(() => { window.__CHUNKS = null; });
  return { chunks, rawBytes: meta.bytes };
}

/* ---------------------------------------------------- verification helpers */
async function verifyInBrowser(browser, mp4Path) {
  const page = await browser.newPage({ viewport: { width: 320, height: 180 } });
  try {
    // must be a file:// document, else Chromium refuses file:// video sources
    const stub = path.join(SCRATCH, 'verify-stub.html');
    fs.writeFileSync(stub, '<!doctype html><title>v</title>');
    await page.goto('file://' + stub);
    const res = await page.evaluate(async src => {
      const v = document.createElement('video');
      v.muted = true; v.src = src;
      await new Promise((res, rej) => {
        v.onloadedmetadata = res;
        v.onerror = () => rej(new Error('video element failed to load metadata'));
        setTimeout(() => rej(new Error('metadata timeout')), 15000);
      });
      const seekTo = tt => new Promise((res, rej) => {
        v.onseeked = res; v.onerror = () => rej(new Error('seek error'));
        v.currentTime = tt;
        setTimeout(() => rej(new Error('seek timeout')), 15000);
      });
      const probe = [];
      const cnv = document.createElement('canvas');
      cnv.width = 32; cnv.height = 18;
      const cx = cnv.getContext('2d', { willReadFrequently: true });
      // 5 spread seeks — one per beat
      for (const tt of [0.5, 4.16, 8.0, 11.2, 15.5]) {
        await seekTo(tt);
        cx.drawImage(v, 0, 0, 32, 18);
        const d = cx.getImageData(0, 0, 32, 18).data;
        let lum = 0;
        for (let i = 0; i < d.length; i += 4) lum += d[i] + d[i + 1] + d[i + 2];
        probe.push({ t: tt, meanLum: +(lum / (d.length / 4) / 3).toFixed(1) });
      }
      return { duration: v.duration, w: v.videoWidth, h: v.videoHeight, probe };
    }, 'file://' + mp4Path);
    return res;
  } finally {
    await page.close();
  }
}

function parseMvhdDuration(file) {
  const buf = fs.readFileSync(file);
  const idx = buf.indexOf('mvhd');
  if (idx < 0) return null;
  const timescale = buf.readUInt32BE(idx + 16);
  const duration = buf.readUInt32BE(idx + 20);
  return duration / timescale;
}

function tryFfmpeg(args, label) {
  try {
    const out = execFileSync(FFMPEG, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 60000 });
    return { label, ok: true, out: out.slice(0, 400) };
  } catch (e) {
    const err = String((e.stderr || e.stdout || e.message || '')).split('\n')
      .filter(l => l.trim() && !/^\s*(built with|configuration|lib\w+\s)/.test(l))
      .slice(-4).join(' | ');
    return { label, ok: false, err: err.slice(0, 500) };
  }
}

/* --------------------------------------------------- white-flash guard */
function analyzeLuminance(curve) {
  let maxLum = -1, minLum = 1e9, maxJump = 0, maxAt = -1, jumpAt = -1;
  for (let i = 0; i < curve.length; i++) {
    if (curve[i] > maxLum) { maxLum = curve[i]; maxAt = i; }
    if (curve[i] < minLum) minLum = curve[i];
    if (i > 0) {
      const dj = Math.abs(curve[i] - curve[i - 1]);
      if (dj > maxJump) { maxJump = dj; jumpAt = i; }
    }
  }
  return {
    min: +minLum.toFixed(2), max: +maxLum.toFixed(2), maxAt,
    maxAdjJump: +maxJump.toFixed(2), jumpAt,
    threshold: { meanLum: 115, adjJump: 45 },
    pass: maxLum <= 115 && maxJump <= 45,
    curve: curve.map(v => +v.toFixed(2)),
  };
}

/* -------------------------------------------------------------------- main */
const t0 = Date.now();
const browser = await chromium.launch({
  executablePath: CHROME,
  headless: true,
  args: ['--allow-file-access-from-files'],   // lets the verify step read decoded video pixels
});
try {
  const page = await openPage(browser);

  if (mode === 'verify') {
    const check = await verifyInBrowser(browser, MP4_OUT);
    const mvhdDur = parseMvhdDuration(MP4_OUT);
    const ffAttempts = [
      tryFfmpeg(['-i', MP4_OUT], 'ffmpeg -i duration probe'),
    ];
    const summary = {
      mp4: MP4_OUT,
      bytes: fs.statSync(MP4_OUT).size,
      duration_mvhd_s: mvhdDur,
      browser_check: check,
      poster: POSTER,
      ffmpeg_attempts: ffAttempts,
    };
    fs.writeFileSync(path.join(FILMOUT, 'render-report.json'), JSON.stringify(summary, null, 2));
    console.log('SUMMARY ' + JSON.stringify(summary, null, 2));
    process.exit(0);
  }

  if (mode === 'spot') {
    for (const t of SPOT_TIMES) {
      await paintFrame(page, t);
      const lum = await page.evaluate(() => window.__lum());
      const buf = await page.screenshot({ type: 'jpeg', quality: 92 });
      const f = path.join(FILMOUT, `spot_${t.toFixed(2).replace('.', '_')}.jpg`);
      fs.writeFileSync(f, buf);
      console.log('spot', t.toFixed(2), 'lum', lum.toFixed(1), '->', f);
    }
    console.log('spot done in', ((Date.now() - t0) / 1000).toFixed(1) + 's');
    process.exit(0);
  }

  /* pass 1 — capture all frames as jpeg (previews / poster / QA) + luminance guard */
  const lumCurve = [];
  for (let i = 0; i < N_FRAMES; i++) {
    await paintFrame(page, i / FPS);
    lumCurve.push(await page.evaluate(() => window.__lum()));
    const buf = await page.screenshot({ type: 'jpeg', quality: 92 });
    fs.writeFileSync(path.join(FRAMES, fname(i)), buf);
    if (i % 48 === 0) console.log(`frames: ${i}/${N_FRAMES} (lum ${lumCurve[i].toFixed(1)}, ${((Date.now() - t0) / 1000).toFixed(1)}s)`);
  }
  console.log(`frames: ${N_FRAMES}/${N_FRAMES} captured`);

  const lum = analyzeLuminance(lumCurve);
  console.log(`luminance: min ${lum.min}, max ${lum.max} @f${lum.maxAt}, maxAdjJump ${lum.maxAdjJump} @f${lum.jumpAt}, pass=${lum.pass}`);
  if (!lum.pass) {
    fs.writeFileSync(path.join(FILMOUT, 'render-report.json'),
      JSON.stringify({ FAILED: 'white-flash guard', luminance: lum, elapsed_s: +((Date.now() - t0) / 1000).toFixed(1) }, null, 2));
    throw new Error(`WHITE-FLASH GUARD FAILED — maxLum ${lum.max} @f${lum.maxAt} (>115?), maxAdjJump ${lum.maxAdjJump} @f${lum.jumpAt} (>45?). Nothing overwritten.`);
  }

  /* pass 2 — deterministic re-seek + VP9 encode via WebCodecs */
  let bitrateUsed = BITRATE_A;
  console.log('encoding vp9 @', bitrateUsed, 'bps,', CODEC, 'keyframe interval', KEY_INT);
  let { chunks } = await encodeVP9(page, bitrateUsed);
  let mp4 = muxMp4(chunks);
  if (mp4.length > SIZE_CAP) {
    bitrateUsed = BITRATE_B;
    console.log(`mp4 ${mp4.length} B > 14 MB cap — re-encoding once @ ${bitrateUsed} bps`);
    ({ chunks } = await encodeVP9(page, bitrateUsed));
    mp4 = muxMp4(chunks);
  }
  fs.writeFileSync(MP4_OUT, mp4);
  console.log('wrote', MP4_OUT, mp4.length, 'bytes,', chunks.length, 'samples,',
    chunks.filter(c => c.key).length, 'keyframes');

  /* poster — crisp Beat-1 frame at t≈1.5 s, full-quality source jpeg */
  fs.copyFileSync(path.join(FRAMES, fname(POSTER_FRAME)), POSTER);

  /* previews p1..pN */
  const previewPaths = [];
  PREVIEW_TIMES.forEach((t, k) => {
    const idx = Math.min(N_FRAMES - 1, Math.round(t * FPS));
    const dst = path.join(PREVIEWS, `p${k + 1}.jpg`);
    fs.copyFileSync(path.join(FRAMES, fname(idx)), dst);
    previewPaths.push(dst);
  });

  /* also drop the ~16 spot stills (beat boundaries + midpoints) into the report dir */
  const spotPaths = [];
  SPOT_TIMES.forEach(t => {
    const idx = Math.min(N_FRAMES - 1, Math.round(t * FPS));
    const dst = path.join(FILMOUT, `spot_${t.toFixed(2).replace('.', '_')}.jpg`);
    fs.copyFileSync(path.join(FRAMES, fname(idx)), dst);
    spotPaths.push(dst);
  });

  /* verification */
  const check = await verifyInBrowser(browser, MP4_OUT);
  const mvhdDur = parseMvhdDuration(MP4_OUT);

  /* document the prescribed-but-impossible ffmpeg commands honestly */
  const ffAttempts = [
    tryFfmpeg(['-y', '-framerate', '24', '-i', path.join(FRAMES, 'f%04d.jpg'),
      '-c:v', 'libx264', '-preset', 'slow', '-crf', '20', '-g', '4', '-bf', '0',
      '-pix_fmt', 'yuv420p', '-movflags', '+faststart', path.join(SCRATCH, 'ffmpeg-attempt.mp4')],
      'prescribed libx264 encode'),
    tryFfmpeg(['-i', MP4_OUT], 'ffmpeg -i duration probe'),
  ];

  const summary = {
    mp4: MP4_OUT,
    bytes: mp4.length,
    size_mb: +(mp4.length / 1024 / 1024).toFixed(2),
    bitrate: bitrateUsed,
    codec: CODEC,
    fps: FPS,
    frames: N_FRAMES,
    keyframes: chunks.filter(c => c.key).length,
    key_interval: KEY_INT,
    duration_mvhd_s: mvhdDur,
    luminance: lum,
    browser_check: check,
    poster: POSTER,
    poster_frame: POSTER_FRAME,
    previews: previewPaths,
    spot_stills: spotPaths,
    ffmpeg_attempts: ffAttempts,
    elapsed_s: +((Date.now() - t0) / 1000).toFixed(1),
  };
  fs.writeFileSync(path.join(FILMOUT, 'render-report.json'), JSON.stringify(summary, null, 2));
  console.log('SUMMARY ' + JSON.stringify({ ...summary, luminance: { ...lum, curve: `[${lum.curve.length} values]` } }));
} finally {
  await browser.close();
}
