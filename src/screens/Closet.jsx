import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import Page from '../components/Page'
import Icon from '../components/Icon'
import Avatar, { AvatarFullBody, HAIR_COLORS, SKIN_TONES, isDeepTone } from '../components/Avatar'
import Scene, { sceneCaption } from '../components/Scene'
import { LookCard, SceneCard, lookCardAlt } from '../components/ShareCards'
import { useAuth } from '../lib/auth'
import { useKitchenPeople } from '../lib/useKitchen'
import { MILESTONES } from '../lib/stats'
import { HAIR_STYLES, OPTIONS, SKIN_CHOICES, isUnlocked, saveKitchen, saveMyMember } from '../lib/avatars'
import { prepareImage, shareFile } from '../lib/shareImage'

// Your avatar: your look, what it wears, and the kitchen's shared scene
// and pose. Opened from the scene at the top of Settings. Changes save as
// you pick. Locked items say which badge unlocks them.
// The portrait (or the scene, on Scenes and Poses) is the share button:
// it shares an image of it through the phone's share sheet.

const TABS = [
  { id: 'look', label: 'Look' },
  { id: 'outfit', label: 'Outfits' },
  { id: 'accessories', label: 'Accessories' },
  { id: 'scene', label: 'Scenes' },
  { id: 'pose', label: 'Poses' },
]

const NOTES = {
  look: 'Always yours to change. Nothing here is locked.',
  outfit: 'Everyday clothes are free. Aprons and costumes come from badges.',
  accessories: 'Everything here is free: headwear, glasses and kitchen tools.',
  scene: 'Where you two stand together.',
  pose: 'What you two are doing together.',
}

// Hair colors bright enough to need a dark check mark on their swatch.
const DARK_HAIR = new Set(['black', 'darkbrown', 'brown', 'auburn', 'purple', 'blue'])

// "meals-10" -> "10 meals cooked"
function badgeLabel(key) {
  const [kind, n] = key.split('-')
  return MILESTONES.find((m) => m.kind === kind)?.label(Number(n)) ?? ''
}

const SHARE_MESSAGES = {
  shared: 'Shared.',
  downloaded: 'Image saved to your downloads.',
  failed: "Couldn’t share the image. Try again.",
  cancelled: '',
}

