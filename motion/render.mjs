#!/usr/bin/env node
// Headless render engine for motion studies.
//
// Opens an HTML scene in headless Chromium with a virtual clock, then for
// each video frame: moves the clock to that frame's time, lets the page
// paint, takes a screenshot, and pipes it to ffmpeg, which stitches the
// frames into an MP4. Nothing plays in real time, so every frame is exact
// and a render looks the same on every run and every machine.
//
// What the clock drives:
//   - CSS animations and transitions, and the Web Animations API
//   - requestAnimationFrame, setTimeout, setInterval, performance.now, Date
//   - window.renderFrame(t, frame) if the scene defines one (canvas, SVG, anything)
//
// Usage: node render.mjs <scene.html | url> [options]   (see --help)

import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { parseArgs } from 'node:util'

const HELP = `Render an HTML scene to MP4, frame by frame.

  node render.mjs <scene.html | url> [options]

Options (a scene can also set these in window.MOTION; the command line wins):
  --out <file>          Output video. Default: out/<scene name>.mp4
  --fps <n>             Frames per second. Default 60
  --duration <s>        Length in seconds. Default 3
  --width <px>          Viewport width in CSS px. Default 390 (a phone)
  --height <px>         Viewport height in CSS px. Default 844
  --scale <n>           Device pixel ratio. Default 2, so 390 x 844 renders 780 x 1688
  --selector <css>      Capture only this element instead of the viewport
  --crf <n>             x264 quality, lower is better and larger. Default 18
  --frames <dir>        Also save every frame as a PNG in this folder
  --background <color>  Page background behind the scene. Default white
  --help                Show this

Environment:
  CHROMIUM_PATH         Use this Chromium or Chrome instead of Playwright's own
  FFMPEG_PATH           Use this ffmpeg. Otherwise ffmpeg-static, then ffmpeg on PATH`

// Injected before any scene script runs. Replaces the page's clocks with one
// that only moves when the engine says so.
const CLOCK = `(() => {
  const EPOCH = 1767225600000; // 2026-01-01T00:00:00Z: Date is the same on every run
  let now = 0;
  const frames = new Map(); let frameId = 0;
  const timers = new Map(); let timerId = 0;
  const RealDate = Date;
  class VirtualDate extends RealDate {
    constructor(...args) { if (args.length === 0) super(EPOCH + now); else super(...args); }
    static now() { return EPOCH + now; }
  }
  window.Date = VirtualDate;
  performance.now = () => now;
  window.requestAnimationFrame = (cb) => { frames.set(++frameId, cb); return frameId; };
  window.cancelAnimationFrame = (id) => { frames.delete(id); };
  window.setTimeout = (cb, ms, ...args) => { const id = ++timerId; timers.set(id, { at: now + Math.max(0, Number(ms) || 0), cb, args }); return id; };
  window.setInterval = (cb, ms, ...args) => { const id = ++timerId; const every = Math.max(1, Number(ms) || 0); timers.set(id, { at: now + every, cb, args, every }); return id; };
  window.clearTimeout = window.clearInterval = (id) => { timers.delete(id); };
  const born = new WeakMap();
  window.__motion = {
    // Fire timers due by t in time order, then one animation frame at t.
    advanceTo(t) {
      for (;;) {
        let next = null;
        for (const entry of timers) if (entry[1].at <= t && (!next || entry[1].at < next[1].at)) next = entry;
        if (!next) break;
        const [id, timer] = next;
        now = timer.at;
        if (timer.every) timer.at += timer.every; else timers.delete(id);
        if (typeof timer.cb === 'function') { try { timer.cb(...timer.args); } catch (e) { console.error(e); } }
      }
      now = t;
      const due = [...frames.values()]; frames.clear();
      for (const cb of due) { try { cb(now); } catch (e) { console.error(e); } }
    },
    // Seek every CSS and Web Animation to the clock. An animation's time
    // starts when the engine first sees it.
    seek() {
      for (const a of document.getAnimations()) {
        if (!born.has(a)) { born.set(a, now); a.pause(); }
        a.currentTime = now - born.get(a);
      }
    },
  };
})();`

function fail(message) {
  console.error(`render: ${message}`)
  process.exit(1)
}

async function findFfmpeg() {
  if (process.env.FFMPEG_PATH) return process.env.FFMPEG_PATH
  try {
    const { default: path } = await import('ffmpeg-static')
    if (path && existsSync(path)) return path
  } catch {
    // Not installed; fall back to the system's.
  }
  return 'ffmpeg'
}

