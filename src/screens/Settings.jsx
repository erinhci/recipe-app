import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import Page from '../components/Page'
import Icon from '../components/Icon'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { useOnline } from '../lib/useOnline'
import { syncNow, useSyncStatus } from '../lib/sync'
import { db } from '../lib/db'
import { current, releaseDate, releases } from '../lib/releases'
import RecentlyDeleted from '../components/RecentlyDeleted'
import ColorPicker from '../components/ColorPicker'
import Scene from '../components/Scene'
import { Link } from 'react-router-dom'
import { useKitchenPeople } from '../lib/useKitchen'
import { THEMES, getTheme, setTheme } from '../lib/theme'
import { saveMyMember } from '../lib/avatars'

const timeFormat = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' })

// Sync sits on the title row: when it last synced, and a button to sync
// now. Problems show in words under the title.
function SyncStatus() {
  const { state, lastSyncedAt } = useSyncStatus()
  const text = {
    idle: lastSyncedAt ? `Synced ${timeFormat.format(new Date(lastSyncedAt))}` : 'Not synced yet',
    syncing: 'Syncing…',
    offline: 'Offline',
    error: "Didn’t sync",
  }[state]
  return (
    <div className="sync-status">
      <span role="status" className="hint">
        {text}
      </span>
      <button
        className="btn btn-secondary icon-btn"
        type="button"
        aria-label="Sync now"
        onClick={() => syncNow()}
        disabled={state === 'syncing'}
      >
        <Icon name="sync" size={22} />
      </button>
    </div>
  )
}

function SyncProblem() {
  const { state, error } = useSyncStatus()
  if (state === 'offline') {
    return <p className="hint">Changes are saved on this phone and sync when you’re back online.</p>
  }
  if (state !== 'error') return null
  const network = /fetch|network|load failed/i.test(String(error))
  return (
    <p className="notice-line notice" style={{ padding: 'var(--space-3) var(--space-4)', borderRadius: 'var(--radius)' }}>
      {network
        ? "Couldn’t reach the server. Changes are saved on this phone and will sync when the connection is back."
        : `Some changes didn’t sync. Try the sync button; if it keeps happening, tell us this: ${String(error)}`}
    </p>
  )
}