export default function Closet() {
  const { member } = useAuth()
  const people = useKitchenPeople(member.user_id)
  const navigate = useNavigate()
  const { state: routeState } = useLocation()
  // A badge's "Try it on" opens the tab its reward is on.
  const [tab, setTab] = useState(() => (TABS.some((t) => t.id === routeState?.tab) ? routeState.tab : 'look'))
  const [status, setStatus] = useState('')
  const tabRefs = useRef({})
  const lookCardRef = useRef(null)
  const sceneCardRef = useRef(null)
  const [files, setFiles] = useState({ look: null, scene: null })

  const me = people?.me
  const lookKey = me ? JSON.stringify([me.name, me.color, me.look]) : ''
  const sceneKey = people ? JSON.stringify([people.cooks.map((c) => [c.name, c.look]), people.scene, people.pose]) : ''

  // Draw the share images whenever what they show changes, so a tap can
  // share at once.
  useEffect(() => {
    if (!lookKey) return undefined
    let active = true
    prepareImage(lookCardRef.current, 'our-kitchen-look.png').then((file) => active && setFiles((f) => ({ ...f, look: file })))
    return () => {
      active = false
    }
  }, [lookKey])
  useEffect(() => {
    if (!sceneKey) return undefined
    let active = true
    prepareImage(sceneCardRef.current, 'our-kitchen-scene.png').then((file) => active && setFiles((f) => ({ ...f, scene: file })))
    return () => {
      active = false
    }
  }, [sceneKey])

  if (!me) {
    return (
      <Page title="Your avatar" back={{ to: '/settings', label: 'Settings' }}>
        <p role="status">Loading…</p>
      </Page>
    )
  }
  const { cooks, earned, scene, pose, kitchen } = people
  const partner = cooks.find((c) => !c.isMe)
  const shared = tab === 'scene' || tab === 'pose'

  async function saveLook(patch) {
    // Only what was chosen is stored; the gray placeholder isn't a tone.
    const { skin, ...rest } = { ...me.look, ...patch }
    await saveMyMember(member.user_id, { avatar: { ...rest, ...(skin !== 'plain' ? { skin } : {}) } })
  }

  // type: a look field (hair, outfit, hat, glasses, utensil) or scene/pose.
  async function choose(type, option) {
    if (!isUnlocked(option, earned)) {
      // A locked item opens the badge that unlocks it.
      navigate('/badges')
      return
    }
    const current = type === 'scene' ? scene : type === 'pose' ? pose : me.look[type]
    if (option.id === current) return
    if (type === 'scene' || type === 'pose') {
      if (kitchen) await saveKitchen(kitchen.id, type === 'scene' ? { scene: option.id } : { duo_pose: option.id })
    } else await saveLook({ [type]: option.id })
    setStatus(`${option.label} chosen.`)
  }

  async function chooseSkin(id) {
    await saveLook({ skin: id })
    setStatus(`${SKIN_CHOICES.find((t) => t.id === id)?.label} chosen.`)
  }

  async function chooseHairColor(id) {
    await saveLook({ hairColor: id })
    setStatus(`${HAIR_COLORS.find((c) => c.id === id)?.label} hair chosen.`)
  }

  async function share() {
    setStatus('')
    const result = shared
      ? await shareFile(files.scene, { title: 'Our Kitchen', text: `${sceneCaption(cooks, scene, pose)}.` })
      : await shareFile(files.look, { title: 'Our Kitchen', text: lookCardAlt(me) })
    setStatus(SHARE_MESSAGES[result])
  }

  // Arrow keys move between tabs (the usual tablist pattern).
  function onTabKey(event) {
    const index = TABS.findIndex((t) => t.id === tab)
    const step = { ArrowRight: 1, ArrowLeft: -1 }[event.key]
    let next = null
    if (step) next = TABS[(index + step + TABS.length) % TABS.length]
    if (event.key === 'Home') next = TABS[0]
    if (event.key === 'End') next = TABS[TABS.length - 1]
    if (!next) return
    event.preventDefault()
    setTab(next.id)
    tabRefs.current[next.id]?.focus()
  }

  const look = me.look
  // Tile previews. Hair and headwear zoom in on the head and shoulders;
  // glasses zoom to the face; clothes, costumes and tools show the whole
  // avatar. Hair tiles leave off the hat and headwear tiles leave off the
  // hair, so each shows just what it's for.
  const head = (props) => (
    <span className="closet-head">
      <Avatar size={130} {...props} />
    </span>
  )
  const preview = {
    hair: (o) => head({ hair: o.id, hairColor: look.hairColor, skin: look.skin }),
    hat: (o) => head({ hat: o.id, skin: look.skin, outfit: look.outfit }),
    glasses: (o) => (
      <span className="closet-face">
        <Avatar size={220} glasses={o.id} skin={look.skin} />
      </span>
    ),
    outfit: (o) =>
      o.costume ? <Avatar size={80} outfit={o.id} skin={look.skin} /> : <Avatar size={80} {...look} glasses="none" utensil="none" outfit={o.id} />,
    utensil: (o) => <Avatar size={80} skin={look.skin} outfit={look.outfit} utensil={o.id} />,
    scene: (o) => <Scene cooks={cooks} scene={o.id} pose={pose} compact caption={false} />,
    pose: (o) => <Scene cooks={partner ? cooks : [...cooks, { name: '', look: {} }]} scene={scene} pose={o.id} compact caption={false} />,
  }

  // One grid of choices. type: what the choice sets; cols: 3 or 4.
  const grid = (type, options, cols = 3) => (
    <ul className={`closet-grid${cols === 4 ? ' is-dense' : ''}`}>
      {options.map((option) => {
        const open = isUnlocked(option, earned)
        const current = type === 'scene' ? scene : type === 'pose' ? pose : look[type]
        const on = option.id === current
        const worn = type === 'utensil' ? 'Holding' : shared ? 'Chosen' : 'Wearing'
        return (
          <li key={option.id}>
            <button
              type="button"
              className={`closet-item${on ? ' is-on' : ''}${open ? '' : ' is-locked'}`}
              aria-pressed={on}
              aria-disabled={!open || undefined}
              onClick={() => choose(type, option)}
            >
              <span className="closet-preview">{preview[type](option)}</span>
              <span className="closet-label">{option.label}</span>
              {on && <span className="closet-note">{worn}</span>}
              {!open && (
                <span className="closet-note">
                  <span className="sr-only">Locked. Unlocks with </span>
                  {badgeLabel(option.badge)}
                </span>
              )}
            </button>
          </li>
        )
      })}
    </ul>
  )
  const shareIcon = (
    <span className="share-chip" aria-hidden="true">
      <Icon name="share" size={22} />
    </span>
  )

  return (
    <Page title="Your avatar" back={{ to: '/settings', label: 'Settings' }}>
      {shared ? (
        <div className="closet-top">
          <button type="button" className="share-tile" onClick={share} aria-label={`Share our scene: ${sceneCaption(cooks, scene, pose)}`}>
            <Scene cooks={cooks} scene={scene} pose={pose} caption={false} />
            {shareIcon}
          </button>
          <p className="hint with-icon">
            <Icon name="users" size={18} />
            Shared with {partner?.name ?? 'your partner'}. It’s how you both show at the top of Settings.
          </p>
        </div>
      ) : (
        <button type="button" className="closet-hero share-tile" onClick={share} aria-label={`Share my look: ${lookCardAlt(me)}`}>
          <AvatarFullBody look={me.look} color={me.color} pose="wave" />
          <span className="closet-name">{me.name}</span>
          {shareIcon}
        </button>
      )}

      <div role="tablist" aria-label="Avatar options" className="tabs" onKeyDown={onTabKey}>
        {TABS.map((t) => (
          <button
            key={t.id}
            ref={(el) => {
              tabRefs.current[t.id] = el
            }}
            id={`tab-${t.id}`}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            aria-controls="closet-panel"
            tabIndex={tab === t.id ? 0 : -1}
            className="tab"
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <section id="closet-panel" role="tabpanel" aria-labelledby={`tab-${tab}`} className="closet-panel">
        <p className="hint">{NOTES[tab]}</p>
        {tab === 'look' && (
          <>
            <fieldset className="skin-picker">
              <legend>Skin tone</legend>
              <div className="skin-options">
                {SKIN_CHOICES.map((tone) => {
                  const checked = look.skin === tone.id
                  return (
                    <label key={tone.id} className="skin-option">
                      <input type="radio" className="sr-only" name="skin" value={tone.id} checked={checked} onChange={() => chooseSkin(tone.id)} />
                      <span className="sr-only">{tone.label}</span>
                      <span
                        className="skin-swatch"
                        aria-hidden="true"
                        style={{ background: SKIN_TONES[tone.id], color: isDeepTone(tone.id) ? '#fbf3ec' : '#111111' }}
                      >
                        {checked && <Icon name="check" size={20} />}
                      </span>
                    </label>
                  )
                })}
              </div>
            </fieldset>
            <fieldset className="skin-picker">
              <legend>Hair color</legend>
              <div className="skin-options is-seven">
                {HAIR_COLORS.map((color) => {
                  const checked = look.hairColor === color.id
                  return (
                    <label key={color.id} className="skin-option">
                      <input
                        type="radio"
                        className="sr-only"
                        name="hair-color"
                        value={color.id}
                        checked={checked}
                        onChange={() => chooseHairColor(color.id)}
                      />
                      <span className="sr-only">{color.label}</span>
                      <span className="skin-swatch" aria-hidden="true" style={{ background: color.hex, color: DARK_HAIR.has(color.id) ? '#ffffff' : '#111111' }}>
                        {checked && <Icon name="check" size={20} />}
                      </span>
                    </label>
                  )
                })}
              </div>
            </fieldset>
            <h2 className="closet-subhead">Hair style</h2>
            {grid('hair', HAIR_STYLES, 4)}
          </>
        )}
        {tab === 'outfit' && (
          <>
            <h2 className="closet-subhead">Clothes</h2>
            {grid(
              'outfit',
              OPTIONS.outfit.filter((o) => !o.costume),
            )}
            <h2 className="closet-subhead is-spaced">Costumes</h2>
            {grid(
              'outfit',
              OPTIONS.outfit.filter((o) => o.costume),
            )}
          </>
        )}
        {tab === 'accessories' && (
          <>
            <h2 className="closet-subhead">Headwear</h2>
            {grid('hat', OPTIONS.hat, 4)}
            <h2 className="closet-subhead is-spaced">Glasses</h2>
            {grid('glasses', OPTIONS.glasses)}
            <h2 className="closet-subhead is-spaced">Kitchen tools</h2>
            {grid('utensil', OPTIONS.utensil)}
          </>
        )}
        {shared && grid(tab, OPTIONS[tab])}
      </section>
      <p className="sr-only" role="status">
        {status}
      </p>
      {status && status !== 'Shared.' && !status.endsWith('chosen.') && <p className="hint">{status}</p>}

      {/* The share images, drawn off screen and turned into PNGs. */}
      <div className="offscreen" aria-hidden="true">
        <LookCard cook={me} svgRef={lookCardRef} />
        <SceneCard cooks={cooks} scene={scene} pose={pose} svgRef={sceneCardRef} />
      </div>
    </Page>
  )
}
