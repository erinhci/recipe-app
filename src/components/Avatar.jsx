import { HAIR_COLORS, HAIR_SHAPES_FOR } from '../lib/hairDraw'

// A placeholder cook avatar, drawn in its own fixed colors: a near-black
// outline on white and light gray fills. It looks the same in light and
// dark mode, so it never sinks into a dark background.
// Aprons, costumes, scenes and duo poses are badge rewards (see
// lib/avatars). Skin tone, hair, hair color, everyday clothes, headwear,
// glasses and kitchen tools are free choices.
// label: what a screen reader hears; without one the drawing is hidden.

const RIGHT_ARM = {
  idle: ['M80 82 L92 116', 92, 116],
  wave: ['M80 80 L100 62 L104 40', 104, 40],
  highfive: ['M80 80 L104 56 L114 36', 114, 36],
  taste: ['M80 84 L98 74 L80 58', 80, 58],
  // Raised forward, holding a glass up to clink.
  cheers: ['M80 80 L98 66 L102 50', 102, 50],
}

// Skin: 'plain' is the neutral gray placeholder shown until a cook picks
// a tone (it isn't offered as a choice). 1 to 12 run lightest to deepest,
// across pink, golden and olive undertones. Eyes and mouth are black on
// every tone.
export const SKIN_TONES = {
  plain: '#f2f2f2', 1: '#fbe3d5', 2: '#f6d2b3', 3: '#ecc19a', 4: '#e0ac85', 5: '#d0996b', 6: '#b98a5e',
  7: '#a96f47', 8: '#8f5a37', 9: '#75452a', 10: '#5c3420', 11: '#45261a', 12: '#2f1b13',
}
export const isDeepTone = (skin) => Number(skin) >= 8

const LIGHT = '#fbf3ec'
const INK = '#111111'

// A turban, hijab or bonnet covers the hair completely, whatever style is
// picked, so no hair sticks out from under it.
export const COVERING_HATS = ['turban', 'hijab', 'bonnet']

function Hair({ hair, hat, fill, edge, layer }) {
  const pieces = HAIR_SHAPES_FOR(hair).filter((p) => p.layer === layer)
  return pieces.map((piece, i) =>
    piece.els.map(([Tag, attrs], j) => {
      const props = { ...attrs }
      if (props.fill === 'FILL') props.fill = fill
      if (props.fill === 'EDGE') props.fill = edge
      if (props.stroke === 'FILL') props.stroke = fill
      if (props.stroke === 'EDGE') props.stroke = edge
      // Under a hat the afro sits lower, so it frames the hat.
      if (piece.flag === 'hAfro' && hat !== 'none') Object.assign(props, { cy: 38, r: 25 })
      return <Tag key={`${i}-${j}`} {...props} />
    }),
  )
}