function startEncoder(ffmpeg, { fps, crf, out }) {
  mkdirSync(dirname(out), { recursive: true })
  const args = [
    '-y', '-loglevel', 'error',
    '-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'png', '-i', '-',
    // x264 needs even dimensions; pad by a pixel if the capture is odd.
    '-vf', 'pad=ceil(iw/2)*2:ceil(ih/2)*2',
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', String(crf), '-preset', 'slow',
    '-movflags', '+faststart',
    out,
  ]
  const proc = spawn(ffmpeg, args, { stdio: ['pipe', 'inherit', 'inherit'] })
  const done = new Promise((resolveDone, rejectDone) => {
    proc.on('error', (e) => rejectDone(new Error(`could not start ffmpeg (${ffmpeg}): ${e.message}`)))
    proc.on('close', (code) => (code === 0 ? resolveDone() : rejectDone(new Error(`ffmpeg exited with ${code}`))))
  })
  const write = (buffer) =>
    new Promise((resolveWrite, rejectWrite) => {
      proc.stdin.write(buffer, (e) => (e ? rejectWrite(e) : resolveWrite()))
    })
  const finish = async () => {
    proc.stdin.end()
    await done
  }
  return { write, finish, done }
}

export async function render(scene, options = {}) {
  const url = /^https?:|^file:/.test(scene) ? scene : pathToFileURL(resolve(scene)).href
  let browser
  try {
    browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined })
  } catch (e) {
    throw new Error(`could not start Chromium. Run "npx playwright install chromium" or set CHROMIUM_PATH.\n${e.message}`)
  }
  try {
    const scale = Number(options.scale ?? 2)
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: scale,
      reducedMotion: 'no-preference',
    })
    await context.addInitScript(CLOCK)
    const page = await context.newPage()
    page.on('pageerror', (e) => console.error(`scene error: ${e.message}`))
    await page.goto(url, { waitUntil: 'load' })

    // Settings: command line, then the scene's window.MOTION, then defaults.
    const fromScene = (await page.evaluate(() => window.MOTION ?? {})) || {}
    const pick = (key, fallback) => options[key] ?? fromScene[key] ?? fallback
    const fps = Number(pick('fps', 60))
    const duration = Number(pick('duration', 3))
    const width = Number(pick('width', 390))
    const height = Number(pick('height', 844))
    const crf = Number(pick('crf', 18))
    const background = pick('background', null)
    const selector = pick('selector', null)
    const total = Math.max(1, Math.round(duration * fps))
    const name = scene.replace(/^.*[\\/]/, '').replace(/\.[^.]+$/, '') || 'scene'
    const out = resolve(options.out ?? `out/${name}.mp4`)

    await page.setViewportSize({ width, height })
    if (background) await page.addStyleTag({ content: `html, body { background: ${background}; }` })
    await page.evaluate(() => document.fonts.ready)

    const target = selector ? page.locator(selector).first() : page
    if (selector && (await page.locator(selector).count()) === 0) throw new Error(`no element matches ${selector}`)
    if (options.frames) mkdirSync(resolve(options.frames), { recursive: true })

    const encoder = startEncoder(await findFfmpeg(), { fps, crf, out })
    encoder.done.catch(() => {}) // reported by finish()
    const started = Date.now()
    for (let frame = 0; frame < total; frame++) {
      const t = (frame * 1000) / fps
      await page.evaluate(
        async ({ t, frame }) => {
          window.__motion.advanceTo(t)
          if (typeof window.renderFrame === 'function') await window.renderFrame(t, frame)
          window.__motion.seek()
        },
        { t, frame },
      )
      const png = await target.screenshot({ type: 'png', animations: 'allow', caret: 'initial' })
      if (options.frames) writeFileSync(resolve(options.frames, `frame-${String(frame).padStart(5, '0')}.png`), png)
      await encoder.write(png)
      if (!options.quiet && (frame === total - 1 || frame % Math.max(1, Math.round(total / 10)) === 0)) {
        process.stdout.write(`\rframe ${frame + 1}/${total}`)
      }
    }
    await encoder.finish()
    if (!options.quiet) {
      const seconds = ((Date.now() - started) / 1000).toFixed(1)
      console.log(`\nwrote ${out}: ${total} frames at ${fps} fps, ${width * scale} x ${height * scale} px, rendered in ${seconds} s`)
    }
    return { out, frames: total, fps, width: width * scale, height: height * scale }
  } finally {
    await browser.close()
  }
}

// Command line
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      out: { type: 'string' },
      fps: { type: 'string' },
      duration: { type: 'string' },
      width: { type: 'string' },
      height: { type: 'string' },
      scale: { type: 'string' },
      selector: { type: 'string' },
      crf: { type: 'string' },
      frames: { type: 'string' },
      background: { type: 'string' },
      help: { type: 'boolean' },
    },
  })
  if (values.help || positionals.length !== 1) {
    console.log(HELP)
    process.exit(values.help ? 0 : 1)
  }
  render(positionals[0], values).catch((e) => fail(e.message))
}
