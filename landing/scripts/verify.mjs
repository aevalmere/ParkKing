/**
 * Verify sweep for the ParkKing landing page.
 *
 * Serves the built site, then drives headless Chromium through the film act on
 * desktop + mobile and asserts:
 *   1. the film decodes and SCRUBS with scroll (currentTime tracks depth, eased);
 *   2. the console + page stay error-free at every depth;
 *   3. the static fallback (canPlayType stubbed to '') renders the five beats
 *      with no <video> and no errors — the same branch iOS Safari / reduced
 *      motion take.
 *
 * The film is VP9-in-MP4, shipped as one file behind a single generic
 * `video/mp4` <source>; this Chromium build decodes VP9, so it plays. The
 * <video> is preload="metadata", so the sweep must let the first seeks pull
 * their byte ranges before asserting on currentTime — the existing
 * waitForTimeout after each scroll step covers that. Shots land in
 * $VERIFY_SHOTS_DIR or .verify-shots/.
 *
 * Usage: node scripts/verify.mjs   (after `vite build`; `npm run verify` does both)
 */
import { createServer } from 'node:http'
import { mkdir, stat } from 'node:fs/promises'
import { existsSync, createReadStream } from 'node:fs'
import { extname, join, resolve } from 'node:path'
import { chromium } from 'playwright-core'

const ROOT = resolve(import.meta.dirname, '..')
const DIST = resolve(ROOT, '..') // the repo root: where `vite build` writes index.html + media/
const OUT = process.env.VERIFY_SHOTS_DIR || join(ROOT, '.verify-shots')
const PORT = 4179

const MIME = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.mp4': 'video/mp4',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.md': 'text/markdown',
}

const DEPTHS = [0, 0.12, 0.25, 0.4, 0.55, 0.7, 0.85, 1]