// Food costumes: silly badge rewards. Each sits over the body, under the
// hands, hair and face, with the dark outline and its own food colors.
function Costume({ outfit }) {
  switch (outfit) {
    case 'banana':
      return (
        <>
          <path d="M41 140 C29 108 33 58 52 22 C55 15 65 15 68 22 C87 58 91 108 79 140 Q60 147 41 140z" fill="#f4d35e" />
          <path d="M56 18 L57 8 h6 L64 18" fill="#6b4a2a" strokeWidth="2" />
          <path d="M47 66 C44 92 45 116 49 136 M73 66 C76 92 75 116 71 136" strokeWidth="1.8" />
        </>
      )
    case 'avocado':
      return (
        <>
          <path d="M60 14 C86 14 93 66 91 102 C89 136 77 146 60 146 C43 146 31 136 29 102 C27 66 34 14 60 14z" fill="#4f772d" />
          <path d="M60 24 C78 24 84 68 82 102 C80 128 72 137 60 137 C48 137 40 128 38 102 C36 68 42 24 60 24z" fill="#dfe8a6" strokeWidth="2" />
          <circle cx="60" cy="108" r="13" fill="#8a5a2b" />
        </>
      )
    case 'taco':
      return (
        <>
          <path d="M28 76 C28 146 92 146 92 76z" fill="#f2c14e" />
          <path d="M30 77 q5 -7 10 0 q5 -7 10 0 q5 -7 10 0 q5 -7 10 0 q5 -7 10 0 q5 -7 10 0" stroke="#3a7d2c" strokeWidth="4" />
          <circle cx="44" cy="82" r="3.5" fill="#d64545" strokeWidth="1.5" />
          <circle cx="76" cy="82" r="3.5" fill="#d64545" strokeWidth="1.5" />
          <path d="M40 100 l3 2 M56 112 l3 -2 M72 102 l-3 2 M64 126 l3 1 M48 122 l-2 2" strokeWidth="2" />
        </>
      )
    case 'hotdog':
      return (
        <>
          <path d="M32 70 h56 v64 a10 10 0 0 1 -10 10 h-36 a10 10 0 0 1 -10 -10z" fill="#e0b073" />
          <rect x="44" y="58" width="32" height="90" rx="16" fill="#b5523b" />
          <path d="M50 74 l20 8 l-20 8 l20 8 l-20 8 l20 8 l-20 8" stroke="#f4d35e" strokeWidth="3.5" />
        </>
      )
    case 'sushi':
      return (
        <>
          <rect x="29" y="64" width="62" height="78" rx="10" fill="#26352a" />
          <rect x="35" y="70" width="50" height="66" rx="7" fill="#ffffff" strokeWidth="2" />
          <rect x="48" y="90" width="24" height="28" rx="5" fill="#f08a5d" strokeWidth="2" />
          <path d="M56 98 l8 6 M54 106 l8 6" stroke="#ffffff" strokeWidth="1.8" />
        </>
      )
    case 'egg':
      return (
        <>
          <path d="M60 62 C80 58 97 72 92 94 C99 114 86 141 64 138 C45 146 25 131 30 110 C22 92 37 64 60 62z" fill="#ffffff" />
          <circle cx="60" cy="102" r="14" fill="#f4c430" />
          <path d="M53 96 q3 -4 7 -4" stroke="#ffffff" strokeWidth="2.5" />
        </>
      )
    case 'pizza':
      return (
        <>
          <path d="M30 70 L90 70 L60 148z" fill="#f2c14e" />
          <path d="M30 63 h60 a5.5 5.5 0 0 1 0 11 h-60 a5.5 5.5 0 0 1 0 -11z" fill="#c98a3e" />
          <circle cx="50" cy="86" r="5" fill="#c0392b" strokeWidth="1.8" />
          <circle cx="69" cy="92" r="5" fill="#c0392b" strokeWidth="1.8" />
          <circle cx="59" cy="114" r="4.5" fill="#c0392b" strokeWidth="1.8" />
        </>
      )
    case 'peapod':
      return (
        <>
          <path d="M60 12 C84 24 90 80 86 118 C84 140 72 150 60 150 C48 150 36 140 34 118 C30 80 36 24 60 12z" fill="#7cb342" />
          <circle cx="60" cy="82" r="10" fill="#aed581" strokeWidth="2" />
          <circle cx="60" cy="105" r="10" fill="#aed581" strokeWidth="2" />
          <circle cx="60" cy="128" r="10" fill="#aed581" strokeWidth="2" />
          <path d="M56 12 Q50 4 44 8" stroke="#3a7d2c" strokeWidth="2.5" />
        </>
      )
    default:
      return null
  }
}

// A kitchen tool, held upright in the left hand (which hangs free in every
// pose). The hand is drawn over its handle.
function Tool({ utensil }) {
  switch (utensil) {
    case 'spoon':
      return (
        <>
          <path d="M28.5 121 L25 92" />
          <ellipse cx="24" cy="84" rx="5" ry="8" fill="#ffffff" strokeWidth="2" />
        </>
      )
    case 'whisk':
      return (
        <>
          <path d="M28.5 121 L26.5 102" />
          <path d="M26.5 102 C15 92 18 74 25.5 74 C33 74 36 92 26.5 102z" fill="#ffffff" strokeWidth="2" />
          <path d="M26.5 102 C22 92 22.5 79 25.5 75 M26.5 102 C31 92 30.5 79 25.5 75" strokeWidth="1.5" />
        </>
      )
    case 'spatula':
      return (
        <>
          <path d="M28.5 121 L26.5 98" />
          <rect x="18.5" y="78" width="14" height="20" rx="3" fill="#ffffff" strokeWidth="2" />
          <path d="M23.5 82 v11 M27.5 82 v11" strokeWidth="1.5" />
        </>
      )
    case 'ladle':
      return (
        <>
          <path d="M28.5 121 L26 89" strokeWidth="2.5" />
          <path d="M18 81 a8 8 0 0 0 16 0z" fill="#ffffff" strokeWidth="2" />
        </>
      )
    case 'pin':
      return (
        <>
          <path d="M26 75 v7 M26 112 v9" />
          <rect x="21.5" y="82" width="9" height="30" rx="4.5" fill="#ffffff" strokeWidth="2" />
        </>
      )
    default:
      return null
  }
}

