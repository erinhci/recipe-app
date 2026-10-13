import { useEffect, useRef, useState } from 'react'
import Icon from '../components/Icon'
import Scene from '../components/Scene'
import ColorPicker from '../components/ColorPicker'
import { AvatarPortrait } from '../components/Avatar'
import { Badges } from './Stats'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { clearPendingInvite, readPendingInvite } from '../lib/invite'
import { COLORS, colorsFor } from '../lib/avatars'

// Short setup after creating an account, one question per step:
// 1 your name, 2 the kitchen's name, 3 units, 4 your color, 5 your avatar
// and first badge, 6 invite your partner. Joining from an invite skips 2
// and 6, and step 4 shows the partner's color as taken.
// Back and Continue move between steps (a swipe does the same); moving
// focuses the new heading, and the step count is text. Progress is kept on
// this phone, so closing the app mid-way picks up at the same step.

const KEY = (userId) => `setup:${userId}`

export function readSetup(userId) {
  try {
    return JSON.parse(localStorage.getItem(KEY(userId)) ?? 'null')
  } catch {
    return null
  }
}
function writeSetup(userId, value) {
  try {
    if (value) localStorage.setItem(KEY(userId), JSON.stringify(value))
    else localStorage.removeItem(KEY(userId))
  } catch {
    // Not kept; setup still works, it just starts over if the app closes.
  }
}

// True while this cook is part-way through setup, even after their kitchen
// exists (so the app doesn't jump ahead before the last steps).
export const setupPending = (userId) => Boolean(readSetup(userId)?.started)

const usLocale = () => /^en-US$/i.test(navigator.language || 'en-US')

