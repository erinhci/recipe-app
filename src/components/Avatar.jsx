// A placeholder cook avatar, drawn in its own fixed colors: a near-black
// outline on white and light gray fills. It looks the same in light and
// dark mode, so it never sinks into a dark background.
// Outfits, hats, scene and duo poses are badge rewards (see lib/avatars).
// Skin tone and hair are free choices.
// label: what a screen reader hears; without one the drawing is hidden.

const RIGHT_ARM = {
  idle: ['M80 82 L92 116', 92, 116],
  wave: ['M80 80 L100 62 L104 40', 104, 40],
  highfive: ['M80 80 L104 56 L114 36', 114, 36],
  taste: ['M80 84 L98 74 L80 58', 80, 58],
}

// Skin: 'plain' is the neutral gray placeholder shown until a cook picks
// a tone (it isn't offered as a choice). 1 to 12 run lightest to deepest,
// across pink, golden and olive undertones. Eyes and mouth are dark on 1
// to 7 and light on 8 to 12, so they stay at least 4.5:1 on every tone.
export const SKIN_TONES = {
  plain: '#f2f2f2', 1: '#fbe3d5', 2: '#f6d2b3', 3: '#ecc19a', 4: '#e0ac85', 5: '#d0996b', 6: '#b98a5e',
  7: '#a96f47', 8: '#8f5a37', 9: '#75452a', 10: '#5c3420', 11: '#45261a', 12: '#2f1b13',
}
export const isDeepTone = (skin) => Number(skin) >= 8

const LIGHT = '#fbf3ec'
const LOCS_BACK = 'M38 34 Q32 52 34 84 M42 27 Q36 48 40 82 M47 22 Q43 30 44 52 M82 34 Q88 52 86 84 M78 27 Q84 48 80 82 M73 22 Q77 30 76 52 M35 44 Q30 60 30 78 M85 44 Q90 60 90 78'
const LOCS_BACK_TWIST = 'M39.4 37.0 L34.5 38.1 M38.0 42.7 L33.2 44.2 M37.0 48.3 L32.3 50.1 M36.3 54.2 L31.7 56.3 M35.9 60.1 L31.4 62.3 M35.7 66.0 L31.3 68.4 M35.7 72.0 L31.4 74.5 M35.9 78.0 L31.6 80.6 M43.5 30.0 L38.6 31.3 M42.3 35.6 L37.6 37.2 M41.4 41.6 L36.8 43.5 M40.9 47.5 L36.4 49.6 M40.6 53.2 L36.2 55.5 M40.6 59.1 L36.3 61.6 M40.8 65.1 L36.5 67.7 M41.1 71.0 L37.0 73.8 M41.7 76.9 L37.5 79.7 M48.1 24.9 L43.2 26.0 M46.8 30.4 L42.2 32.2 M46.2 36.2 L41.7 38.4 M46.0 42.2 L41.6 44.6 M46.1 48.1 L41.7 50.7 M84.9 35.8 L81.3 39.3 M86.4 41.9 L82.5 45.0 M87.4 47.8 L83.3 50.7 M88.1 53.9 L83.9 56.6 M88.5 59.9 L84.2 62.5 M88.7 66.0 L84.3 68.4 M88.7 72.1 L84.2 74.4 M88.5 78.2 L84.0 80.4 M80.8 29.0 L77.1 32.3 M82.1 34.8 L78.1 37.9 M83.0 41.1 L78.8 44.0 M83.5 47.2 L79.2 49.9 M83.8 53.1 L79.4 55.6 M83.8 59.2 L79.3 61.5 M83.6 65.3 L79.1 67.5 M83.2 71.4 L78.7 73.4 M82.7 77.3 L78.1 79.3 M76.1 23.7 L72.5 27.2 M77.5 29.8 L73.5 32.8 M78.2 36.0 L73.9 38.6 M78.4 42.2 L74.0 44.6 M78.3 48.3 L73.9 50.5 M36.4 47.0 L31.5 48.1 M35.0 52.6 L30.2 54.0 M33.8 58.5 L29.1 60.2 M33.0 64.2 L28.4 66.1 M32.4 70.2 L27.9 72.3 M32.2 76.1 L27.8 78.5 M87.8 45.8 L84.2 49.3 M89.3 51.6 L85.5 54.9 M90.6 57.8 L86.6 60.8 M91.4 63.7 L87.3 66.6 M92.0 69.9 L87.7 72.6 M92.2 76.1 L87.8 78.5'
const LOCS_FRONT_CAP = 'M40 36 C40 23 50 17 60 17 C70 17 80 23 80 36 C74 28 67 25 60 25 C53 25 46 28 40 36z'
const LOCS_FRONT = 'M56 19 Q45 22 41 38 M64 19 Q75 22 79 38 M60 18 Q52 24 48 31 M60 18 Q68 24 72 31'
const LOCS_FRONT_TWIST = 'M54.6 21.7 L50.5 18.9 M50.3 24.6 L45.4 23.4 M46.9 28.8 L41.9 28.9 M44.5 33.9 L39.6 34.8 M67.4 17.8 L67.5 22.8 M73.0 21.6 L71.4 26.4 M77.0 26.8 L74.2 31.0 M79.6 32.5 L76.2 36.2 M59.5 21.2 L54.8 19.4 M55.3 25.0 L50.4 23.8 M51.6 29.3 L46.7 28.9 M63.3 17.8 L62.3 22.7 M68.0 22.1 L66.4 26.8 M72.0 26.9 L69.7 31.3'
const BRAID = [
  [78, 46, 4.6],
  [80, 54, 4.6],
  [81.5, 62, 4.4],
  [82.5, 70, 4.2],
  [83, 78, 4],
  [83, 85.5, 3.6],
]
const BRAIDS = [
  [40, 48, 4.2],
  [39, 56, 4.2],
  [40, 64, 4.2],
  [41, 72, 3.6],
  [80, 48, 4.2],
  [81, 56, 4.2],
  [80, 64, 4.2],
  [79, 72, 3.6],
]
const LONG_CURLY = [
  [39, 34, 8],
  [36, 46, 8],
  [38, 58, 8],
  [43, 68, 7],
  [81, 34, 8],
  [84, 46, 8],
  [82, 58, 8],
  [77, 68, 7],
]
const CURLS = [
  [43, 31, 6],
  [50, 23, 6.5],
  [60, 20, 7],
  [70, 23, 6.5],
  [77, 31, 6],
]
const CAP_STYLES = ['short', 'bun', 'long', 'ponytail', 'braids', 'braid', 'puffs', 'mullet']