// Glasses sit over the eyes in the face's feature color (dark on light
// tones, light on deep ones); sunglasses have dark lenses.
function Glasses({ glasses, color }) {
  const frame = { stroke: color, strokeWidth: 1.8 }
  switch (glasses) {
    case 'round':
      return <path d="M53 33.5 a5.5 5.5 0 1 0 0.01 0 M67 33.5 a5.5 5.5 0 1 0 0.01 0 M58.5 38.5 q1.5 -1.5 3 0 M47.5 38 L40.5 36 M72.5 38 L79.5 36" {...frame} />
    case 'square':
      return (
        <path
          d="M49 34.5 h8 a2 2 0 0 1 2 2 v5 a2 2 0 0 1 -2 2 h-8 a2 2 0 0 1 -2 -2 v-5 a2 2 0 0 1 2 -2z M63 34.5 h8 a2 2 0 0 1 2 2 v5 a2 2 0 0 1 -2 2 h-8 a2 2 0 0 1 -2 -2 v-5 a2 2 0 0 1 2 -2z M59 38 h2 M47 37 L40.5 35.5 M73 37 L79.5 35.5"
          {...frame}
        />
      )
    case 'cateye':
      return (
        <path
          d="M47 35.5 Q53 33 59 35.5 Q59 43 53 43.5 Q47.5 43 47 35.5z M73 35.5 Q67 33 61 35.5 Q61 43 67 43.5 Q72.5 43 73 35.5z M47 35.5 L44.5 32.5 M73 35.5 L75.5 32.5 M59 37 h2 M47 37 L40.5 36 M73 37 L79.5 36"
          {...frame}
        />
      )
    case 'sun':
      return (
        <>
          <path
            d="M50 35 h6.5 a3.5 3.5 0 0 1 3.5 3.5 v1.5 a3.5 3.5 0 0 1 -3.5 3.5 h-6.5 a3.5 3.5 0 0 1 -3.5 -3.5 v-1.5 a3.5 3.5 0 0 1 3.5 -3.5z M63.5 35 h6.5 a3.5 3.5 0 0 1 3.5 3.5 v1.5 a3.5 3.5 0 0 1 -3.5 3.5 h-6.5 a3.5 3.5 0 0 1 -3.5 -3.5 v-1.5 a3.5 3.5 0 0 1 3.5 -3.5z"
            fill={INK}
            stroke={color}
            strokeWidth="1.6"
          />
          <path d="M46.5 37.5 L40.5 36 M73.5 37.5 L79.5 36" {...frame} />
        </>
      )
    default:
      return null
  }
}

