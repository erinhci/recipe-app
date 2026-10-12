// Smoke test: renders the example small and short, then checks the video
// with ffprobe: right codec, size, frame count and duration.
import { execFileSync } from 'node:child_process'
import { rmSync } from 'node:fs'
import assert from 'node:assert/strict'
import { render } from './render.mjs'

const out = 'out/test.mp4'
rmSync(out, { force: true })
const result = await render('examples/next-step.html', { out, fps: 30, duration: 1, scale: 1, quiet: true })

const probe = JSON.parse(
  execFileSync(process.env.FFPROBE_PATH || 'ffprobe', [
    '-v', 'error', '-select_streams', 'v:0', '-count_frames',
    '-show_entries', 'stream=codec_name,width,height,nb_read_frames,pix_fmt:format=duration',
    '-of', 'json', out,
  ]).toString(),
)
const stream = probe.streams[0]
assert.equal(stream.codec_name, 'h264')
assert.equal(stream.pix_fmt, 'yuv420p')
assert.equal(stream.width, 390)
assert.equal(stream.height, 844)
assert.equal(Number(stream.nb_read_frames), result.frames)
assert.ok(Math.abs(Number(probe.format.duration) - 1) < 0.05, `duration ${probe.format.duration}`)
console.log(`ok: ${result.frames} frames, ${stream.width} x ${stream.height}, ${Number(probe.format.duration).toFixed(2)} s, h264`)
