// A placeholder cook avatar, drawn in its own fixed colors: a near-black
// outline on white and light gray fills. It looks the same in light and
// dark mode, so it never sinks into a dark background.
// Outfits, hats, scene and duo poses are badge rewards (see lib/avatars).
// label: what a screen reader hears; without one the drawing is hidden.

const RIGHT_ARM = {
  idle: ['M80 82 L92 116', 92, 116],
  wave: ['M80 80 L100 62 L104 40', 104, 40],
  highfive: ['M80 80 L104 56 L114 36', 114, 36],
  taste: ['M80 84 L98 74 L80 58', 80, 58],
}

// hatDrops: the hat drops on once (setup's first badge), unless reduced
// motion is on.
export default function Avatar({ pose = 'idle', outfit = 'none', hat = 'none', flip = false, size = 160, label, className, hatDrops = false }) {
  const hatClass = hatDrops ? 'avatar-hat drops' : 'avatar-hat'
  const [arm, rhx, rhy] = RIGHT_ARM[pose] ?? RIGHT_ARM.idle
  const apron = outfit === 'apron' || outfit === 'striped'
  return (
    <svg
      className={className}
      role={label ? 'img' : undefined}
      aria-label={label || undefined}
      aria-hidden={label ? undefined : 'true'}
      focusable="false"
      width={Math.round(size * 0.75)}
      height={size}
      viewBox="0 0 120 160"
      fill="none"
      stroke="#111111"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ display: 'block', flex: 'none', transform: flip ? 'scaleX(-1)' : undefined }}
    >
      <path d="M50 128 V152 h-8 M70 128 V152 h8" />
      {/* Arms come before the body, so the body hides where they join. */}
      <path d={`M40 82 L28 116${arm}`} />
      <rect x="38" y="68" width="44" height="62" rx="14" fill="#ffffff" />
      {apron && (
        <>
          <path d="M50 86 L54 70 M70 86 L66 70" strokeWidth="2.5" />
          <path d="M46 86 h28 v34 a6 6 0 0 1 -6 6 h-16 a6 6 0 0 1 -6 -6z" fill="#ffffff" />
          <path d="M54 104 h12 v8 h-12z" strokeWidth="2" />
        </>
      )}
      {outfit === 'striped' && <path d="M46 96 h28 M46 116 h28" strokeWidth="2" />}
      <circle cx="28" cy="116" r="5" fill="#f2f2f2" />
      <circle cx={rhx} cy={rhy} r="5" fill="#f2f2f2" />
      {pose === 'taste' && (
        <>
          <path d="M78 58 L70 48" strokeWidth="2.5" />
          <ellipse cx="68" cy="46" rx="4" ry="3" fill="#ffffff" strokeWidth="2" />
        </>
      )}
      <circle cx="60" cy="40" r="20" fill="#f2f2f2" />
      <circle cx="53" cy="39" r="2.2" fill="#111111" stroke="none" />
      <circle cx="67" cy="39" r="2.2" fill="#111111" stroke="none" />
      <path d={pose === 'taste' ? 'M56 48 h8' : 'M53 47 q7 6 14 0'} strokeWidth="2.5" />
      {hat === 'chef' && (
        <g className={hatClass}>
          <circle cx="49.5" cy="13.5" r="8.5" fill="#ffffff" />
          <circle cx="70.5" cy="13.5" r="8.5" fill="#ffffff" />
          <circle cx="60" cy="11" r="10" fill="#ffffff" />
          <rect x="46" y="17" width="28" height="12" rx="2.5" fill="#ffffff" />
          <path d="M53 20.5 v5.5 M60 20.5 v5.5 M67 20.5 v5.5" strokeWidth="2" />
        </g>
      )}
      {hat === 'beanie' && (
        <g className={hatClass}>
          <path d="M40 32 a20 20 0 0 1 40 0 z" fill="#111111" />
          <circle cx="60" cy="10" r="4" fill="#111111" />
        </g>
      )}
    </svg>
  )
}

// A round crop of the avatar on the cook's color: for owner pills, notes,
// and the color picker. size is the circle's width in px.
export function AvatarFace({ look, color, size = 26, className = '' }) {
  // The 120 x 160 drawing at this scale puts the face in the circle.
  const drawing = Math.round(size * 3.08)
  return (
    <span
      className={`avatar-face ${className}`}
      aria-hidden="true"
      style={{ width: size, height: size, background: color ? `var(--cook-${color})` : 'var(--color-subtle)' }}
    >
      {/* The circle centers the wider drawing; only the top needs moving. */}
      <span style={{ display: 'block', marginTop: -size * 0.115 }}>
        <Avatar pose="idle" outfit={look?.outfit} hat={look?.hat} size={drawing} />
      </span>
    </span>
  )
}

// A larger round portrait (setup and the closet), showing hat to waist.
export function AvatarPortrait({ look, color, size = 120, pose = 'idle', label, hatDrops = false }) {
  return (
    <span
      className="avatar-portrait"
      role={label ? 'img' : undefined}
      aria-label={label || undefined}
      aria-hidden={label ? undefined : 'true'}
      style={{ width: size, height: size, background: color ? `var(--cook-${color})` : 'var(--color-subtle)' }}
    >
      <span style={{ display: 'block', marginTop: size * 0.08 }}>
        <Avatar pose={pose} outfit={look?.outfit} hat={look?.hat} size={Math.round(size * 1.5)} hatDrops={hatDrops} />
      </span>
    </span>
  )
}