// Headwear, on top of everything. White (or light gray) with a dark
// outline, so it never merges with dark hair.
function Hat({ hat, className }) {
  switch (hat) {
    case 'chef':
      return (
        <g className={className}>
          <circle cx="49.5" cy="13.5" r="8.5" fill="#ffffff" />
          <circle cx="70.5" cy="13.5" r="8.5" fill="#ffffff" />
          <circle cx="60" cy="11" r="10" fill="#ffffff" />
          <rect x="46" y="17" width="28" height="12" rx="2.5" fill="#ffffff" />
          <path d="M53 20.5 v5.5 M60 20.5 v5.5 M67 20.5 v5.5" strokeWidth="2" />
        </g>
      )
    case 'beanie':
      return (
        <g className={className}>
          <path d="M40 32 a20 20 0 0 1 40 0 z" fill="#ffffff" />
          <path d="M50 16.5 V30 M60 13 V30 M70 16.5 V30" strokeWidth="1.8" />
          <rect x="38" y="27.5" width="44" height="7.5" rx="3.5" fill="#ffffff" />
          <circle cx="60" cy="8.5" r="4.5" fill="#ffffff" />
        </g>
      )
    case 'cowboy':
      return (
        <g className={className}>
          <path d="M42 27 C40 14 47 7 53 9 C56 10 64 10 67 9 C73 7 80 14 78 27z" fill="#ffffff" />
          <path d="M53 9 Q60 14 67 9" strokeWidth="1.6" />
          <path d="M42 23 h36" />
          <path d="M24 21 C28 29 40 29 60 29 C80 29 92 29 96 21 C93 32 80 35 60 35 C40 35 27 32 24 21z" fill="#ffffff" />
        </g>
      )
    case 'fedora':
      return (
        <g className={className}>
          <path d="M42 28 C42 15 50 10 60 12 C70 10 78 15 78 28z" fill="#ffffff" />
          <path d="M53 13 Q60 18 67 13" strokeWidth="1.6" />
          <rect x="42" y="22" width="36" height="5" fill={INK} />
          <path d="M32 28 C42 31 78 31 88 28 C86 33 76 35 60 35 C44 35 34 33 32 28z" fill="#ffffff" />
        </g>
      )
    case 'bonnet':
      return (
        <g className={className}>
          <path d="M39 34 C41 21 50 16 60 16 C70 16 79 21 81 34 C77 28 69 25 60 25 C51 25 43 28 39 34z" fill="#c4c4c4" />
          <path d="M43 29 l1.5 -3 M49 25.5 l1 -3 M55 24 l0.5 -3 M65 24 l-0.5 -3 M71 25.5 l-1 -3 M77 29 l-1.5 -3" strokeWidth="1.2" />
        </g>
      )
    case 'headband':
      return (
        <g className={className}>
          <path d="M39.5 31 C42 22 50 18 60 18 C70 18 78 22 80.5 31 C76 26 69 23.5 60 23.5 C51 23.5 44 26 39.5 31z" fill="#ffffff" />
          <path d="M74 21 l6 -6 l2 7z M74 21 l9 0 l-4 -6z" fill="#ffffff" strokeWidth="1.6" />
        </g>
      )
    case 'beret':
      return (
        <g className={className}>
          <path d="M36 29 C34 17 52 10 70 12 C86 14 89 24 82 30 C70 34 48 34 36 29z" fill="#ffffff" />
          <path d="M39 29 C52 32 70 32 80 28" strokeWidth="1.6" />
          <path d="M63 12 l1 -5" strokeWidth="2.5" />
        </g>
      )
    case 'cap':
      return (
        <g className={className}>
          <path d="M40 30 C40 17 50 12 60 12 C70 12 80 17 80 30z" fill="#ffffff" />
          <path d="M60 13 V30 M50 15 Q48 22 47 30 M70 15 Q72 22 73 30" strokeWidth="1.6" />
          <circle cx="60" cy="12" r="2.2" fill="#ffffff" strokeWidth="1.8" />
          <path d="M38 29 C46 39 74 39 82 29 C74 33 46 33 38 29z" fill="#ffffff" />
        </g>
      )
    case 'turban':
      return (
        <g className={className}>
          <path d="M38 36 C35 17 46 7 60 7 C74 7 85 17 82 36 C76 31 68 29 60 31 C52 29 44 31 38 36z" fill="#ffffff" />
          <path d="M39 28 C47 20 55 22 60 31 M81 28 C73 20 65 22 60 31 M42 18 C50 12 58 14 61 22 M78 18 C70 12 62 14 59 22" strokeWidth="1.8" />
        </g>
      )
    case 'hijab':
      return <path className={className} d="M40 39 C40 24 49 17 60 17 C71 17 80 24 80 39 C76 30 68 26 60 26 C52 26 44 30 40 39z" fill="#d9d9d9" />
    default:
      return null
  }
}

// Behind the head: the hijab's drape and the bonnet's puff.
function HatBack({ hat }) {
  if (hat === 'hijab') {
    return <path d="M60 14 C82 14 89 34 87 52 C86 62 92 70 97 77 Q60 84 23 77 C28 70 34 62 33 52 C31 34 38 14 60 14z" fill="#d9d9d9" />
  }
  if (hat === 'bonnet') {
    return (
      <>
        <path d="M60 1.5 C87 1.5 97 19 93 36 C90 48 82 52 74 50 C70 44 50 44 46 50 C38 52 30 48 27 36 C23 19 33 1.5 60 1.5z" fill="#d9d9d9" />
        <path d="M60 2.5 C58 9 57 14 58 18 M44 5 C46 10 48 15 51 19 M76 4 C74 10 72 15 69 19 M32 14 C37 18 41 22 43 26 M88 14 C83 18 79 22 77 26" strokeWidth="1.3" />
      </>
    )
  }
  return null
}