export default function Setup() {
  const { session, member, refreshMember, signOut } = useAuth()
  const userId = session.user.id
  const inviteCode = readPendingInvite()
  const saved = readSetup(userId) ?? {}
  // Joining someone's kitchen (from an invite link, or already joined in an
  // earlier visit to this screen).
  const joining = Boolean(inviteCode || saved.joining)
  const steps = joining ? [1, 3, 4, 5] : [1, 2, 3, 4, 5, 6]

  const [step, setStep] = useState(saved.step && steps.includes(saved.step) ? saved.step : 1)
  const [name, setName] = useState(saved.name ?? member?.display_name ?? '')
  const [kitchenName, setKitchenName] = useState(saved.kitchenName ?? 'Our Kitchen')
  const [units, setUnits] = useState(saved.units ?? member?.unit_pref ?? (usLocale() ? 'us' : 'metric'))
  const [color, setColor] = useState(saved.color ?? null)
  const [taken, setTaken] = useState({}) // { colorId: name }
  const [inKitchen, setInKitchen] = useState(Boolean(saved.inKitchen || member))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [inviteLink, setInviteLink] = useState('')
  const headingRef = useRef(null)
  const touch = useRef(null)

  const index = steps.indexOf(step)
  const count = steps.length

  useEffect(() => {
    document.title = `Set up, step ${index + 1} of ${count} · Our Kitchen`
    headingRef.current?.focus()
  }, [index, count])

  // Who else is in the kitchen, for the colors they've taken.
  useEffect(() => {
    if (!inKitchen || step !== 4) return
    let active = true
    supabase
      .from('members')
      .select('*')
      .is('removed_at', null)
      .then(({ data }) => {
        if (!active || !data) return
        const colors = colorsFor(data)
        const others = data.filter((m) => m.user_id !== userId)
        setTaken(Object.fromEntries(others.map((m) => [colors[m.user_id], m.display_name])))
        // Start on the first color nobody has.
        setColor((c) => c ?? colors[userId] ?? COLORS.find((x) => !others.some((m) => colors[m.user_id] === x.id))?.id ?? 'coral')
      })
    return () => {
      active = false
    }
  }, [inKitchen, step, userId])

  function remember(patch) {
    writeSetup(userId, { started: true, joining, step, name, kitchenName, units, color, inKitchen, ...patch })
  }

  function go(next) {
    setError('')
    setStep(next)
    remember({ step: next })
  }

  async function updateMe(fields) {
    const { error: updateError } = await supabase.from('members').update(fields).eq('user_id', userId).is('removed_at', null)
    // A column from migration 0014 that isn't there yet: carry on without it.
    if (updateError && !['PGRST204', '42703'].includes(updateError.code)) throw updateError
  }

  async function finish() {
    writeSetup(userId, null)
    clearPendingInvite()
    await refreshMember()
  }

  // Each step's Continue: save what it asked, then move on.
  async function next() {
    if (busy) return
    setBusy(true)
    setError('')
    try {
      if (step === 1) {
        const trimmed = name.trim()
        if (inKitchen) await updateMe({ display_name: trimmed })
        else if (joining) {
          const { error: rpcError } = await supabase.rpc('join_kitchen', { invite_code: inviteCode, my_name: trimmed })
          if (rpcError) throw rpcError
          setInKitchen(true)
          remember({ inKitchen: true, step: 3 })
        }
      }
      if (step === 2) {
        if (inKitchen) {
          // Already made on an earlier visit: just rename it.
          const { data: mine } = await supabase.from('members').select('kitchen_id').eq('user_id', userId).is('removed_at', null).maybeSingle()
          if (mine) await supabase.from('kitchens').update({ name: kitchenName.trim() }).eq('id', mine.kitchen_id)
        } else {
          const { error: rpcError } = await supabase.rpc('create_kitchen', { kitchen_name: kitchenName.trim(), my_name: name.trim() })
          if (rpcError) throw rpcError
          setInKitchen(true)
          remember({ inKitchen: true, step: 3 })
        }
      }
      if (step === 3) await updateMe({ unit_pref: units })
      if (step === 4 && color) await updateMe({ color })
      if (step === 5) await updateMe({ avatar: { hat: 'chef' } })
      const after = steps[index + 1]
      if (after) go(after)
      else await finish()
    } catch (e) {
      setError(e.message ?? String(e))
    } finally {
      setBusy(false)
    }
  }

  function back() {
    if (index > 0) go(steps[index - 1])
  }

  async function sendInvite() {
    setBusy(true)
    setError('')
    const { data, error: rpcError } = await supabase.rpc('create_invite')
    setBusy(false)
    if (rpcError) {
      setError(rpcError.message)
      return
    }
    const link = `${window.location.origin}/join/${data}`
    setInviteLink(link)
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Join our kitchen', url: link })
        await finish()
      } catch {
        // Share sheet closed; the link stays on screen to copy.
      }
    }
  }

  const canContinue = {
    1: name.trim().length > 0,
    2: kitchenName.trim().length > 0,
    3: true,
    4: Boolean(color),
    5: true,
  }[step]

  // A swipe left is Continue and a swipe right is Back. Both have buttons,
  // so nothing depends on the gesture. Swipes that start in a text field
  // are left to the field.
  function onTouchStart(event) {
    if (event.target.closest('input, textarea')) return
    touch.current = { x: event.touches[0].clientX, y: event.touches[0].clientY }
  }
  function onTouchEnd(event) {
    const start = touch.current
    touch.current = null
    if (!start) return
    const dx = event.changedTouches[0].clientX - start.x
    const dy = event.changedTouches[0].clientY - start.y
    if (Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy) * 1.5) return
    if (dx > 0) back()
    else if (canContinue && step !== 6) next()
  }

  const continueButton = (
    <button className="btn btn-large" type="submit" disabled={busy || !canContinue}>
      {busy ? 'Saving…' : 'Continue'}
    </button>
  )

  return (
    <main id="main" className="page flow-page setup" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
      <div className="setup-head">
        {index > 0 && (
          <button className="setup-back" type="button" aria-label="Back" onClick={back}>
            <span className="back-chev">
              <Icon name="chevron" size={22} />
            </span>
          </button>
        )}
        <div className="setup-progress">
          <span className="hint">
            Step {index + 1} of {count}
          </span>
          <span className="setup-bars" aria-hidden="true" style={{ gridTemplateColumns: `repeat(${count}, minmax(0, 1fr))` }}>
            {steps.map((s, i) => (
              <span key={s} className={i <= index ? 'is-done' : ''} />
            ))}
          </span>
        </div>
      </div>

      <form
        className="flow-form setup-body"
        noValidate
        onSubmit={(event) => {
          event.preventDefault()
          if (step !== 6) next()
        }}
      >
        {step === 1 && (
          <>
            <Intro headingRef={headingRef} title="What should we call you?">
              {joining ? 'Your partner' : 'Your partner, once they join,'} sees this on your notes, ratings and steps.
            </Intro>
            <div className="field">
              <label htmlFor="display-name" className="sr-only">
                Your name
              </label>
              <input id="display-name" autoComplete="given-name" placeholder="Your name" required value={name} onChange={(e) => setName(e.target.value)} />
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <Intro headingRef={headingRef} title="Name your kitchen">
              It's the shared home for your recipes. Both of you see this name.
            </Intro>
            <div className="field">
              <label htmlFor="kitchen-name" className="sr-only">
                Kitchen name
              </label>
              <input id="kitchen-name" placeholder="Our Kitchen" required value={kitchenName} onChange={(e) => setKitchenName(e.target.value)} />
            </div>
          </>
        )}

        {step === 3 && (
          <>
            <Intro headingRef={headingRef} title="How do you measure?">
              Every recipe shows amounts this way. You can change it in Settings.
            </Intro>
            <fieldset className="choice-cards">
              <legend className="sr-only">Units</legend>
              {[
                ['us', 'US', 'Cups, tablespoons, ounces'],
                ['metric', 'Metric', 'Grams, milliliters'],
              ].map(([value, label, detail]) => (
                <label key={value} className={`choice-card${units === value ? ' is-on' : ''}`}>
                  <input type="radio" className="sr-only" name="units" value={value} checked={units === value} onChange={() => setUnits(value)} />
                  <span className="choice-card-text">
                    <span className="choice-card-title">{label}</span>
                    <span className="hint">{detail}</span>
                  </span>
                  <span className="choice-card-mark" aria-hidden="true">
                    {units === value && <Icon name="check" size={18} />}
                  </span>
                </label>
              ))}
            </fieldset>
          </>
        )}

        {step === 4 && (
          <>
            <Intro headingRef={headingRef} title="Pick your color">
              It marks your steps in two-chef mode and sits behind your avatar. {joining ? 'Your partner has a different one.' : 'Your partner picks a different one.'}
            </Intro>
            <div className="setup-center">
              <AvatarPortrait color={color} size={120} look={{}} />
            </div>
            <ColorPicker value={color} onChange={setColor} takenBy={taken} large name="setup-color" />
          </>
        )}

        {step === 5 && (
          <>
            <Intro headingRef={headingRef} title="Meet your avatar">
              Cook together to earn badges. Each one unlocks something new: outfits, hats, poses and scenes.
            </Intro>
            <div className="setup-center">
              <AvatarPortrait color={color} size={200} pose="wave" look={{ hat: 'chef' }} hatDrops label="Your avatar, waving, in a chef hat" />
            </div>
            <div role="group" aria-labelledby="reward-title" className="reward-card">
              <Badges badges={[{ kind: 'joined', threshold: 1, label: 'Signed up', earned: true }]} />
              <div className="reward-text">
                <span className="eyebrow">First badge</span>
                <span id="reward-title" className="reward-title">
                  Signed up
                </span>
                <span className="hint">Unlocked: the chef hat. It's on.</span>
              </div>
            </div>
          </>
        )}

        {step === 6 && (
          <>
            <Intro headingRef={headingRef} title="Cook with your partner">
              Send them a link to join your kitchen.
            </Intro>
            <Scene cooks={[{ name: name.trim() || 'You', look: { hat: 'chef' } }, { name: 'your partner', look: {} }]} pose="wave" />
            <ul className="setup-points">
              <li>
                <Icon name="link" size={20} />A one-time link, good for 7 days.
              </li>
              <li>
                <Icon name="users" size={20} />
                They pick their own name, color and avatar.
              </li>
            </ul>
            {inviteLink && (
              <div className="field">
                <label htmlFor="invite-link">Invite link</label>
                <input id="invite-link" readOnly value={inviteLink} onFocus={(e) => e.target.select()} />
              </div>
            )}
          </>
        )}

        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}

        <div className="flow-foot">
          {step === 6 ? (
            <>
              {inviteLink ? (
                <button className="btn btn-large" type="button" onClick={finish}>
                  Done
                </button>
              ) : (
                <button className="btn btn-large" type="button" onClick={sendInvite} disabled={busy}>
                  {busy ? 'One moment…' : 'Send invite link'}
                </button>
              )}
              {!inviteLink && (
                <button className="link-btn" type="button" onClick={finish}>
                  Skip for now
                </button>
              )}
            </>
          ) : (
            continueButton
          )}
          {step === 1 && (
            <p className="flow-switch">
              {inviteCode ? (
                <button
                  className="link-btn"
                  type="button"
                  onClick={() => {
                    clearPendingInvite()
                    writeSetup(userId, null)
                    window.location.assign('/')
                  }}
                >
                  Create my own kitchen instead
                </button>
              ) : null}{' '}
              <button className="link-btn" type="button" onClick={signOut}>
                Sign out
              </button>
            </p>
          )}
        </div>
      </form>
    </main>
  )
}

function Intro({ headingRef, title, children }) {
  return (
    <div className="flow-intro">
      <h1 ref={headingRef} tabIndex={-1}>
        {title}
      </h1>
      <p className="flow-lede">{children}</p>
    </div>
  )
}
