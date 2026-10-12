# Motion

A headless render engine for motion studies. It opens an HTML scene in
headless Chromium, paints it one frame at a time on a virtual clock, takes a
screenshot of each frame, and pipes the frames to ffmpeg, which stitches
them into an MP4.

Nothing plays in real time. The engine moves the page's clock to each
frame's exact time before it captures, so a 60 fps render has every frame,
even on a slow machine, and the same scene renders the same video every time.

## Setup

You need Node.js 20 or newer. Then, in this folder:

```sh
npm install                       # Playwright, plus an ffmpeg binary (ffmpeg-static)
npx playwright install chromium   # the headless browser
npm test                          # renders a 1-second test clip and checks it
```

A system ffmpeg works too; set `FFMPEG_PATH` to choose one. To use a
Chromium or Chrome that's already installed, set `CHROMIUM_PATH` (the
Claude workspace uses `CHROMIUM_PATH=/opt/pw-browsers/chromium`).

## Render

```sh
node render.mjs examples/next-step.html              # writes out/next-step.mp4
node render.mjs my-scene.html --fps 30 --duration 4 --out out/take-2.mp4
node render.mjs my-scene.html --frames out/frames    # also keep every frame as a PNG
node render.mjs --help
```

Defaults: 60 fps, 3 seconds, a 390 × 844 phone viewport at 2× (780 × 1688
video), H.264 at quality 18. `--selector ".card"` captures one element
instead of the viewport.

## Writing a scene

A scene is an ordinary HTML page. Link `../../src/index.css` to use the
app's real tokens and type, as the example does. These run on the engine's
clock with no extra work:

- CSS `@keyframes` animations and transitions
- The Web Animations API (`element.animate(...)`)
- `requestAnimationFrame`, `setTimeout`, `setInterval`
- `performance.now()` and `Date` (which starts at 2026-01-01 so runs match)

An animation's time starts at the frame where the engine first sees it, so
use `animation-delay` (or a timer) to place things on the timeline.

A scene can set its own defaults:

```html
<script>
  window.MOTION = { fps: 60, duration: 1.6, width: 390, height: 844 }
</script>
```

For full control (canvas, SVG, hand-written easing), define
`window.renderFrame(t, frame)`. The engine calls it every frame with the time
in milliseconds and the frame number, after timers and animation frames run
and before it captures.

```js
window.renderFrame = (t) => {
  const p = Math.min(1, t / 400)
  dot.style.transform = `translateX(${300 * (1 - (1 - p) ** 3)}px)`
}
```

## How it works

`render.mjs` does this:

1. Before any scene script runs, it injects a virtual clock that replaces
   `requestAnimationFrame`, the timers, `performance.now` and `Date`.
2. It loads the scene, reads `window.MOTION`, sizes the viewport and waits
   for fonts.
3. For each frame `i`, with `t = i / fps` seconds, it:
   1. fires timers due by `t`;
   2. runs one animation frame;
   3. calls `renderFrame`;
   4. pauses every CSS and Web Animation and seeks it to `t`;
   5. screenshots the page as a PNG.
4. Each PNG goes straight to ffmpeg (`image2pipe` into H.264, `yuv420p`,
   `+faststart`), so frames never pile up on disk unless you ask with
   `--frames`.

`npm test` renders the example at 30 fps for one second and checks the result
with ffprobe: H.264, the right size, 30 frames, 1.00 s.

## Notes

- Renders show full motion. The app itself should still honor
  `prefers-reduced-motion`; the example shows the pattern.
- `out/` is ignored by git. Share renders, don't commit them.
