import { useRef, useState } from 'react'
import Page from '../components/Page'
import Avatar, { AvatarPortrait } from '../components/Avatar'
import Scene from '../components/Scene'
import { useAuth } from '../lib/auth'
import { useKitchenPeople } from '../lib/useKitchen'
import { MILESTONES } from '../lib/stats'
import { OPTIONS, isUnlocked, saveKitchen, saveMyMember } from '../lib/avatars'

// Your avatar: what it wears, and the kitchen's shared scene and pose.
// Opened from the scene at the top of Settings. Changes save as you pick.
// Locked items say which badge unlocks them.

const TABS = [
  { id: 'outfit', label: 'Outfits' },
  { id: 'hat', label: 'Hats' },
  { id: 'scene', label: 'Scenes' },
  { id: 'pose', label: 'Poses' },
]

// "meals-10" -> "10 meals cooked"
function badgeLabel(key) {
  const [kind, n] = key.split('-')
  return MILESTONES.find((m) => m.kind === kind)?.label(Number(n)) ?? ''
}

export default function Closet() {
  const { member } = useAuth()
  const people = useKitchenPeople(member.user_id)
  const [tab, setTab] = useState('outfit')
  const [status, setStatus] = useState('')
  const tabRefs = useRef({})

  if (!people?.me) {
    return (
      <Page title="Your avatar" back={{ to: '/settings', label: 'Settings' }}>
        <p role="status">Loading…</p>
      </Page>
    )
  }
  const { me, cooks, earned, scene, pose, kitchen } = people

  const current = { outfit: me.look.outfit, hat: me.look.hat, scene, pose }[tab]

  async function choose(option) {
    if (!isUnlocked(option, earned) || option.id === current) return
    if (tab === 'outfit' || tab === 'hat') {
      await saveMyMember(member.user_id, { avatar: { ...me.look, [tab]: option.id } })
    } else if (kitchen) {
      await saveKitchen(kitchen.id, tab === 'scene' ? { scene: option.id } : { duo_pose: option.id })
    }
    setStatus(`${option.label} chosen.`)
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

  const preview = (option) => {
    if (tab === 'scene') return <Scene cooks={cooks} scene={option.id} pose={pose} compact caption={false} />
    if (tab === 'pose') return <Scene cooks={cooks.length > 1 ? cooks : [...cooks, { name: '', look: {} }]} scene={scene} pose={option.id} compact caption={false} />
    return <Avatar size={80} outfit={tab === 'outfit' ? option.id : me.look.outfit} hat={tab === 'hat' ? option.id : me.look.hat} />
  }

  return (
    <Page title="Your avatar" back={{ to: '/settings', label: 'Settings' }}>
      <div className="closet-hero">
        <AvatarPortrait look={me.look} color={me.color} size={168} pose="wave" label={`${me.name}'s avatar, waving`} />
        <span className="closet-name">{me.name}</span>
      </div>

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
        {(tab === 'scene' || tab === 'pose') && (
          <p className="hint">Shared with {cooks.length > 1 ? cooks.find((c) => !c.isMe).name : 'your partner'}: it's how you both show at the top of Settings.</p>
        )}
        <ul className="closet-grid">
          {OPTIONS[tab].map((option) => {
            const open = isUnlocked(option, earned)
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
                  {on && <span className="closet-note">{tab === 'outfit' || tab === 'hat' ? 'Wearing' : 'Chosen'}</span>}
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
    </Page>
  )
}
