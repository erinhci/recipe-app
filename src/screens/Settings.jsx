import { useCallback, useEffect, useState } from 'react'
import Page from '../components/Page'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { useOnline } from '../lib/useOnline'
import { syncNow, useSyncStatus } from '../lib/sync'
import RecentlyDeleted from '../components/RecentlyDeleted'

const timeFormat = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' })

function SyncStatus() {
  const { state, error, lastSyncedAt } = useSyncStatus()
  const text = {
    idle: lastSyncedAt ? `Up to date as of ${timeFormat.format(new Date(lastSyncedAt))}.` : 'Not synced yet.',
    syncing: 'Syncing…',
    offline: "Offline. Changes are saved on this phone and sync when you're back online.",
    error: `Sync problem: ${error}`,
  }[state]
  return (
    <section className="card" aria-labelledby="sync-heading">
      <h2 id="sync-heading">Sync</h2>
      <p role="status">{text}</p>
      {state === 'idle' && error && <p className="hint">{error}</p>}
      <button className="btn btn-secondary" type="button" onClick={() => syncNow()} disabled={state === 'syncing'}>
        Sync now
      </button>
    </section>
  )
}

export default function Settings() {
  const { member, refreshMember, signOut } = useAuth()
  const online = useOnline()
  const [cooks, setCooks] = useState([])
  const [inviteLink, setInviteLink] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const loadCooks = useCallback(async () => {
    const { data } = await supabase
      .from('members')
      .select('user_id, display_name')
      .is('removed_at', null)
    setCooks(data ?? [])
  }, [])

  useEffect(() => {
    if (online) loadCooks()
  }, [online, loadCooks])

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
    await loadCooks()
  }

  async function changeUnits(event) {
    const unit_pref = event.target.value
    const { error: updateError } = await supabase
      .from('members')
      .update({ unit_pref })
      .eq('user_id', member.user_id)
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

  return (
    <Page title="Settings">
      <section className="card" aria-labelledby="you-heading">
        <h2 id="you-heading">You</h2>
        <p>{member.display_name}</p>
        <div className="field">
          <label htmlFor="units">Units</label>
          <select id="units" value={member.unit_pref} onChange={changeUnits} disabled={!online}>
            <option value="us">US (cups, tablespoons, ounces)</option>
            <option value="metric">Metric (grams, milliliters)</option>
          </select>
          {!online && <span className="hint">Connect to the internet to change this.</span>}
        </div>
      </section>

      <section className="card" aria-labelledby="kitchen-heading">
        <h2 id="kitchen-heading">Your kitchen</h2>
        {cooks.length > 0 && (
          <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 var(--space-4)' }}>
            {cooks.map((cook) => {
              const isMe = cook.user_id === member.user_id
              return (
                <li
                  key={cook.user_id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 'var(--space-3)',
                    padding: 'var(--space-2) 0',
                  }}
                >
                  <span>
                    {cook.display_name}
                    {isMe && <span className="hint"> (you)</span>}
                  </span>
                  <button
                    className="btn btn-secondary"
                    type="button"
                    onClick={() => removeCook(cook)}
                    disabled={!online}
                  >
                    {isMe ? 'Leave kitchen' : <>Remove<span className="sr-only"> {cook.display_name}</span></>}
                  </button>
                </li>
              )
            })}
          </ul>
        )}
        {!kitchenFull && (
          <>
            <p>Invite the second cook with a one-time link. It works for 7 days.</p>
            <button className="btn" type="button" onClick={makeInvite} disabled={!online}>
              Create invite link
            </button>
            {inviteLink && (
              <div className="field" style={{ marginTop: 'var(--space-4)' }}>
                <label htmlFor="invite-link">Invite link</label>
                <input id="invite-link" readOnly value={inviteLink} onFocus={(e) => e.target.select()} />
                <button className="btn btn-secondary" type="button" onClick={copyInvite}>
                  Copy link
                </button>
              </div>
            )}
          </>
        )}
        <p role="status">{message}</p>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
      </section>

      <RecentlyDeleted />

      <SyncStatus />

      <button className="btn btn-secondary" type="button" onClick={signOut}>
        Sign out
      </button>
    </Page>
  )
}