// Hair is drawn in the outline color. Back pieces sit behind the head and
// front pieces on it, all under any hat. Under a hat the bun and puffs
// tuck in and the afro sits lower, so it frames the hat. On deep skin
// tones hair gets a light edge and the head a thin light ring, so the face
// reads on the dark page and against dark hair.
function Hair({ hair, hat, edge, layer }) {
  const blob = (cx, cy, r, w = 1.5) => <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r={r} fill="#111111" stroke={edge} strokeWidth={w} />
  if (layer === 'back') {
    return (
      <>
        {hair === 'afro' && <circle cx="60" cy={hat === 'none' ? 34 : 38} r={hat === 'none' ? 27 : 25} fill="#111111" stroke={edge} strokeWidth="2" />}
        {hair === 'longcurly' && (
          <>
            <circle cx="60" cy="34" r="22" fill="#111111" stroke="none" />
            {LONG_CURLY.map(([x, y, r]) => blob(x, y, r))}
          </>
        )}
        {hair === 'long' && <path d="M39 40 C39 18 81 18 81 40 V92 Q81 97 76 97 Q73 97 72 94 V46 H48 V94 Q47 97 44 97 Q39 97 39 92z" fill="#111111" stroke={edge} strokeWidth="2" />}
        {hair === 'bob' && <path d="M38 42 C38 17 82 17 82 42 V58 h-11 V46 H49 V58 h-11z" fill="#111111" stroke={edge} strokeWidth="2" />}
        {hair === 'locs' && (
          <>
            <path d={LOCS_BACK} stroke={edge} strokeWidth="7.6" />
            <path d={LOCS_BACK} stroke="#111111" strokeWidth="5.4" />
            <path d={LOCS_BACK_TWIST} stroke="#ffffff" strokeWidth="1" strokeOpacity="0.85" />
          </>
        )}
        {hair === 'ponytail' && <path d="M76 27 C93 24 99 44 91 63 C88 52 84 44 77 40z" fill="#111111" stroke={edge} strokeWidth="2" />}
        {hair === 'mullet' && (
          <path
            d="M45 50 C43 59 39 66 32 73 L38 71 L37 75 L44 70 C48 68 50 65 51 62 V58 H69 V62 C70 65 72 68 76 70 L83 75 L82 71 L88 73 C81 66 77 59 75 50z"
            fill="#111111"
            stroke={edge}
            strokeWidth="2"
          />
        )}
      </>
    )
  }
  return (
    <>
      {CAP_STYLES.includes(hair) && (
        <path d="M40 38 C40 23 50 18 60 18 C71 18 80 24 80 38 C74 30 67 28 59 30 C52 27 45 31 40 38z" fill="#111111" stroke={edge} strokeWidth="2" />
      )}
      {hair === 'buzz' && <path d="M41 34 C42 24 50 20 60 20 C70 20 78 24 79 34 C72 30 66 28.5 60 28.5 C54 28.5 48 30 41 34z" fill="#111111" stroke={edge} strokeWidth="1.5" />}
      {hair === 'bob' && <path d="M40 33 C41 22 50 18 60 18 C70 18 79 22 80 33z" fill="#111111" stroke={edge} strokeWidth="2" />}
      {(hair === 'curly' || hair === 'longcurly') && CURLS.map(([x, y, r]) => blob(x, y, r))}
      {hair === 'bun' && hat === 'none' && blob(60, 13, 7, 2)}
      {hair === 'puffs' && hat === 'none' && (
        <>
          {blob(42, 18, 8)}
          {blob(78, 18, 8)}
        </>
      )}
      {hair === 'braids' && BRAIDS.map(([x, y, r]) => blob(x, y, r))}
      {hair === 'braid' && (
        <>
          {BRAID.map(([x, y, r]) => blob(x, y, r))}
          <path d="M80 89.5 h6" stroke="#ffffff" strokeWidth="2" />
          <path d="M81 92 Q83 97 85 92" fill="#111111" stroke={edge} strokeWidth="1.5" />
        </>
      )}
      {hair === 'locs' && (
        <>
          <path d={LOCS_FRONT_CAP} fill="#111111" stroke={edge} strokeWidth="2" />
          <path d={LOCS_FRONT} stroke={edge} strokeWidth="7.6" />
          <path d={LOCS_FRONT} stroke="#111111" strokeWidth="5.4" />
          <path d={LOCS_FRONT_TWIST} stroke="#ffffff" strokeWidth="1" strokeOpacity="0.85" />
        </>
      )}
    </>
  )
}

