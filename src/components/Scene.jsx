import Avatar from './Avatar'

// The two cooks' avatars together, in the kitchen's scene and pose. Each
// avatar keeps its own outfit and hat. With one cook, they stand alone.
// cooks: [{ name, look }] with you first. compact: a small preview tile.

const DUO = {
  wave: ['wave', 'wave', 'waving'],
  highfive: ['highfive', 'highfive', 'high-fiving'],
  taste: ['taste', 'wave', 'taste-testing'],
}
// Which way each avatar's raised arm points. Only the high five meets in
// the middle; waving hands point outward, so waving never reads as a high
// five.
const FLIP = { highfive: [false, true], wave: [true, false], taste: [false, false] }
const WHERE = { home: 'in the kitchen', market: 'at the night market', picnic: 'at a picnic' }

export function sceneCaption(cooks, scene, pose) {
  const names = cooks.map((c) => c.name).join(' and ')
  const verb = cooks.length > 1 ? DUO[pose]?.[2] ?? 'waving' : 'waving'
  return `${names} ${verb} ${WHERE[scene] ?? WHERE.home}`
}

export default function Scene({ cooks, scene = 'home', pose = 'wave', compact = false, caption = true }) {
  const [left, right] = DUO[pose] ?? DUO.wave
  const [flipA, flipB] = cooks.length > 1 ? FLIP[pose] ?? FLIP.wave : [false, false]
  const size = compact ? 72 : 176
  return (
    <figure className={`scene${compact ? ' is-compact' : ''}`}>
      <svg
        className="scene-art"
        aria-hidden="true"
        focusable="false"
        viewBox="0 0 350 230"
        preserveAspectRatio="xMidYMax meet"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M0 206 H350" />
        {scene === 'home' && (
          <>
            <path d="M20 24 h70 v56 h-70z M55 24 v56 M20 52 h70" />
            <path d="M250 150 h90 v56 h-90z M250 166 h90" />
            <path d="M276 150 v-14 h38 v14 M282 136 v-6 M308 136 v-6" />
          </>
        )}
        {scene === 'market' && (
          <>
            <path d="M0 30 l25 18 l25 -18 l25 18 l25 -18 l25 18 l25 -18 l25 18 l25 -18 l25 18 l25 -18 l25 18 l25 -18 l25 18 l25 -18" />
            <path d="M10 70 q80 24 165 0 q85 -24 165 0" strokeDasharray="1 14" strokeWidth="5" />
          </>
        )}
        {scene === 'picnic' && (
          <>
            <circle cx="300" cy="44" r="18" />
            <path d="M0 190 q90 -20 175 0 q90 20 175 0" />
            <path d="M40 206 v-60 M40 146 a24 24 0 1 1 0.1 0" />
          </>
        )}
      </svg>
      <div className="scene-cooks">
        {cooks[0] && <Avatar pose={cooks.length > 1 ? left : 'wave'} outfit={cooks[0].look?.outfit} hat={cooks[0].look?.hat} size={size} flip={flipA} />}
        {cooks[1] && (
          <span style={{ marginLeft: -size * 0.15 }}>
            <Avatar pose={right} outfit={cooks[1].look?.outfit} hat={cooks[1].look?.hat} size={size} flip={flipB} />
          </span>
        )}
      </div>
      {caption && <figcaption className="sr-only">{sceneCaption(cooks, scene, pose)}</figcaption>}
    </figure>
  )
}