// hatDrops: the hat drops on once (setup's first badge), unless reduced
// motion is on.
export default function Avatar({
  pose = 'idle',
  outfit = 'none',
  hat = 'none',
  skin = 'plain',
  hair = 'none',
  hairColor = 'black',
  glasses = 'none',
  utensil = 'none',
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
  // Eyes, mouth and glasses are black on every tone, like the outline.
  const feature = INK
  const color = HAIR_COLORS.find((c) => c.id === hairColor) ?? HAIR_COLORS[0]
  // A light edge only where dark hair meets a deep skin tone.
  const edge = deep && !color.light ? LIGHT : INK
  const shownHair = COVERING_HATS.includes(hat) ? 'none' : hair
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
      stroke={INK}
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ display: 'block', flex: 'none', transform: flip ? 'scaleX(-1)' : undefined }}
    >
      <path d="M50 128 V152 h-8 M70 128 V152 h8" />
      {outfit === 'shirt' && <path d="M43 112 h15 v36 h-15z M62 112 h15 v36 h-15z" fill="#d9d9d9" strokeWidth="2.5" />}
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
      {outfit === 'shirt' && (
        <>
          <path d="M53 69 L60 78 L67 69" strokeWidth="2.5" />
          <circle cx="60" cy="88" r="1.6" fill={INK} stroke="none" />
          <circle cx="60" cy="98" r="1.6" fill={INK} stroke="none" />
          <circle cx="60" cy="108" r="1.6" fill={INK} stroke="none" />
        </>
      )}
      {outfit === 'dress' && (
        <>
          <path d="M39 98 H81 L90 136 Q60 143 30 136z" fill="#e6e6e6" />
          <path d="M39 98 H81" strokeWidth="2.5" />
          {[
            [48, 112],
            [62, 108],
            [74, 118],
            [42, 128],
            [56, 126],
            [80, 130],
          ].map(([x, y]) => (
            <circle key={`${x}-${y}`} cx={x} cy={y} r="2" fill={INK} stroke="none" />
          ))}
        </>
      )}
      <Costume outfit={outfit} />
      <Tool utensil={utensil} />
      <circle cx="28" cy="116" r="5" fill={fill} />
      <circle cx={rhx} cy={rhy} r="5" fill={fill} />
      {pose === 'cheers' && (
        <>
          <path d="M97 32 h11 l-1.8 13.5 h-7.4z" fill="#ffffff" strokeWidth="2" />
          <path d="M98.1 37 h8.8" strokeWidth="1.5" />
        </>
      )}
      {pose === 'taste' && (
        <>
          <path d="M78 58 L70 48" strokeWidth="2.5" />
          <ellipse cx="68" cy="46" rx="4" ry="3" fill="#ffffff" strokeWidth="2" />
        </>
      )}
      <Hair hair={shownHair} hat={hat} fill={color.hex} edge={edge} layer="back" />
      <HatBack hat={hat} />
      {deep && <circle cx="60" cy="40" r="22.6" stroke={LIGHT} strokeWidth="1.6" />}
      <circle cx="60" cy="40" r="20" fill={fill} />
      <Hair hair={shownHair} hat={hat} fill={color.hex} edge={edge} layer="front" />
      <circle cx="53" cy="39" r="2.2" fill={feature} stroke="none" />
      <circle cx="67" cy="39" r="2.2" fill={feature} stroke="none" />
      <path d={pose === 'taste' ? 'M56 48 h8' : 'M53 47 q7 6 14 0'} stroke={feature} strokeWidth="2.5" />
      <Glasses glasses={glasses} color={feature} />
      <Hat hat={hat} className={hatClass} />
    </svg>
  )
}

const lookProps = (look) => ({
  outfit: look?.outfit,
  hat: look?.hat,
  skin: look?.skin,
  hair: look?.hair,
  hairColor: look?.hairColor,
  glasses: look?.glasses,
  utensil: look?.utensil,
})

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

// A larger round portrait (setup), showing hat to waist.
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

// The whole avatar, head to feet, on the cook's color (the closet), so the
// full outfit, hat, glasses and tool show while styling.
export function AvatarFullBody({ look, color, pose = 'wave', label }) {
  return (
    <span
      className="avatar-full"
      role={label ? 'img' : undefined}
      aria-label={label || undefined}
      aria-hidden={label ? undefined : 'true'}
      style={{ background: color ? `var(--cook-${color})` : 'var(--color-subtle)' }}
    >
      <Avatar pose={pose} {...lookProps(look)} size={224} />
    </span>
  )
}

export { lookProps, HAIR_COLORS }
