import Avatar, { lookProps as lookOf } from './Avatar'
import { DUO, FLIP, SceneArt, sceneCaption } from './Scene'
import { COLORS, describeLook, normalizeColor } from '../lib/avatars'

// The images "Share my look" and "Share our scene" send: 4:5, so they fit
// messages and feeds. They're drawn as SVG with fixed light colors (the
// page's CSS doesn't travel with an image), then turned into a PNG.
// Nothing about the kitchen is in them beyond first names.

const W = 360
const H = 450
const FONT = "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
const hexOf = (id) => COLORS.find((c) => c.id === normalizeColor(id))?.hex ?? COLORS[0].hex


function Frame({ children, svgRef, label }) {
  return (
    <svg
      ref={svgRef}
      xmlns="http://www.w3.org/2000/svg"
      viewBox={`0 0 ${W} ${H}`}
      width={W * 3}
      height={H * 3}
      role="img"
      aria-label={label}
      fontFamily={FONT}
    >
      <rect x="1" y="1" width={W - 2} height={H - 2} fill="#ffffff" stroke="#111111" strokeWidth="2" />
      <text x="20" y="40" fontSize="14" fontWeight="700" letterSpacing="0.6" fill="#111111">
        OUR KITCHEN
      </text>
      {children}
    </svg>
  )
}

// "Erin's look", on her color.
export function LookCard({ cook, svgRef }) {
  const worn = describeLook(cook.look)
  const words = worn ? worn.charAt(0).toUpperCase() + worn.slice(1) : 'Ready to cook'
  return (
    <Frame svgRef={svgRef} label={lookCardAlt(cook)}>
      <defs>
        <clipPath id="look-card-circle">
          <circle cx="180" cy="175" r="110" />
        </clipPath>
      </defs>
      <circle cx="180" cy="175" r="110" fill={hexOf(cook.color)} />
      <g clipPath="url(#look-card-circle)">
        <g transform="translate(56 83)">
          <Avatar pose="wave" {...lookOf(cook.look)} size={330} />
        </g>
      </g>
      <text x="180" y="322" textAnchor="middle" fontSize="28" fontWeight="700" fill="#111111">
        {cook.name}’s look
      </text>
      <text x="180" y="352" textAnchor="middle" fontSize="17" fill="#525252">
        {words.replace(/, /g, ' · ')}
      </text>
      <text x="180" y="422" textAnchor="middle" fontSize="14" fill="#525252">
        Unlocked by cooking together
      </text>
    </Frame>
  )
}

export const lookCardAlt = (cook) => {
  const worn = describeLook(cook.look)
  return `${cook.name}’s look in Our Kitchen${worn ? `: ${worn}` : ''}, waving.`
}

// Both cooks in the kitchen's scene and pose.
export function SceneCard({ cooks, scene, pose, svgRef }) {
  const [left, right] = DUO[pose] ?? DUO.wave
  const [flipA, flipB] = cooks.length > 1 ? FLIP[pose] ?? FLIP.wave : [false, false]
  const size = 176
  const w = size * 0.75
  const overlap = size * 0.15
  const total = cooks.length > 1 ? w * 2 - overlap : w
  const x0 = 180 - total / 2
  const y = 290 - 22 - size
  // A flipped avatar is mirrored around its own box.
  const place = (x, flip) => (flip ? `translate(${x + w} ${y}) scale(-1 1)` : `translate(${x} ${y})`)
  const caption = sceneCaption(cooks, scene, pose)
  const names = cooks.map((c) => c.name).join(' and ')
  return (
    <Frame svgRef={svgRef} label={`${caption}. Our Kitchen.`}>
      <rect x="20" y="60" width="320" height="230" rx="16" fill="#f2f2f2" />
      <SceneArt scene={scene} x={20} y={60} width={320} height={230} color="#525252" />
      {cooks[0] && (
        <g transform={place(x0, flipA)}>
          <Avatar pose={cooks.length > 1 ? left : 'wave'} {...lookOf(cooks[0].look)} size={size} />
        </g>
      )}
      {cooks[1] && (
        <g transform={place(x0 + w - overlap, flipB)}>
          <Avatar pose={right} {...lookOf(cooks[1].look)} size={size} />
        </g>
      )}
      <text x="180" y="334" textAnchor="middle" fontSize="28" fontWeight="700" fill="#111111">
        {names}
      </text>
      <text x="180" y="364" textAnchor="middle" fontSize="17" fill="#525252">
        {caption.slice(names.length + 1).replace(/^./, (c) => c.toUpperCase())}
      </text>
      <text x="180" y="422" textAnchor="middle" fontSize="14" fill="#525252">
        Cooking together in Our Kitchen
      </text>
    </Frame>
  )
}
