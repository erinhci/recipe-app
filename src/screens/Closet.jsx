import { useEffect, useRef, useState } from 'react'
import Page from '../components/Page'
import Icon from '../components/Icon'
import Avatar, { AvatarPortrait, SKIN_TONES, isDeepTone } from '../components/Avatar'
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
  { id: 'hat', label: 'Hats' },
  { id: 'scene', label: 'Scenes' },
  { id: 'pose', label: 'Poses' },
]

const NOTES = {
  look: 'Always yours to change. Nothing here is locked.',
  outfit: 'Earn badges to unlock more.',
  hat: 'Earn badges to unlock more.',
  scene: 'Where you two stand together.',
  pose: 'What you two are doing together.',
}

// "meals-10" -> "10 meals cooked"
function badgeLabel(key) {
  const [kind, n] = key.split('-')
  return MILESTONES.find((m) => m.kind === kind)?.label(Number(n)) ?? ''
}

const SHARE_MESSAGES = {
  shared: 'Shared.',
  downloaded: 'Image saved to your downloads.',
  failed: "Couldn't share the image. Try again.",
  cancelled: '',
}

export default function Closet() {
  const { member } = useAuth()
  const people = useKitchenPeople(member.user_id)
  const [tab, setTab] = useState('look')
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
  const current = { outfit: me.look.outfit, hat: me.look.hat, scene, pose, look: me.look.hair }[tab]

  async function saveLook(patch) {
    // Only what was chosen is stored; the gray placeholder isn't a tone.
    const { outfit, hat, skin, hair } = { ...me.look, ...patch }
    await saveMyMember(member.user_id, { avatar: { outfit, hat, hair, ...(skin !== 'plain' ? { skin } : {}) } })
  }

  async function choose(option) {
    if (tab !== 'look' && !isUnlocked(option, earned)) return
    if (option.id === current) return
    if (tab === 'look') await saveLook({ hair: option.id })
    else if (tab === 'outfit' || tab === 'hat') await saveLook({ [tab]: option.id })
    else if (kitchen) await saveKitchen(kitchen.id, tab === 'scene' ? { scene: option.id } : { duo_pose: option.id })
    setStatus(`${option.label} chosen.`)
  }

  async function chooseSkin(id) {
    await saveLook({ skin: id })
    setStatus(`${SKIN_CHOICES.find((t) => t.id === id)?.label} chosen.`)
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

  const options = tab === 'look' ? HAIR_STYLES : OPTIONS[tab]
  const preview = (option) => {
    if (tab === 'scene') return <Scene cooks={cooks} scene={option.id} pose={pose} compact caption={false} />
    if (tab === 'pose') return <Scene cooks={partner ? cooks : [...cooks, { name: '', look: {} }]} scene={scene} pose={option.id} compact caption={false} />
    const look = { ...me.look, [tab === 'look' ? 'hair' : tab]: option.id }
    // Hair shows without a hat, so the style is clear.
    return <Avatar size={tab === 'look' ? 64 : 80} outfit={look.outfit} hat={tab === 'look' ? 'none' : look.hat} skin={look.skin} hair={look.hair} />
  }
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
            Shared with {partner?.name ?? 'your partner'}. It's how you both show at the top of Settings.
          </p>
        </div>
      ) : (
        <button type="button" className="closet-hero share-tile" onClick={share} aria-label={`Share my look: ${lookCardAlt(me)}`}>
          <AvatarPortrait look={me.look} color={me.color} size={168} pose="wave" />
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
                  const checked = me.look.skin === tone.id
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
            <h2 className="closet-subhead">Hair</h2>
          </>
        )}
        <ul className={`closet-grid${tab === 'look' ? ' is-dense' : ''}`}>
          {options.map((option) => {
            const open = tab === 'look' || isUnlocked(option, earned)
            const on = option.id === current
            return (
              <li key={option.id}>
                <button
                  type="button"
                  className={`closet-item${on ? ' is-on' : ''}${open ? '' : ' is-locked'}`}
                  aria-pressed={on}
                  aria-disabled={!open || undefined}
                  onClick={() => choose(option)}
                >
                  <span className="closet-preview">{preview(option)}</span>
                  <span className="closet-label">{option.label}</span>
                  {on && <span className="closet-note">{shared ? 'Chosen' : 'Wearing'}</span>}
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
