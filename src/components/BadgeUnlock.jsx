import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import Avatar, { lookProps } from './Avatar'
import BadgeIcon from './BadgeIcon'
import Icon from './Icon'
import { useAuth } from '../lib/auth'
import { useKitchenPeople } from '../lib/useKitchen'
import { rewardFor } from '../lib/avatars'

// Shown the moment a badge is earned, over whatever screen is open. About
// three seconds: the badge drops in spinning like a coin, both avatars jump
// for it (badges are earned together), they catch it and it glows with
// sparkles, then "Badge unlocked", the badge, and what it unlocks rise in.
// "Try it on" opens Your avatar on that tab; "Later" and Close go back.
// The stage is decorative; a status line announces the badge and reward.
// Reduced motion: no jumping, spinning or sparkles.
//
// This phone remembers which badges it has shown, per kitchen. The first
// time it runs it just remembers what's already earned, so nobody gets a
// pile of old badges at once. Signing up's badge has its own moment in
// setup, so it's skipped.

const seenKey = (kitchenId) => `badges-shown-${kitchenId}`

function readSeen(kitchenId) {
  try {
    const raw = localStorage.getItem(seenKey(kitchenId))
    return raw ? new Set(JSON.parse(raw)) : null
  } catch {
    return null
  }
}

function saveSeen(kitchenId, keys) {
  try {
    localStorage.setItem(seenKey(kitchenId), JSON.stringify([...keys]))
  } catch {
    // Not remembered; at worst it shows again.
  }
}

const TAB_FOR = { outfit: 'outfit', hat: 'accessories', glasses: 'accessories', utensil: 'accessories', scene: 'scene', pose: 'pose' }
const WHERE = {
  outfit: 'New outfit for your avatar',
  hat: 'New headwear for your avatar',
  scene: 'New scene for you both',
  pose: 'New pose for you both',
}
const today = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' })

export default function BadgeUnlock() {
  const { member } = useAuth()
  const people = useKitchenPeople(member?.user_id)
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const dialog = useRef(null)
  const [showing, setShowing] = useState(null)
  const kitchenId = member?.kitchen_id

  // Find a badge this phone hasn't shown yet.
  useEffect(() => {
    if (!people || !kitchenId || showing) return
    const earned = people.stats.milestones.filter((m) => m.reached && m.kind !== 'joined')
    const keys = earned.map((m) => `${m.kind}-${m.threshold}`)
    const seen = readSeen(kitchenId)
    if (!seen) {
      saveSeen(kitchenId, keys)
      return
    }
    const fresh = earned.find((m) => !seen.has(`${m.kind}-${m.threshold}`))
    // Not in the middle of cooking: it waits until the meal is logged and
    // cooking mode closes.
    const cooking = pathname.endsWith('/cook') || pathname.endsWith('/two-chef')
    if (fresh && !cooking) setShowing(fresh)
  }, [people, kitchenId, showing, pathname])

  useEffect(() => {
    if (showing && dialog.current && !dialog.current.open) dialog.current.showModal()
  }, [showing])

  if (!showing || !people) return null
  const reward = rewardFor(showing)
  const cooks = people.cooks
  const close = (then) => {
    const seen = readSeen(kitchenId) ?? new Set()
    seen.add(`${showing.kind}-${showing.threshold}`)
    saveSeen(kitchenId, seen)
    dialog.current?.close()
    setShowing(null)
    if (then) then()
  }
  return <BadgeUnlockView dialogRef={dialog} badge={showing} cooks={cooks} me={people.me} reward={reward} onClose={close} onTry={() => close(() => navigate('/avatar', { state: { tab: TAB_FOR[reward.type] } }))} />
}

// The screen itself. dialogRef: the <dialog> it opens in.
export function BadgeUnlockView({ dialogRef, badge: showing, cooks, me, reward, onClose: close, onTry }) {
  const preview = reward && me ? { ...lookProps(me.look), ...(['outfit', 'hat', 'glasses', 'utensil'].includes(reward.type) ? { [reward.type]: reward.id } : {}) } : null
  const byline = `${cooks.map((c) => c.name).join(' and ')}, ${today.format(new Date())}`
  const rewardLower = reward ? reward.label.charAt(0).toLowerCase() + reward.label.slice(1) : ''

  return (
    <dialog ref={dialogRef} className="badge-unlock" aria-labelledby="bu-title" onCancel={() => close()}>
      <div className="bu-top">
        <button className="close-btn is-inline" type="button" aria-label="Close" onClick={() => close()}>
          <Icon name="close" size={22} />
        </button>
      </div>
      <div className="bu-stage" aria-hidden="true">
        <div className="bu-glow" />
        <div className="bu-halo" />
        {[
          [-92, -46],
          [96, -38],
          [-78, 52],
          [84, 58],
          [6, -96],
        ].map(([dx, dy]) => (
          <span key={`${dx}${dy}`} className="bu-spark" style={{ '--dx': `${dx}px`, '--dy': `${dy}px` }} />
        ))}
        <div className="bu-float">
          <div className="bu-coin">
            <span className="bu-medal">
              <BadgeIcon kind={showing.kind} size={34} />
              <span className="bu-number">{showing.threshold}</span>
            </span>
          </div>
        </div>
        <span className="bu-floor" />
        {cooks[0] && (
          <span className={`bu-cook bu-a${cooks.length > 1 ? '' : ' is-alone'}`}>
            <Avatar pose="highfive" {...lookProps(cooks[0].look)} size={176} />
          </span>
        )}
        {cooks[1] && (
          <span className="bu-cook bu-b">
            <Avatar pose="highfive" {...lookProps(cooks[1].look)} size={176} flip />
          </span>
        )}
      </div>
      <div className="bu-text">
        <div className="bu-in bu-heading">
          <span className="eyebrow">Badge unlocked</span>
          <h2 id="bu-title">{showing.label}</h2>
          <p className="hint">{byline}</p>
        </div>
        {reward && (
          <div className="bu-in2 bu-reward">
            {preview && (
              <span className="bu-reward-face" aria-hidden="true" style={{ background: `var(--cook-${me.color})` }}>
                <Avatar pose="idle" {...preview} size={96} />
              </span>
            )}
            <span className="bu-reward-text">
              <span className="hint">You unlocked</span>
              <span className="bu-reward-name">{reward.label}</span>
              <span className="hint">{WHERE[reward.type] ?? 'New for your avatar'}</span>
            </span>
          </div>
        )}
        <div className="bu-in3 actions">
          <button className="btn btn-secondary" type="button" onClick={() => close()}>
            {reward ? 'Later' : 'Close'}
          </button>
          {reward && (
            <button className="btn" type="button" onClick={onTry}>
              Try it on
            </button>
          )}
        </div>
      </div>
      <p className="sr-only" role="status">
        Badge unlocked: {showing.label}.{reward ? ` You unlocked the ${rewardLower}.` : ''}
      </p>
    </dialog>
  )
}