export default function Settings() {
  const { member, refreshMember, signOut } = useAuth()
  const online = useOnline()
  const [inviteLink, setInviteLink] = useState('')
  const [theme, setThemeState] = useState(getTheme)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  // From this phone's copy of the kitchen, so it shows at once (and
  // offline). Sync keeps it current when someone joins or leaves.
  const cooks =
    useLiveQuery(async () => {
      const rows = await db.members.filter((m) => !m.removed_at).toArray()
      const byUser = new Map(rows.map((m) => [m.user_id, m]))
      // You first.
      return [...byUser.values()].sort((a, b) => (b.user_id === member.user_id) - (a.user_id === member.user_id))
    }, [member.user_id]) ?? []

  async function removeCook(cook) {
    const isMe = cook.user_id === member.user_id
    const question = isMe
      ? 'Leave this kitchen? You lose access to its recipes right away. Your past notes and ratings stay.'
      : `Remove ${cook.display_name} from the kitchen? They lose access right away. Their past notes and ratings stay.`
    if (!window.confirm(question)) return
    setError('')
    setMessage('')
    const { error: rpcError } = await supabase.rpc('remove_member', { member_user_id: cook.user_id })
    if (rpcError) {
      setError(rpcError.message)
      return
    }
    if (isMe) {
      // Back to setup, with this phone's copy of the kitchen cleared.
      await refreshMember()
      return
    }
    setInviteLink('')
    setMessage(`${cook.display_name} was removed. You can invite someone with a new link.`)
    syncNow()
  }

  async function changeUnits(event) {
    const unit_pref = event.target.value
    const { error: updateError } = await supabase.from('members').update({ unit_pref }).eq('user_id', member.user_id)
    if (updateError) setError(updateError.message)
    else await refreshMember()
  }

  async function makeInvite() {
    setError('')
    setMessage('')
    const { data, error: rpcError } = await supabase.rpc('create_invite')
    if (rpcError) {
      setError(rpcError.message)
      return
    }
    const link = `${window.location.origin}/join/${data}`
    setInviteLink(link)
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Join our kitchen', url: link })
        return
      } catch {
        // Share sheet dismissed; the link stays on screen to copy.
      }
    }
  }

  async function copyInvite() {
    try {
      await navigator.clipboard.writeText(inviteLink)
      setMessage('Invite link copied.')
    } catch {
      setMessage('Select the link above and copy it.')
    }
  }

  const kitchenFull = cooks.length >= 2
  const people = useKitchenPeople(member.user_id)
  const takenBy = people?.partner ? { [people.partner.color]: { name: people.partner.name, look: people.partner.look } } : {}

  async function changeColor(color) {
    await saveMyMember(member.user_id, { color })
    setMessage('Color saved.')
  }

  return (
    <Page title="Settings" aside={<SyncStatus />}>
      <SyncProblem />
      {people?.me && (
        <Link className="scene-card" to="/avatar">
          {/* Framed in your color, so changing it below changes the frame. */}
          <span className="scene-frame" style={{ background: `var(--cook-${people.me.color})` }}>
            <Scene cooks={people.cooks} scene={people.scene} pose={people.pose} caption={false} />
          </span>
          <span className="scene-card-foot">
            <span className="scene-card-text">
              <span className="scene-card-name">{people.me.name}</span>
              <span className="hint">Edit avatar, poses and scene</span>
            </span>
            <span className="chev-right" aria-hidden="true">
              <Icon name="chevron" size={20} />
            </span>
          </span>
        </Link>
      )}
      <ul className="settings-list plain-list">
        {people?.me && (
          <li className="settings-row-static">
            <span aria-hidden="true">Color</span>
            <ColorPicker value={people.me.color} onChange={changeColor} takenBy={takenBy} name="my-color" />
          </li>
        )}
        <li className="settings-row-static">
          <label htmlFor="units">Units</label>
          <select id="units" className="row-select" value={member.unit_pref} onChange={changeUnits} disabled={!online}>
            <option value="us">US</option>
            <option value="metric">Metric</option>
          </select>
        </li>
        <li className="settings-row-static">
          <label htmlFor="appearance">Appearance</label>
          <select
            id="appearance"
            className="row-select"
            value={theme}
            onChange={(e) => {
              setThemeState(e.target.value)
              setTheme(e.target.value)
            }}
          >
            {THEMES.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </select>
        </li>
      </ul>
      {!online && <p className="hint">Connect to change units.</p>}

      <details className="settings-row">
        <summary>
          <span>Kitchen</span>
          <span className="row-value">
            {cooks.map((c) => c.display_name).join(', ')}
            <span className="chev" aria-hidden="true">
              <Icon name="chevron" size={20} />
            </span>
          </span>
        </summary>
        <div className="row-body">
          <ul className="plain-list divided" style={{ marginTop: 0 }}>
            {cooks.map((cook) => (
              <li key={cook.user_id}>
                <span className="cook-name">
                  <span className="cook-dot" aria-hidden="true" style={{ background: `var(--cook-${people?.byUser[cook.user_id]?.color ?? 'berry'})` }} />
                  {cook.display_name}
                  {cook.user_id === member.user_id && <span className="hint"> (you)</span>}
                </span>
                {cook.user_id !== member.user_id && (
                  <button className="link-btn" type="button" onClick={() => removeCook(cook)} disabled={!online}>
                    Remove<span className="sr-only"> {cook.display_name}</span>
                  </button>
                )}
              </li>
            ))}
          </ul>
          {!kitchenFull && (
            <>
              <p>Invite the second cook with a one-time link. It works for 7 days.</p>
              <div className="actions">
                <button className="btn" type="button" onClick={makeInvite} disabled={!online}>
                  Create invite link
                </button>
              </div>
              {inviteLink && (
                <div className="field" style={{ marginTop: 'var(--space-4)' }}>
                  <label htmlFor="invite-link">Invite link</label>
                  <input id="invite-link" readOnly value={inviteLink} onFocus={(e) => e.target.select()} />
                  <span className="actions" style={{ margin: 'var(--space-2) 0 0' }}>
                    <button className="btn btn-secondary" type="button" onClick={copyInvite}>
                      Copy link
                    </button>
                  </span>
                </div>
              )}
            </>
          )}
        </div>
      </details>

      <RecentlyDeleted />

      <details className="settings-row">
        <summary>
          <span>What’s new</span>
          <span className="row-value">
            {current.version}
            <span className="chev" aria-hidden="true">
              <Icon name="chevron" size={20} />
            </span>
          </span>
        </summary>
        <div className="row-body">
          <p className="hint">Released {releaseDate(current)}</p>
          <ul>
            {current.notes.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
          <details>
            <summary>Earlier versions</summary>
            {releases.slice(1).map((release) => (
              <div key={release.version} style={{ marginBottom: 'var(--space-3)' }}>
                <p style={{ margin: 0, fontWeight: 600 }}>
                  {release.version} <span className="hint">· {releaseDate(release)}</span>
                </p>
                <ul style={{ paddingLeft: 'var(--space-6)', margin: 'var(--space-1) 0 0' }}>
                  {release.notes.map((note) => (
                    <li key={note}>{note}</li>
                  ))}
                </ul>
              </div>
            ))}
          </details>
        </div>
      </details>

      <p role="status">{message}</p>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}

      {/* Ways out at the bottom: leaving the kitchen far left, away from Sign out. */}
      <p className="actions settings-end">
        <button className="link-btn" type="button" onClick={() => removeCook(cooks.find((c) => c.user_id === member.user_id) ?? member)} disabled={!online}>
          Leave kitchen
        </button>
        <button className="btn btn-secondary" type="button" onClick={signOut}>
          Sign out
        </button>
      </p>
    </Page>
  )
}