async function main() {
  if (!existsSync(join(DIST, 'index.html'))) {
    console.error('../index.html missing — run `vite build` first')
    process.exit(1)
  }
  await mkdir(OUT, { recursive: true })

  // Range-aware static server — Chromium's media stack rejects video
  // candidates served by range-oblivious servers, so 206 support is required.
  const server = createServer(async (req, res) => {
    try {
      const url = (req.url || '/').split('?')[0]
      const path = join(DIST, url === '/' ? 'index.html' : decodeURIComponent(url))
      const { size } = await stat(path)
      const type = MIME[extname(path)] || 'application/octet-stream'
      const range = /bytes=(\d*)-(\d*)/.exec(req.headers.range || '')
      if (range) {
        const start = range[1] ? parseInt(range[1], 10) : 0
        const end = Math.min(range[2] ? parseInt(range[2], 10) : size - 1, size - 1)
        res.writeHead(206, {
          'content-type': type,
          'accept-ranges': 'bytes',
          'content-range': `bytes ${start}-${end}/${size}`,
          'content-length': end - start + 1,
        })
        createReadStream(path, { start, end }).pipe(res)
      } else {
        res.writeHead(200, { 'content-type': type, 'accept-ranges': 'bytes', 'content-length': size })
        createReadStream(path).pipe(res)
      }
    } catch {
      res.writeHead(404)
      res.end('not found')
    }
  })
  await new Promise((r) => server.listen(PORT, r))

  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
  const report = { errors: [], video: {}, scrub: {}, static: {}, shots: [] }

  const VIEWPORTS = [
    ['desktop', { width: 1440, height: 900, deviceScaleFactor: 1 }],
    ['mobile', { width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true }],
  ]

  // ---- cinematic sweep: film decodes + scrubs with scroll ----
  for (const [name, vp] of VIEWPORTS) {
    const ctx = await browser.newContext({
      viewport: vp,
      deviceScaleFactor: vp.deviceScaleFactor,
      isMobile: vp.isMobile,
      hasTouch: vp.hasTouch,
    })
    const page = await ctx.newPage()
    page.on('console', (m) => {
      if (m.type() === 'error') report.errors.push(`[${name}] ${m.text()}`)
    })
    page.on('pageerror', (e) => report.errors.push(`[${name}] pageerror: ${e.message}`))

    await page.goto(`http://127.0.0.1:${PORT}/`, { waitUntil: 'load' })
    await page
      .waitForFunction(() => {
        const v = document.querySelector('video')
        return v && v.readyState >= 2
      }, { timeout: 15000 })
      .catch(() => report.errors.push(`[${name}] film never reached readyState 2`))

    const samples = []
    for (const d of DEPTHS) {
      await page.evaluate((d) => {
        const wrap = document.getElementById('top')
        const range = wrap.offsetHeight - window.innerHeight
        window.scrollTo(0, Math.round(range * d))
      }, d)
      await page.waitForTimeout(900) // let the eased scrub + VP9 seek settle
      const state = await page.evaluate(() => {
        const v = document.querySelector('video')
        return v ? { t: v.currentTime, dur: v.duration } : null
      })
      const file = join(OUT, `${name}-${String(Math.round(d * 100)).padStart(3, '0')}.jpg`)
      await page.screenshot({ path: file, type: 'jpeg', quality: 82 })
      samples.push({ depth: d, t: state?.t ?? null, dur: state?.dur ?? null })
      report.shots.push({ vp: name, depth: d, videoTime: state?.t ?? null })
    }

    // scrub assertions: near the top the film sits early, near the bottom it
    // has advanced most of the way — i.e. currentTime tracks scroll.
    const dur = samples.find((s) => s.dur)?.dur || 0
    const first = samples[0].t ?? 0
    const last = samples[samples.length - 1].t ?? 0
    report.scrub[name] = { dur, first: +first.toFixed(2), last: +last.toFixed(2) }
    if (!dur) report.errors.push(`[${name}] film duration unknown (never decoded)`)
    if (dur && first > dur * 0.35) report.errors.push(`[${name}] top of film not near start (t=${first.toFixed(2)})`)
    if (dur && last < dur * 0.6) report.errors.push(`[${name}] film did not scrub toward the end (t=${last.toFixed(2)})`)

    report.video[name] = await page.evaluate(() => {
      const v = document.querySelector('video')
      return v ? { duration: v.duration, ready: v.readyState } : 'no <video>'
    })
    await ctx.close()
  }

  // ---- static fallback: stub canPlayType('') → poster + stacked beats, no video ----
  for (const [name, vp] of VIEWPORTS) {
    const ctx = await browser.newContext({
      viewport: vp,
      deviceScaleFactor: vp.deviceScaleFactor,
      isMobile: vp.isMobile,
      hasTouch: vp.hasTouch,
    })
    const page = await ctx.newPage()
    page.on('console', (m) => {
      if (m.type() === 'error') report.errors.push(`[static ${name}] ${m.text()}`)
    })
    page.on('pageerror', (e) => report.errors.push(`[static ${name}] pageerror: ${e.message}`))
    await page.addInitScript(() => {
      HTMLVideoElement.prototype.canPlayType = () => ''
    })
    await page.goto(`http://127.0.0.1:${PORT}/`, { waitUntil: 'load' })
    await page.waitForTimeout(400)
    const s = await page.evaluate(() => ({
      hasVideo: !!document.querySelector('video'),
      hasTop: !!document.getElementById('top'),
      hasMarker: !!document.getElementById('film-act-end'),
      heroText: document.body.innerText.includes('Park like'),
      finaleText: document.body.innerText.includes('circling stops'),
    }))
    report.static[name] = s
    if (s.hasVideo) report.errors.push(`[static ${name}] <video> present — fallback did not engage`)
    if (!s.hasTop || !s.hasMarker) report.errors.push(`[static ${name}] film act structure missing`)
    if (!s.heroText || !s.finaleText) report.errors.push(`[static ${name}] beats not rendered in fallback`)
    await page.screenshot({ path: join(OUT, `static-${name}.jpg`), type: 'jpeg', quality: 82 })
    await ctx.close()
  }

  await browser.close()
  server.close()

  console.log(JSON.stringify(report, null, 2))
  console.log(`\nshots → ${OUT}`)
  if (report.errors.length) {
    console.error(`\n✗ ${report.errors.length} problem(s)`)
    process.exit(1)
  }
  console.log('\n✓ verify passed')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