// hatDrops: the hat drops on once (setup's first badge), unless reduced
// motion is on.
export default function Avatar({
  pose = 'idle',
  outfit = 'none',
  hat = 'none',
  skin = 'plain',
  hair = 'none',
  flip = false,
  size = 160,
  label,
  className,
  hatDrops = false,
}) {
  const hatClass = hatDrops ? 'avatar-hat drops' : 'avatar-hat'
  const [arm, rhx, rhy] = RIGHT_ARM[pose] ?? RIGHT_ARM.idle
  const apron = outfit === 'apron' || outfit === 'striped'
  const fill = SKIN_TONES[skin] ?? SKIN_TONES.plain
  const deep = isDeepTone(skin)
  const feature = deep ? LIGHT : '#111111'
  const edge = deep ? LIGHT : '#111111'
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
      <circle cx="28" cy="116" r="5" fill={fill} />
      <circle cx={rhx} cy={rhy} r="5" fill={fill} />
      {pose === 'taste' && (
        <>
          <path d="M78 58 L70 48" strokeWidth="2.5" />
          <ellipse cx="68" cy="46" rx="4" ry="3" fill="#ffffff" strokeWidth="2" />
        </>
      )}
      <Hair hair={hair} hat={hat} edge={edge} layer="back" />
      {deep && <circle cx="60" cy="40" r="22.6" stroke={LIGHT} strokeWidth="1.6" />}
      <circle cx="60" cy="40" r="20" fill={fill} />
      <Hair hair={hair} hat={hat} edge={edge} layer="front" />
      <circle cx="53" cy="39" r="2.2" fill={feature} stroke="none" />
      <circle cx="67" cy="39" r="2.2" fill={feature} stroke="none" />
      <path d={pose === 'taste' ? 'M56 48 h8' : 'M53 47 q7 6 14 0'} stroke={feature} strokeWidth="2.5" />
      {hat === 'chef' && (
        <g className={hatClass}>
          <circle cx="49.5" cy="13.5" r="8.5" fill="#ffffff" />
          <circle cx="70.5" cy="13.5" r="8.5" fill="#ffffff" />
          <circle cx="60" cy="11" r="10" fill="#ffffff" />
          <rect x="46" y="17" width="28" height="12" rx="2.5" fill="#ffffff" />
          <path d="M53 20.5 v5.5 M60 20.5 v5.5 M67 20.5 v5.5" strokeWidth="2" />
        </g>
      )}
      {/* White with ribs, a cuff and a pompom, so it never merges with dark hair. */}
      {hat === 'beanie' && (
        <g className={hatClass}>
          <path d="M40 32 a20 20 0 0 1 40 0 z" fill="#ffffff" />
          <path d="M50 16.5 V30 M60 13 V30 M70 16.5 V30" strokeWidth="1.8" />
          <rect x="38" y="27.5" width="44" height="7.5" rx="3.5" fill="#ffffff" />
          <circle cx="60" cy="8.5" r="4.5" fill="#ffffff" />
        </g>
      )}
    </svg>
  )
}

const lookProps = (look) => ({ outfit: look?.outfit, hat: look?.hat, skin: look?.skin, hair: look?.hair })

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
        <Avatar pose="idle" {...lookProps(look)} size={drawing} />
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
        <Avatar pose={pose} {...lookProps(look)} size={Math.round(size * 1.5)} hatDrops={hatDrops} />
      </span>
    </span>
  )
}
